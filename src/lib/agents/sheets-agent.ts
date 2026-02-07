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
  confidence: z.number().describe('Confidence score between 0 and 1'),
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
- Columns with Data: ${context.columnsWithData?.join(', ') || Object.keys(context.headers).join(', ')}
- Data Range (without headers): ${context.dataRange}
- Full Range (with headers, for filters): ${context.columnsWithData?.length > 0 ? `${context.columnsWithData[0]}1:${context.columnsWithData[context.columnsWithData.length - 1]}${context.dataEndRow}` : 'A1:G31'}
- Header Row Range: ${Object.keys(context.headers).length > 0 ? `${Object.keys(context.headers)[0]}1:${Object.keys(context.headers).slice(-1)[0]}1` : 'A1:G1'}
- Row Count: ${context.rowCount}
- Data Rows: ${context.dataStartRow} to ${context.dataEndRow}
- Empty Columns (for output): ${context.emptyColumns.slice(0, 5).join(', ')}
- Sample Data: ${JSON.stringify(context.sampleData)}

## Golden Rules
1. **Formula First**: For calculable tasks, use native formulas - they're FREE, instant, and auto-update.
   - Ranking/sorting → SORT(), LARGE(), SMALL(), QUERY()
   - Aggregation by category → SUMIF(), COUNTIF(), AVERAGEIF(), QUERY()
   - Lookups → VLOOKUP(), INDEX/MATCH, FILTER()
   - Only use "analyze" for open-ended questions requiring AI interpretation
2. **Use Context**: Map user's column references to actual column letters from the headers object above.
   - Look up column names in the Headers to find the correct letter
   - User says "sales column" → find which column header contains "sales"
3. **Replacing vs Adding**:
   - "Turn X into formula" or "convert column" → use the EXISTING column
   - "Add a new column" or "create column" → use first EMPTY column
4. **Respect User Values**: Use exact numbers, text, colors, and options the user specifies.
5. **Format ALL Columns**: When formatting "headers" or "the data", include ALL data columns.
   - Data range: ${context.dataRange}
   - Header row: row 1 across all columns with data
6. **Filter Range**: Filters require the header row. Range MUST start at row 1 and include all columns.
7. **Table Action**: The table tool adds filter, banding, and formatting automatically.
8. **Conditional Formatting - Row Highlighting**: For highlighting entire rows based on column comparisons:
   - Use type: "customFormula" with a comparison formula
   - Range: cover ALL columns (full row width), starting from row 2
   - Formula syntax: Use $ to lock column references, leave row relative
   - Pattern: =\$[col1][row]>[col2][row] where [col1] and [col2] are column letters
9. **Multi-Part Requests**: When user asks "do X AND Y", call MULTIPLE tools to accomplish ALL parts.
10. **Charts - Column Selection**: Identify column types from headers:
    - domainColumn: The TEXT/LABEL column (names, dates, categories) - typically first column or the one user wants on X-axis
    - dataColumns: ONLY NUMERIC columns (amounts, counts, percentages) - what to plot as bars/lines
    - seriesNames: User-friendly labels for the legend (derive from header names)
    - CRITICAL: Never include text-only columns in dataColumns - causes chart errors

## Response Guidelines
1. **PREFER ACTION over clarification**: If you can make a reasonable interpretation, DO IT. Users prefer results over questions.
2. **Multi-part requests**: When user asks for multiple things, call MULTIPLE tools to accomplish ALL parts.
3. **When task is clear**: Call the appropriate tool(s) with COMPLETE parameters.
4. **Only ask for clarification** when CRITICAL information is missing and NO reasonable default exists:
   - GOOD: "Create a formula" (what formula? for what purpose?)
   - BAD: Asking to clarify when all needed info is in the context or request
5. **Charts**: You CAN create charts! Use the chart tool for any visualization request.
6. **After completing**: Briefly summarize what was done.

## Important
- ALWAYS include ALL required parameters when calling tools
- For formulas: include the exact formula string, output column, and description
- For formatting: include the exact range and all style options
- For charts:
  - domainColumn: Identify the TEXT column from headers (names, dates, labels) for X-axis
  - dataColumns: Identify NUMERIC columns from headers (numbers, amounts) - the values to plot
  - seriesNames: Create readable labels based on the header names you're charting
  - title: Descriptive title based on what's being visualized
  - NEVER put text-only columns in dataColumns
- Never leave parameters empty or use placeholders

