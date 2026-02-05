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
  _stepResults?: Array<{ tool: string; result: any; evaluation?: any }>;
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
 * Create a SheetsAgent - uses tool loop with self-correction
 */
export function createSheetsAgent(model: LanguageModel, evaluatorModel: LanguageModel | null, context: DataContext) {
  const MAX_STEPS = 5;
  const MAX_RETRIES = 2;
  
  return {
    async generate({ prompt }: { prompt: string }): Promise<AgentResult> {
      const systemPrompt = buildAgentSystemPrompt(context);
      const stepResults: Array<{ tool: string; result: any; evaluation?: any }> = [];
      
      let currentPrompt = prompt;
      let allToolCalls: Array<{ toolName: string; args: Record<string, any> }> = [];
      let allToolResults: any[] = [];
      let finalText = '';
      let retryCount = 0;
      
      // Agent loop
      for (let step = 0; step < MAX_STEPS; step++) {
        console.log(`[SheetsAgent] Step ${step + 1}/${MAX_STEPS}`);
        
        // Generate with tools
        const result = await generateText({
          model,
          system: systemPrompt,
          prompt: currentPrompt,
          tools: allTools,
        });
        
        console.log('[SheetsAgent] Step result:', {
          hasText: !!result.text,
          toolCalls: result.toolCalls?.length || 0,
          finishReason: result.finishReason,
        });
        
        // Check if any tools were called
        if (!result.toolCalls || result.toolCalls.length === 0) {
          // No tool calls - agent is done (chat response or completed)
          finalText = result.text;
          break;
        }
        
        // Process tool calls
        for (const toolCall of result.toolCalls) {
          // AI SDK uses 'input' property for tool arguments
          const tc = toolCall as unknown as { toolName: string; toolCallId: string; input: Record<string, any> };
          
          allToolCalls.push({
            toolName: tc.toolName,
            args: tc.input, // AI SDK uses 'input' not 'args'
          });
          
          // Get tool result (tools execute synchronously and return structured data)
          const toolResult = result.toolResults?.find(
            (tr: any) => tr.toolCallId === tc.toolCallId
          );
          
          if (toolResult) {
            // AI SDK uses 'output' property for tool results
            const output = (toolResult as any).output;
            allToolResults.push(output);
            
            // Self-correction: Evaluate the tool result
            if (evaluatorModel) {
              try {
                const { object: evaluation } = await generateObject({
                  model: evaluatorModel,
                  schema: EvaluationSchema,
                  prompt: `Evaluate this Google Sheets tool execution:

Tool: ${tc.toolName}
Input: ${JSON.stringify(tc.input, null, 2)}
Result: ${JSON.stringify(output, null, 2)}

User's Goal: "${prompt}"
Context Headers: ${JSON.stringify(context.headers)}

Questions:
1. Does this achieve what the user wanted?
2. Any issues with parameters (wrong column, wrong range)?
3. Should we retry with different parameters?`,
                });
                
                stepResults.push({
                  tool: tc.toolName,
                  result: output,
                  evaluation,
                });
                
                console.log('[SheetsAgent] Evaluation:', {
                  tool: tc.toolName,
                  meetsGoal: evaluation.meetsGoal,
                  confidence: evaluation.confidence,
                  issues: evaluation.issues,
                });
                
                // Self-correction: If evaluation failed, retry with fix
                if (!evaluation.meetsGoal && evaluation.shouldRetry && retryCount < MAX_RETRIES) {
                  retryCount++;
                  console.log(`[SheetsAgent] Self-correction attempt ${retryCount}:`, evaluation.suggestedFix);
                  currentPrompt = `Previous attempt had issues: ${evaluation.issues.join(', ')}
Suggested fix: ${evaluation.suggestedFix || 'Try a different approach'}

Original request: ${prompt}

Please try again with the correction.`;
                  continue; // Go to next step with correction
                }
                
              } catch (evalError) {
                console.error('[SheetsAgent] Evaluation error:', evalError);
                // Continue without evaluation
                stepResults.push({
                  tool: tc.toolName,
                  result: output,
                });
              }
            } else {
              // No evaluator model - just record the result
              stepResults.push({
                tool: tc.toolName,
                result: output,
              });
            }
          }
        }
        
        // If we got here with tool results, we're done
        finalText = result.text || `Executed ${allToolCalls.length} operations`;
        break;
      }
      
      return {
        text: finalText,
        toolCalls: allToolCalls,
        toolResults: allToolResults,
        steps: stepResults.length,
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
    const toolArgs = lastTool.args;
    
    // Map tool to output mode
    if (toolName === 'formula') {
      outputMode = 'formula';
      sheetConfig = {
        formula: toolArgs.formula,
        description: toolArgs.description,
        outputColumn: toolArgs.outputColumn,
      };
    } else if (toolName === 'analyze') {
      outputMode = 'chat';
    } else {
      outputMode = 'sheet';
      sheetAction = toolName === 'conditionalFormat' ? 'conditionalFormat' 
                  : toolName === 'dataValidation' ? 'dataValidation'
                  : toolName === 'sheetOps' ? 'sheetOps'
                  : toolName;
      sheetConfig = toolArgs;
    }
  }
  
  // Build steps from tool calls
  const steps = toolCalls.map((tc: any, idx: number) => ({
    id: `step_${idx + 1}`,
    order: idx + 1,
    action: tc.toolName,
    description: tc.args.description || tc.toolName,
    prompt: JSON.stringify(tc.args),
    outputFormat: tc.toolName === 'formula' ? 'formula' : 'json',
    inputColumns: context.columnsWithData,
    outputColumn: tc.args.outputColumn || context.emptyColumns[0] || 'D',
    dependsOn: idx > 0 ? `step_${idx}` : null,
    usesResultOf: null,
  }));
  
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
