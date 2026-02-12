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
// NOTE: OpenAI strict JSON schema requires ALL properties in 'required'.
// Use .nullable() instead of .optional() for fields that may not always be present.
const EvaluationSchema = z.object({
  meetsGoal: z.boolean().describe('Does the result achieve what the user wanted?'),
  confidence: z.number().describe('Confidence score between 0 and 1'),
  issues: z.array(z.string()).describe('List of issues found, if any'),
  shouldRetry: z.boolean().describe('Should the agent try a different approach?'),
  suggestedFix: z.string().nullable().describe('How to fix the issue, or null if no fix needed'),
});

// ============================================
// AGENT INSTRUCTIONS
// ============================================

function buildAgentSystemPrompt(context: DataContext, skillInstructions?: string): string {
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

**CRITICAL — Fuzzy Column Matching**: Users often refer to columns by approximate names (e.g., "Revenue" when the column is "Sales", "Q1_Revenue" when it's "Q1_Sales", "Name" when it's "Company", "Date" when it's "Founded"). When the exact name doesn't match:
1. Find the closest matching column by semantic similarity (Revenue≈Sales, Amount≈Total, Name≈Company, etc.)
2. Use it and proceed with the action — DO NOT refuse or fall back to analyze
3. If some requested columns exist and others don't, use the available ones and note what was missing
4. Only use "analyze" to explain when NO plausible column match exists at all

### 2. Formula First
For any task involving calculations, rankings, aggregations, or lookups - USE NATIVE FORMULAS:
- They execute instantly, are free, and auto-update
- Only use "analyze" for subjective questions requiring AI judgment (insights, patterns, recommendations)

### 3. Column Type Awareness
- **Text columns** (names, categories, labels): Use for chart domains, grouping, filtering criteria
- **Numeric columns** (amounts, counts, %): Use for chart data, calculations, conditional formatting comparisons
- Never mix them incorrectly (e.g., don't chart text as data values)

### 4. Range Construction
Build ALL ranges dynamically from the context above — never hardcode column letters or row numbers.
- Filters: Must include headers → FULL_RANGE: ${fullRangeWithHeaders}
- Data formatting/conditional formatting: → DATA_RANGE: ${context.dataRange}
- Header formatting only: → HEADER_ROW: ${headerRowRange}
- Single column range: Combine column letter + start row + ":" + column letter + end row (e.g., if col is "C" and data rows are ${context.dataStartRow}-${context.dataEndRow} → C${context.dataStartRow}:C${context.dataEndRow})

### 5. Multi-Part Execution
When the user asks for multiple things in one request (e.g. "create a chart AND tell me the top performers"),
call MULTIPLE tools — one for each distinct task. NEVER refuse or ask for clarification on multi-part requests.
Break them into separate tool calls and execute them all.

### 6. Action Over Clarification — ALWAYS USE TOOLS
You MUST always call at least one tool. NEVER respond with only text.
- If you can infer what the user wants from context, execute it immediately with tools.
- For open-ended questions or analysis requests, use the "analyze" tool.
- For multi-part requests, call multiple tools (one per distinct task).
- Users STRONGLY prefer results over questions. DO NOT ask for clarification.
- **ATTEMPT WITH BEST-AVAILABLE DATA**: If a user requests an action (chart, format, etc.) but some columns don't exist, USE the closest matching columns and execute the action. Only fall back to "analyze" when the request is genuinely impossible (e.g., all columns missing). Partial execution is ALWAYS better than refusal.

## Tool-Specific Guidance

**formula** — Native Sheets formulas:
- Use \`{{ROW}}\` as a placeholder for the row number. The system replaces it per-row automatically.
- Set outputColumn to the first EMPTY_COLUMN, startRow/endRow from DATA_RANGE.
- Provide a "description" that becomes the column header (e.g., "Total Sales", "Growth %").
- For referencing other columns: use the column letter + \`{{ROW}}\` (e.g., \`C{{ROW}}\`, \`D{{ROW}}\`).
- **IMPORTANT**: When the formula produces monetary values (prices, sales, bonuses, costs, revenue), ALSO call the **format** tool with \`formatType: "currency"\` on the output column. When it produces percentages, format with \`formatType: "percent"\`. Raw formula output has no formatting — always pair with a format call for user-facing numeric results.

**format** — Cell styling:
- Include the complete range and all desired style properties.
- When formatting "all data" or "everything", use DATA_RANGE.
- When formatting headers, use HEADER_ROW.
- For number formats: use \`numberFormat\` (e.g., "$#,##0.00" for currency, "0.0%" for percent).

**chart** — Visualizations:
- domainColumn = the label/category column (look for 'text' type in COLUMN_TYPES)
- dataColumns = the numeric columns to plot (look for 'numeric' type in COLUMN_TYPES)
- Choose chart type based on data relationship:
  - Comparisons across categories → column or bar
  - Trends over time/sequence → line or area
  - Part-to-whole → pie (single series only)
  - Correlation between two variables → scatter
  - Combo (mixed types) → combo with seriesType per column
- seriesNames = readable labels derived from header names
- **IMPORTANT**: If user mentions column names that don't exactly match but similar columns exist (e.g., "Revenue" → "Sales"), use the matching columns and proceed. Create the chart with all available matching data rather than refusing.

**conditionalFormat** — Highlight cells/rows based on conditions:
- Available rule types: greaterThan, lessThan, between, equalTo, textContains, customFormula, colorScale
- **Simple threshold** (one column vs a fixed value): Use greaterThan/lessThan/between with \`value\` field
- **Cross-column comparison** (one column vs another column): Use \`customFormula\` — this is the ONLY way to compare two columns dynamically
- **customFormula syntax**: \`=\$[COL_LETTER]${context.dataStartRow}[operator]\$[COL_LETTER]${context.dataStartRow}\` — use \$ before column letters (absolute column) but plain row number (relative row). The row number must match the first row in the range.
- **Row highlighting**: Set range to full data width (DATA_RANGE) so the entire row is colored
- **Column highlighting**: Set range to only that column's data range
- **Text match**: Use textContains for simple matching, or customFormula \`=\$[COL]${context.dataStartRow}="exact value"\`
- ALWAYS provide \`backgroundColor\` on every rule (hex color strings)
- ALWAYS provide the \`formula\` field when using customFormula type
- **Readability**: When using dark or saturated background colors, also set \`textColor\` to a contrasting color (e.g., white "#FFFFFF" text on dark red/green backgrounds). This ensures highlighted rows remain readable.

**filter** — Show/hide rows:
- Range MUST include the header row (use FULL_RANGE: \`${fullRangeWithHeaders}\`)

**dataValidation** — Dropdowns, checkboxes, input constraints:
- Set range to the target column's data range
- For dropdowns: set validationType to "list" with values array
- For checkboxes: set validationType to "checkbox"

**sheetOps** — Sheet-level operations:
- Supports: freezeRows, freezeColumns, sort, hideColumns, hideRows, autoResize, protectRange
- For sort: specify the column letter and ascending/descending

**writeData** — Insert raw data into cells:
- Set startCell to where data begins
- Provide data as a 2D array (rows × columns)
- If data includes headers, start at row 1; if data-only, start at the next empty row

**table** — Create formatted data table:
- Set range to include headers and data
- Use applyBanding for alternating row colors

**analyze** — AI-powered analysis (chat response, NOT written to cells):
- Use ONLY for subjective/interpretive questions the user asks (insights, patterns, comparisons, recommendations)
- The response appears in the chat, not in the spreadsheet
- Provide a specific "question" field describing exactly what to analyze

## Output Quality
- Always provide a brief "description" parameter — it shows in the user's task progress UI
- Make descriptions specific (what this step does), not generic labels
- Derive column letters, row numbers, and ranges from the live context above — NEVER guess or hardcode

## Transparent Communication
ALWAYS include a brief text explanation alongside your tool calls describing:
1. **What you did**: The action and specific columns/ranges targeted
2. **Column mapping**: If the user's column names didn't exactly match, explain what you mapped (e.g., "Used 'Q1_Sales' column for your 'Q1_Revenue' reference")
3. **What was skipped**: If any part of the request couldn't be fulfilled, explain why and what you did instead
4. **Result summary**: Brief description of the outcome (e.g., "Created a combo chart with Q1_Sales and Q2_Sales as columns")
This text appears in the user's chat as context for the action taken.${skillInstructions ? `

## Expert Skill Knowledge
The following expert guidelines provide detailed capabilities, options, and best practices for the tool(s) relevant to this task. Use this knowledge when deciding WHICH options and parameters to use — the exact parameter format is defined by the tool schemas above.

${skillInstructions}` : ''}`;
}

// ============================================
// CREATE AGENT
// ============================================

/**
 * Create a SheetsAgent - simplified for declarative tools
 * 
 * @param model - AI model to use
 * @param evaluatorModel - Model for self-correction evaluation (null to disable)
 * @param context - Live spreadsheet data context
 * @param options - Agent configuration
 * @param options.maxAttempts - Max self-correction attempts (default: 2)
 * @param options.timeoutMs - Timeout in ms (default: 45000)
 * @param options.skillInstructions - Expert skill instructions to inject into system prompt
 */
export function createSheetsAgent(
  model: LanguageModel, 
  evaluatorModel: LanguageModel | null, 
  context: DataContext,
  options?: { maxAttempts?: number; timeoutMs?: number; skillInstructions?: string }
) {
  return {
    async generate({ prompt }: { prompt: string }): Promise<AgentResult> {
      const startTime = Date.now();
      const systemPrompt = buildAgentSystemPrompt(context, options?.skillInstructions);
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
        // CRITICAL: toolChoice 'required' ensures the model ALWAYS calls at least one tool.
        // This prevents the model from returning text-only clarification responses.
        // The 'analyze' tool covers open-ended questions, so there's always an appropriate tool.
        result = await generateText({
          model,
          system: systemPrompt,
          prompt: attempt === 1 ? prompt : `${prompt}

IMPORTANT: Previous attempt had issues. Please fix:
${stepResults.filter(sr => sr.evaluation && !sr.evaluation.meetsGoal)
  .map(sr => `- ${sr.tool}: ${sr.evaluation?.issues?.join(', ')}`)
  .join('\n')}`,
          tools: allTools,
          toolChoice: 'required',
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
      // Also set config for GAS compatibility (GAS checks config.rules first)
      step.config = {
        range: toolInput.range,
        rules: toolInput.rules,
      };
      console.log('[convertAgentResultToLegacyFormat] ConditionalFormat rules:', JSON.stringify(toolInput.rules).substring(0, 300));
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