## Step Descriptions (CRITICAL for UI)
When calling tools, always include a brief, user-friendly "description" parameter (10-50 chars) that explains what this specific step does:
- GOOD: "Format header with bold blue", "Apply currency to sales", "Add filter dropdowns"
- BAD: "format", "step 1", "formatting data"
If a tool has a description parameter, provide a meaningful one - this is shown to users in the UI.`;
}

// ============================================
// CREATE AGENT
// ============================================

/**
 * Create a SheetsAgent - simplified for declarative tools
 */
export function createSheetsAgent(
  model: LanguageModel, 
  evaluatorModel: LanguageModel | null, 
  context: DataContext,
  options?: { maxAttempts?: number; timeoutMs?: number }
) {
  return {
    async generate({ prompt }: { prompt: string }): Promise<AgentResult> {
      const startTime = Date.now();
      const systemPrompt = buildAgentSystemPrompt(context);
      const maxAttempts = options?.maxAttempts || 2;
      const timeoutMs = options?.timeoutMs || 45000; // 45s default (leave buffer for Vercel's 60s)
      let attempt = 0;
      let result: any;
      let toolCalls: any[] = [];
      let stepResults: Array<{ tool: string; params: any; evaluation?: any }> = [];
      let allIssuesResolved = false;
      
      // Helper to check timeout
      const checkTimeout = () => {
        const elapsed = Date.now() - startTime;
        if (elapsed > timeoutMs) {
          console.warn(`[SheetsAgent] Timeout after ${elapsed}ms - returning current result`);
          return true;
        }
        return false;
      };
      
      // Self-correction loop
      while (attempt < maxAttempts && !allIssuesResolved) {
        // Check timeout before starting new attempt
        if (attempt > 0 && checkTimeout()) {
          console.log('[SheetsAgent] Skipping retry due to timeout');
          break;
        }
        
        attempt++;
        console.log(`[SheetsAgent] Attempt ${attempt}/${maxAttempts}...`);
        
        // Generate with tools
        result = await generateText({
          model,
          system: systemPrompt,
          prompt: attempt === 1 ? prompt : `${prompt}

IMPORTANT: Previous attempt had issues. Please fix:
${stepResults.filter(sr => sr.evaluation && !sr.evaluation.meetsGoal)
  .map(sr => `- ${sr.tool}: ${sr.evaluation?.issues?.join(', ')}`)
  .join('\n')}`,
          tools: allTools,
        });
        
        console.log('[SheetsAgent] Generation complete:', {
          attempt,
          hasText: !!result.text,
          toolCalls: result.toolCalls?.length || 0,
          finishReason: result.finishReason,
        });
        
        // Extract tool calls
        toolCalls = (result.toolCalls || []).map((tc: any) => ({
          toolName: tc.toolName,
          args: tc.input || {},  // AI SDK uses 'input' property
        }));
        
        // Evaluate if we have an evaluator model
        // IMPORTANT: Evaluate ALL tools TOGETHER as a workflow, not individually!
        // Multi-tool workflows are expected - each tool handles part of the goal
        stepResults = [];
        
        // Skip evaluation in these cases:
        // 1. No evaluator model
        // 2. No tool calls
        // 3. Timeout approaching
        // 4. Simple single-tool "formula" calls (usually correct)
        const shouldSkipEvaluation = 
          !evaluatorModel || 
          toolCalls.length === 0 ||
          checkTimeout() ||
          (toolCalls.length === 1 && toolCalls[0].toolName === 'formula');
        
        if (shouldSkipEvaluation) {
          if (toolCalls.length === 1 && toolCalls[0].toolName === 'formula') {
            console.log('[SheetsAgent] Skipping evaluation for simple formula tool');
          } else if (checkTimeout()) {
            console.log('[SheetsAgent] Skipping evaluation due to timeout');
          }
          allIssuesResolved = true;
          for (const tc of toolCalls) {
            stepResults.push({
              tool: tc.toolName,
              params: tc.args,
              evaluation: { meetsGoal: true, confidence: 0.8, issues: [] },
            });
          }
        } else if (evaluatorModel && toolCalls.length > 0) {
          console.log(`[SheetsAgent] Evaluating ${toolCalls.length} tool calls as a workflow...`);
          
          try {
            // Build a summary of all tool calls for evaluation
            const workflowSummary = toolCalls.map((tc, i) => 
              `${i + 1}. ${tc.toolName}: ${JSON.stringify(tc.args)}`
            ).join('\n');
            
            const { object: evaluation } = await generateObject({
              model: evaluatorModel,
              schema: EvaluationSchema,
              prompt: `Evaluate this COMPLETE WORKFLOW of Google Sheets tool calls:

User's Goal: "${prompt}"

Spreadsheet Context:
- Headers: ${JSON.stringify(context.headers)}
- Data Range: ${context.dataRange}

WORKFLOW (${toolCalls.length} tool calls):
${workflowSummary}

IMPORTANT EVALUATION RULES:
- This is a MULTI-TOOL workflow where each tool handles PART of the goal
- Do NOT reject a tool just because it doesn't do everything
- Evaluate if the COMBINATION of all tools achieves the user's goal
- Only report issues if parameters are WRONG (wrong column, wrong range, wrong values)
- Accept if tools correctly split the work (e.g., one tool for headers, another for data)

