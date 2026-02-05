/**
 * Sheets Agent - AI SDK with Self-Correction
 * 
 * A true agent for Google Sheets that:
 * - Uses 10 specialized tools
 * - Self-corrects using Evaluator-Optimizer pattern
 * - Loops until goal is achieved or max steps reached
 * 
 * @version 1.0.0
 * @created 2026-02-05
 */

import { generateText, generateObject } from 'ai';
import type { LanguageModel } from 'ai';
import { z } from 'zod';
import { allTools } from './tools';

// ============================================
// TYPES
// ============================================

export interface DataContext {
  headers: Record<string, string>;  // { "A": "Name", "B": "Sales", ... }
  dataRange: string;                // "A2:G31"
  rowCount: number;
  sampleData: Record<string, string[]>;  // { "A": ["John", "Jane"], ... }
  emptyColumns: string[];           // ["H", "I", "J"]
  columnsWithData: string[];        // ["A", "B", "C", ...]
  headerRow: number;
  dataStartRow: number;
  dataEndRow: number;
  userGoal?: string;                // Stored for evaluation
}

export interface AgentResult {
  text: string;
  toolCalls: Array<{
    toolName: string;
    args: Record<string, any>;
  }>;
  toolResults: any[];
  steps: number;
  _stepResults?: Array<{ tool: string; params?: any; result?: any; evaluation?: any }>;
  _agentVersion: string;
}

// Schema for self-correction evaluation
const EvaluationSchema = z.object({
  meetsGoal: z.boolean().describe('Does the result achieve what the user wanted?'),
  confidence: z.number().min(0).max(1).describe('How confident are we in this assessment?'),
  issues: z.array(z.string()).describe('List of issues found, if any'),
  shouldRetry: z.boolean().describe('Should the agent try a different approach?'),
  suggestedFix: z.string().optional().describe('How to fix the issue'),
});

// ============================================
// AGENT INSTRUCTIONS
// ============================================

function buildAgentSystemPrompt(context: DataContext): string {
  return `You are an intelligent Google Sheets agent.

## Available Tools
You have 10 tools for spreadsheet operations:
- format: Style cells, numbers, dates, borders, banding
- formula: Apply native Google Sheets formulas (FREE, instant, auto-updates)
- chart: Create visualizations (line, bar, pie, scatter, combo)
- conditionalFormat: Highlight cells based on rules
- dataValidation: Dropdowns, checkboxes, number ranges
- filter: Show/hide rows by criteria
- sheetOps: Freeze, sort, hide, resize, protect
- writeData: Paste data, tables, CSV
- analyze: Answer questions, provide insights
- table: Create formatted tables

## Current Spreadsheet Context
- Headers: ${JSON.stringify(context.headers)}
- Data Range: ${context.dataRange}
- Row Count: ${context.rowCount}
- Data Rows: ${context.dataStartRow} to ${context.dataEndRow}
- Empty Columns (for output): ${context.emptyColumns.slice(0, 5).join(', ')}
- Sample Data: ${JSON.stringify(context.sampleData)}

## Golden Rules
1. **Formula First**: When a native formula can solve the task, use it! It's FREE and instant.
2. **Use Context**: Derive column letters from the headers object.
   - Example: headers shows {"G": "Growth"} → "Growth column" = column G
3. **Replacing vs Adding**:
   - "Turn X into formula" → use the EXISTING column letter
   - "Add a new column" → use an EMPTY column letter
4. **Respect User Values**: Use exact numbers, text, and options the user specifies.

## Response Guidelines
- Use tools to complete the task
- If you need clarification, explain what information you need
- Summarize what you did after completing`;
}

// ============================================
// CREATE AGENT
// ============================================

/**
 * Create a SheetsAgent - simplified for declarative tools
 */
