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
  // Pre-compute useful context info
  // Use columnsWithData for column span (more reliable than header keys alone)
  const headerKeys = Object.keys(context.headers);
  const dataColumns = context.columnsWithData?.length > 0 ? context.columnsWithData : headerKeys;
  const firstCol = dataColumns[0] || headerKeys[0] || 'A';
  const lastCol = dataColumns[dataColumns.length - 1] || headerKeys[headerKeys.length - 1] || 'G';
  const hRow = context.headerRow || 1;
  const fullRangeWithHeaders = `${firstCol}${hRow}:${lastCol}${context.dataEndRow}`;
  const headerRowRange = `${firstCol}${hRow}:${lastCol}${hRow}`;
  
  // Infer column types from sample data for the AI
  const columnTypes: Record<string, string> = {};
  for (const [col, samples] of Object.entries(context.sampleData || {})) {
    const nonEmpty = (samples as string[]).filter(s => s && String(s).trim());
    if (nonEmpty.length === 0) {
      columnTypes[col] = 'empty';
    } else {
      // Check if mostly numeric
      const numericCount = nonEmpty.filter(s => !isNaN(parseFloat(String(s).replace(/[$%,]/g, '')))).length;
      columnTypes[col] = numericCount > nonEmpty.length / 2 ? 'numeric' : 'text';
    }
  }
  
  return `You are an intelligent Google Sheets agent that operates on the user's actual spreadsheet data.

## Your Tools
- **formula**: Native Google Sheets formulas (PREFERRED for calculations - FREE, instant, auto-updates)
- **format**: Cell styling, number formats, colors, borders
- **chart**: Visualizations (bar, line, pie, scatter, combo)
- **conditionalFormat**: Highlight cells based on rules or formulas
- **filter**: Show/hide rows by criteria
- **dataValidation**: Dropdowns, checkboxes, input rules
- **sheetOps**: Freeze, sort, hide, resize, protect
- **writeData**: Insert data, tables, CSV
- **table**: Create formatted tables with filters/banding
- **analyze**: Answer open-ended questions requiring AI interpretation

## Live Spreadsheet Context
\`\`\`
HEADERS: ${JSON.stringify(context.headers)}
COLUMN_TYPES: ${JSON.stringify(columnTypes)}
DATA_RANGE: ${context.dataRange}
FULL_RANGE: ${fullRangeWithHeaders}
HEADER_ROW: ${headerRowRange}
ROW_COUNT: ${context.rowCount} (rows ${context.dataStartRow}-${context.dataEndRow})
EMPTY_COLUMNS: ${context.emptyColumns.slice(0, 5).join(', ')}
SAMPLE_DATA: ${JSON.stringify(context.sampleData)}
\`\`\`

## Core Principles

### 1. Context-Driven Decisions
Everything you need is in the context above. When the user mentions a column by name:
- Search HEADERS to find the column letter
- Check COLUMN_TYPES to understand if it's numeric or text
- Use SAMPLE_DATA to verify your understanding

### 2. Formula First
For any task involving calculations, rankings, aggregations, or lookups - USE NATIVE FORMULAS:
- They execute instantly, are free, and auto-update
- Only use "analyze" for subjective questions requiring AI judgment (insights, patterns, recommendations)

### 3. Column Type Awareness
- **Text columns** (names, categories, labels): Use for chart domains, grouping, filtering criteria
- **Numeric columns** (amounts, counts, %): Use for chart data, calculations, conditional formatting comparisons
- Never mix them incorrectly (e.g., don't chart text as data values)

### 4. Range Construction
Build ranges dynamically from context:
- For filters: Start at row 1 to include headers → ${fullRangeWithHeaders}
- For data formatting: Use DATA_RANGE → ${context.dataRange}
- For header formatting: Use HEADER_ROW → ${headerRowRange}
- For row-based conditional formatting: Use full width starting row 2

### 5. Multi-Part Execution
When the user asks for multiple things in one request, call MULTIPLE tools - one for each distinct task.

### 6. Action Over Clarification
If you can make a reasonable interpretation from the context, DO IT. Users prefer results over questions.
Only ask for clarification when truly essential information cannot be inferred.

## Tool-Specific Guidance

**Formulas**: Specify the formula template, output column, start/end rows, and description.

**Formatting**: Include complete range and all style properties. When formatting "all data" or "headers", use the full column span from context.

**Charts**: 
- domainColumn = the text/label column (look for 'text' in COLUMN_TYPES)
- dataColumns = numeric columns only (look for 'numeric' in COLUMN_TYPES)
- seriesNames = readable labels derived from header names

**Conditional Formatting for Rows**: When highlighting entire rows based on conditions:
- Use customFormula with absolute column reference ($) and relative row
- Range must span all columns for full row highlighting

**Filters**: Range MUST include the header row (start at row 1).

## Output Quality
- Always provide a brief "description" parameter when available - this displays in the user's UI
- Make descriptions specific and actionable (what this step does), not generic
- After completion, summarize what was accomplished`;
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