Questions:
1. Does the COMBINATION of these tools achieve the user's goal?
2. Are the column letters correct (check against headers)?
3. Are the ranges appropriate?
4. Are there any actual parameter errors (not just "incomplete" - that's expected for multi-tool)?`,
            });
            
            // Apply the workflow evaluation to all tools
            for (const tc of toolCalls) {
              stepResults.push({
                tool: tc.toolName,
                params: tc.args,
                evaluation,  // Same evaluation for all (workflow-level)
              });
            }
            
            console.log('[SheetsAgent] Workflow evaluation:', {
              toolCount: toolCalls.length,
              tools: toolCalls.map(tc => tc.toolName),
              meetsGoal: evaluation.meetsGoal,
              confidence: evaluation.confidence,
              issues: evaluation.issues,
            });
            
            allIssuesResolved = evaluation.meetsGoal;
            
          } catch (evalError) {
            console.error('[SheetsAgent] Evaluation error:', evalError);
            // If evaluator fails, assume it's ok and continue
            for (const tc of toolCalls) {
              stepResults.push({
                tool: tc.toolName,
                params: tc.args,
                evaluation: { meetsGoal: true, confidence: 0.5, issues: ['Evaluation skipped'] },
              });
            }
            allIssuesResolved = true;
          }
          
          if (allIssuesResolved) {
            console.log('[SheetsAgent] ✅ Workflow passed evaluation');
          } else if (attempt < maxAttempts) {
            console.log('[SheetsAgent] ⚠️ Issues found, retrying...');
          } else {
            console.log('[SheetsAgent] ⚠️ Max attempts reached, proceeding with current result');
          }
        }
        // Note: shouldSkipEvaluation already handles !evaluatorModel and toolCalls.length === 0
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
  let needsClarification = false;
  let clarificationContext: any = null;
  
  // If no tools called, agent is asking for clarification or providing analysis
  if (toolCalls.length === 0) {
    needsClarification = true;
    clarificationContext = {
      originalCommand: command,
      agentResponse: text,
      availableData: {
        headers: context.headers,
        dataRange: context.dataRange,
        rowCount: context.rowCount,
        emptyColumns: context.emptyColumns,
      },
      reason: 'Agent needs more information to proceed',
    };
    console.log('[convertAgentResultToLegacyFormat] No tools called - clarification needed:', {
      textLength: text.length,
      textPreview: text.substring(0, 200),
    });
  }
  
  if (toolCalls.length > 0) {
    const lastTool = toolCalls[toolCalls.length - 1];
    const toolName = lastTool.toolName;
    // Agent stores params as 'args' (mapped from SDK's 'input')
    const toolInput = (lastTool as any).args || lastTool;
    
    // IMPORTANT: For MULTIPLE tool calls, use 'columns' mode to execute step-by-step
    // Only use 'sheet' shortcut for SINGLE tool calls (instant execution)
    const useStepByStep = toolCalls.length > 1;
    
    if (useStepByStep) {
      // Multi-tool workflow - frontend will execute each step
      outputMode = 'columns';  // This triggers step-by-step execution
      console.log('[convertAgentResultToLegacyFormat] Multi-tool workflow detected, using step-by-step execution');
    } else if (toolName === 'formula') {
      outputMode = 'formula';
      sheetConfig = {
        formula: toolInput.formula,
        description: toolInput.description,
        outputColumn: toolInput.outputColumn,
        startRow: toolInput.startRow,
        endRow: toolInput.endRow,
        // Include all parameters
        ...toolInput,
      };
    } else if (toolName === 'analyze') {
      outputMode = 'chat';
    } else if (toolName === 'chart') {
      outputMode = 'sheet';
      sheetAction = 'chart';
      sheetConfig = {
        chartType: toolInput.chartType,
        dataRange: toolInput.dataRange,
        title: toolInput.title,
        position: toolInput.position,
        ...toolInput,
      };
    } else if (toolName === 'format') {
      outputMode = 'sheet';
      sheetAction = 'format';
      sheetConfig = {
        range: toolInput.range,
        formatType: toolInput.formatType,
        options: toolInput.options,
        operations: toolInput.operations,
        ...toolInput,
      };
    } else {
      // Single tool - use sheet shortcut for instant execution
      outputMode = 'sheet';
      sheetAction = toolName;
      // Preserve ALL tool parameters in sheetConfig
      sheetConfig = { ...toolInput };
    }
  }
  
  // Build steps from tool calls
  // CRITICAL: Preserve ALL tool parameters for frontend execution
  const steps = toolCalls.map((tc: any, idx: number) => {
    // Agent stores params as 'args' (mapped from SDK's 'input')
    const toolInput = tc.args || tc;
    const toolName = tc.toolName;
    
    // Base step structure
    const step: any = {
      id: `step_${idx + 1}`,
      order: idx + 1,
      action: toolName,
      description: toolInput.description || toolName,
      prompt: command,  // Original user command (context for AI if needed)
      
      // CRITICAL: Spread ALL tool parameters directly into step
      // This ensures frontend has full access to every parameter
      ...toolInput,
      
      // GAS expects step.config for sheet actions - store full config
      config: toolInput,
      
      // Also store as toolCall for structured access
      toolCall: toolInput,
      
      // Standard step fields
      inputColumns: context.columnsWithData,
      dependsOn: idx > 0 ? `step_${idx}` : null,
      usesResultOf: null,
    };
    
    // Set output format based on tool type
    if (toolName === 'formula') {
      step.outputFormat = 'formula';
      step.outputColumn = toolInput.outputColumn || context.emptyColumns[0] || 'H';
      // CRITICAL: Explicitly ensure formula is set (for GAS to detect)
      step.formula = toolInput.formula;
      step.startRow = toolInput.startRow || context.dataStartRow || 2;
      step.endRow = toolInput.endRow || context.dataEndRow || (context.dataStartRow + context.rowCount - 1);
      console.log('[convertAgentResultToLegacyFormat] Formula step:', {
        formula: step.formula,
        outputColumn: step.outputColumn,
        startRow: step.startRow,
        endRow: step.endRow,
      });
    } else if (toolName === 'analyze') {
      step.outputFormat = 'chat';
    } else if (toolName === 'chart') {
      step.outputFormat = 'chart';
      // Chart-specific: ensure position is set
      step.chartType = toolInput.chartType;
      step.dataRange = toolInput.dataRange;
      step.title = toolInput.title;
    } else if (toolName === 'format') {
      step.outputFormat = 'format';
      // Format-specific: ensure range and options are accessible
      step.range = toolInput.range;
      step.formatType = toolInput.formatType;
      step.formatOptions = toolInput.options;
    } else if (toolName === 'conditionalFormat') {
      step.outputFormat = 'conditionalFormat';
      step.range = toolInput.range;
      step.rules = toolInput.rules;
    } else if (toolName === 'dataValidation') {
      step.outputFormat = 'dataValidation';
      step.range = toolInput.range;
      step.validationType = toolInput.validationType;
    } else if (toolName === 'filter') {
      step.outputFormat = 'filter';
      step.range = toolInput.range;
      step.criteria = toolInput.criteria;
    } else if (toolName === 'sheetOps') {
      step.outputFormat = 'sheetOps';
      step.operation = toolInput.operation;
    } else if (toolName === 'writeData') {
      step.outputFormat = 'writeData';
      step.startCell = toolInput.startCell;
      step.data = toolInput.data;
    } else if (toolName === 'table') {
      step.outputFormat = 'table';
      step.range = toolInput.range;
    } else {
      step.outputFormat = 'json';
      step.outputColumn = toolInput.outputColumn || context.emptyColumns[0] || 'H';
    }
    
    return step;
  });
  
  // Log conversion for debugging
  console.log('[convertAgentResultToLegacyFormat] Converted:', {
    outputMode,
    sheetAction,
    stepCount: steps.length,
    needsClarification,
    sheetConfigKeys: Object.keys(sheetConfig),
    steps: steps.map((s: any) => ({
      action: s.action,
      hasFormula: !!s.formula,
      hasRange: !!s.range,
      outputFormat: s.outputFormat,
    })),
  });
  
  // Build appropriate clarification message
  let clarificationMessage = '';
  if (outputMode === 'formula') {
    clarificationMessage = 'Using native formula.\n✅ FREE ✅ Instant ✅ Auto-updates';
  } else if (needsClarification) {
    clarificationMessage = 'I need more information to complete this task.';
  }
  
  return {
    // Core response
    isMultiStep: steps.length > 1,
    isCommand: outputMode !== 'chat' && !needsClarification,
    steps,
    summary: text || `Executed ${toolCalls.length} operations`,
    clarification: clarificationMessage,
    
    // Output mode
    outputMode,
    
    // Chat/clarification response - include full text and context
    chatResponse: outputMode === 'chat' ? text : undefined,
    needsClarification,
    clarificationContext: needsClarification ? clarificationContext : undefined,
    
    // If clarification needed, provide helpful context for UI
    ...(needsClarification && {
      // Include what the agent understood/is asking
      agentMessage: text,
      // Include data context so user knows what's available
      dataContext: {
        headers: context.headers,
        columns: context.columnsWithData,
        rowCount: context.rowCount,
        emptyColumns: context.emptyColumns.slice(0, 3),
      },
    }),
    
    // Sheet action config (only if tools were called)
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