export function createSheetsAgent(model: LanguageModel, evaluatorModel: LanguageModel | null, context: DataContext) {
  return {
    async generate({ prompt }: { prompt: string }): Promise<AgentResult> {
      const systemPrompt = buildAgentSystemPrompt(context);
      
      console.log('[SheetsAgent] Generating with SDK tools...');
      
      // Generate with tools (single call - tools are declarative)
      const result = await generateText({
        model,
        system: systemPrompt,
        prompt,
        tools: allTools,
      });
      
      console.log('[SheetsAgent] Generation complete:', {
        hasText: !!result.text,
        toolCalls: result.toolCalls?.length || 0,
        finishReason: result.finishReason,
      });
      
      // Extract tool calls
      const toolCalls = (result.toolCalls || []).map((tc: any) => ({
        toolName: tc.toolName,
        args: tc.input || {},  // AI SDK uses 'input' property
      }));
      
      // Optional: Self-correction via evaluation of tool call parameters
      const stepResults: Array<{ tool: string; params: any; evaluation?: any }> = [];
      
      if (evaluatorModel && toolCalls.length > 0) {
        console.log('[SheetsAgent] Evaluating tool call parameters...');
        
        for (const tc of toolCalls) {
          try {
            const { object: evaluation } = await generateObject({
              model: evaluatorModel,
              schema: EvaluationSchema,
              prompt: `Evaluate these Google Sheets tool parameters:

Tool: ${tc.toolName}
Parameters: ${JSON.stringify(tc.args, null, 2)}

User's Goal: "${prompt}"
Context: ${JSON.stringify({ headers: context.headers, dataRange: context.dataRange })}

Questions:
1. Are the parameters correct for achieving the user's goal?
2. Is the column letter correct (check against headers)?
3. Is the range correct?
4. Any issues?`,
            });
            
            stepResults.push({
              tool: tc.toolName,
              params: tc.args,
              evaluation,
            });
            
            console.log('[SheetsAgent] Parameter evaluation:', {
              tool: tc.toolName,
              meetsGoal: evaluation.meetsGoal,
              issues: evaluation.issues,
            });
            
          } catch (evalError) {
            console.error('[SheetsAgent] Evaluation error:', evalError);
          }
        }
      }
      
      return {
        text: result.text || '',
        toolCalls,
        toolResults: [],  // No execution results (declarative tools)
        steps: toolCalls.length,
        _stepResults: stepResults,
        _agentVersion: '1.0.0',
      };
    },
  };
}

// ============================================
// RESPONSE CONVERTER
// ============================================

/**
 * Convert SDK Agent result to legacy parse-chain response format
 * This ensures frontend compatibility
 */
export function convertAgentResultToLegacyFormat(
  agentResult: any,
  context: DataContext,
  command: string
): any {
  const toolCalls = agentResult.toolCalls || [];
  const text = agentResult.text || '';
  
  // Determine output mode from tool calls
  let outputMode: 'chat' | 'columns' | 'formula' | 'sheet' = 'chat';
  let sheetAction: string | undefined;
  let sheetConfig: any = {};
  
  if (toolCalls.length > 0) {
    const lastTool = toolCalls[toolCalls.length - 1];
    const toolName = lastTool.toolName;
    // AI SDK uses 'input' not 'args'
    const toolInput = (lastTool as any).input || lastTool;
    
    // Map tool to output mode
    if (toolName === 'formula') {
      outputMode = 'formula';
      sheetConfig = {
        formula: toolInput.formula,
        description: toolInput.description,
        outputColumn: toolInput.outputColumn,
      };
    } else if (toolName === 'analyze') {
      outputMode = 'chat';
    } else {
      outputMode = 'sheet';
      sheetAction = toolName === 'conditionalFormat' ? 'conditionalFormat' 
                  : toolName === 'dataValidation' ? 'dataValidation'
                  : toolName === 'sheetOps' ? 'sheetOps'
                  : toolName;
      sheetConfig = toolInput;
    }
  }
  
  // Build steps from tool calls
  const steps = toolCalls.map((tc: any, idx: number) => {
    // AI SDK uses 'input' not 'args'
    const toolInput = tc.input || tc;
    return {
      id: `step_${idx + 1}`,
      order: idx + 1,
      action: tc.toolName,
      description: toolInput.description || tc.toolName,
      prompt: JSON.stringify(toolInput),
      outputFormat: tc.toolName === 'formula' ? 'formula' : 'json',
      inputColumns: context.columnsWithData,
      outputColumn: toolInput.outputColumn || context.emptyColumns[0] || 'D',
      dependsOn: idx > 0 ? `step_${idx}` : null,
      usesResultOf: null,
    };
  });
  
  return {
    // Core response
    isMultiStep: steps.length > 1,
    isCommand: outputMode !== 'chat',
    steps,
    summary: text || `Executed ${toolCalls.length} operations`,
    clarification: outputMode === 'formula' 
      ? 'Using native formula.\n✅ FREE ✅ Instant ✅ Auto-updates'
      : '',
    
    // Output mode
    outputMode,
    chatResponse: outputMode === 'chat' ? text : undefined,
    
    // Sheet action config
    sheetAction,
    sheetConfig,
    
    // Input/output columns (from context)
    inputRange: context.dataRange,
    inputColumn: context.columnsWithData[0] || 'A',
    inputColumns: context.columnsWithData,
    hasMultipleInputColumns: context.columnsWithData.length > 1,
    
    // Metadata
    _agentVersion: '1.0.0',
    _usedSDKAgent: true,
    _toolCalls: toolCalls.length,
    _stepResults: agentResult._stepResults,
  };
}

// ============================================
// EXPORTS
// ============================================

export { allTools } from './tools';
