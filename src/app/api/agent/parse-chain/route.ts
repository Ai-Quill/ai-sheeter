/**
 * @file /api/agent/parse-chain
 * @version 6.0.0
 * @updated 2026-01-20
 * 
 * CHANGELOG:
 * - 6.0.0 (2026-01-20): Complete redesign with few-shot learning
 *   - Uses semantic search to find similar successful workflows
 *   - Few-shot prompting with concrete examples
 *   - Minimal validation - trust AI with good input
 *   - Learning from successful workflows
 * 
 * ============================================
 * INTELLIGENT WORKFLOW GENERATION
 * ============================================
 * 
 * Core principle: Give AI excellent input, trust its output.
 * 
 * Flow:
 * 1. Generate embedding for user command
 * 2. Find similar successful workflows from memory
 * 3. Build few-shot prompt with best examples
 * 4. Generate workflow with AI
 * 5. Light validation only
 * 6. Return (learning happens when user accepts)
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';

// SIMPLIFIED: No longer using embeddings or DB lookups
// import { generateEmbedding } from '@/lib/ai/embeddings';
// import { findSimilarWorkflowsByEmbedding, getBaseExamplesFromDB, StoredWorkflow } from '@/lib/workflow-memory';
import { StoredWorkflow } from '@/lib/workflow-memory'; // Only type needed
import { buildSmartPrompt, DataContext } from '@/lib/workflow-memory/prompt-builder';
import { analyzeRequest } from '@/lib/skills';
import { authenticateRequest, getAuthErrorStatus, createAuthErrorResponse } from '@/lib/auth/auth-service';
import { getModel } from '@/lib/ai/models';
import { supabaseAdmin } from '@/lib/supabase';
// SIMPLIFIED: Intent classification disabled - AI handles from instructions
// import { classifyIntent, IntentClassification } from '@/lib/intent';
import type { IntentClassification } from '@/lib/intent'; // Only type needed
import { normalizeSheetResponse } from '@/lib/response';
import { getSkillById, GoogleSheetSkill } from '@/lib/skills';

// SIMPLIFIED: Intent classification disabled
// Modern LLMs understand intent from skill instructions alone.
// This removes embedding generation and cache lookups.
const USE_UNIFIED_INTENT = false;

// ============================================
// SDK AGENT FEATURE FLAG
// ============================================
// Enable the new AI SDK ToolLoopAgent with self-correction
// Set USE_SDK_AGENT=true in environment to enable
const USE_SDK_AGENT = process.env.USE_SDK_AGENT === 'true';

import { createSheetsAgent, convertAgentResultToLegacyFormat, type DataContext as AgentDataContext } from '@/lib/agents';

// ============================================
// COLUMN UTILITIES (NO HARDCODED VALUES)
// ============================================

/**
 * Convert column letter to number (A=1, B=2, Z=26, AA=27, etc.)
 */
function columnLetterToNumber(col: string): number {
  let result = 0;
  for (let i = 0; i < col.length; i++) {
    result = result * 26 + (col.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
  }
  return result;
}

/**
 * Convert column number to letter (1=A, 2=B, 26=Z, 27=AA, etc.)
 */
function columnNumberToLetter(num: number): string {
  let result = '';
  while (num > 0) {
    const remainder = (num - 1) % 26;
    result = String.fromCharCode('A'.charCodeAt(0) + remainder) + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
}

/**
 * Get the next N empty columns after the given data columns
 * @param dataColumns - Columns that contain data (e.g., ['A', 'B', 'C'])
 * @param count - Number of empty columns to generate
 * @returns Array of empty column letters
 */
function getEmptyColumnsAfter(dataColumns: string[], count: number = 10): string[] {
  if (dataColumns.length === 0) {
    // If no data columns provided, start from 'A'
    return Array.from({ length: count }, (_, i) => columnNumberToLetter(i + 1));
  }
  
  // Find the highest column number
  const maxColNum = Math.max(...dataColumns.map(columnLetterToNumber));
  
  // Generate empty columns starting after the last data column
  return Array.from({ length: count }, (_, i) => columnNumberToLetter(maxColNum + i + 1));
}

/**
 * Generate a range in A1 notation
 * @param startCol - Starting column letter
 * @param endCol - Ending column letter
 * @param startRow - Starting row number
 * @param endRow - Ending row number
 * @returns Range string (e.g., "A2:C11")
 */
function buildRange(startCol: string, endCol: string, startRow: number, endRow: number): string {
  return `${startCol}${startRow}:${endCol}${endRow}`;
}

// Extended timeout for chain parsing - AI inference can take 30-60s for complex prompts
export const maxDuration = 60;


// ============================================
// TYPES
// ============================================

interface TaskStep {
  id: string;
  order: number;
  action: string;
  description: string;
  prompt: string;
  outputFormat?: string;
  inputColumns: string[];
  outputColumn: string;
  dependsOn: string | null;
  usesResultOf: string | null;
}

interface TaskChain {
  isMultiStep: boolean;
  isCommand: boolean;
  steps: TaskStep[];
  summary: string;
  clarification: string;
  estimatedTime?: string;
  
  // CRITICAL: Output mode determines execution path
  outputMode?: 'chat' | 'columns' | 'formula' | 'sheet';  // 'chat' = display in chat, 'columns' = write to spreadsheet, 'formula' = native formula, 'sheet' = native sheet manipulation
  chatResponse?: string;             // If outputMode='chat', this contains the actual answer
  
  // Suggested actions for vague/ambiguous requests (when outputMode='chat')
  suggestedActions?: Array<{
    label: string;    // Human-readable label for the button
    command: string;  // Command to execute when clicked
  }>;
  
  // Sheet action config (if outputMode='sheet')
  sheetAction?: 'chart' | 'format' | 'conditionalFormat' | 'dataValidation' | 'filter' | 'createTable' | 'writeData' | 'sheetOps';
  sheetConfig?: {
    // Chart config
    chartType?: 'bar' | 'column' | 'line' | 'pie' | 'area' | 'scatter';
    dataRange?: string;
    xColumn?: string;
    yColumns?: string[];
    title?: string;
    xAxisTitle?: string;
    yAxisTitle?: string;
    legendPosition?: 'top' | 'bottom' | 'right' | 'none';
    // Format config
    formatType?: 'currency' | 'percent' | 'number' | 'date' | 'text';
    range?: string;
    options?: Record<string, any>;
    // Conditional format config
    rules?: Array<{
      condition: string;
      value: any;
      format: Record<string, any>;
    }>;
    // Validation config
    validationType?: 'dropdown' | 'number' | 'checkbox' | 'date' | 'email' | 'url';
    values?: string[];
    // Filter config
    criteria?: Array<{
      column: string;
      condition: string;
      value: any;
    }>;
  };
  
  // Chain-level input configuration (for frontend executeTaskChain)
  inputRange?: string;           // A1 notation like "C8:F15"
  inputColumn?: string;          // First data column
  inputColumns?: string[];       // All data columns
  hasMultipleInputColumns?: boolean;
  rowCount?: number;
  
  // Explicit row info for accurate range targeting (passed to frontend)
  explicitRowInfo?: {
    headerRowNumber: number | null;
    headerRange: string | null;
    dataStartRow: number;
    dataEndRow: number;
    dataRange: string;
    fullRangeIncludingHeader: string | null;
    headerNames?: Array<{ column: string; name: string }>;
  };
  
  // For learning callback
  _embedding?: number[];
  _command?: string;
}

// Valid actions (for light validation)
const VALID_ACTIONS = [
  'extract', 'analyze', 'generate', 'classify', 'summarize',
  'score', 'clean', 'validate', 'translate', 'rewrite', 'custom'
];

// ============================================
// SKILL USAGE RECORDING (for dynamic examples)
// ============================================

// REMOVED: recordSkillExecution function
// Learning system disabled - trusting AI with instructions alone

// ============================================
// SMART CLARIFICATION GENERATOR
// ============================================

/**
 * Generate a context-aware clarification message based on the action and config
 * Much better than generic "Executing native Google Sheets action" messages
 */
function generateSmartClarification(
  sheetAction: string | undefined,
  sheetConfig: Record<string, unknown>,
  originalCommand: string
): string {
  const range = sheetConfig.range as string || '';
  
  switch (sheetAction) {
    case 'format': {
      const formatType = sheetConfig.formatType as string;
      const options = sheetConfig.options as Record<string, unknown> || {};
      const parts: string[] = [];
      
      if (formatType === 'currency') {
        parts.push(`Formatting ${range || 'cells'} as currency`);
        if (options.locale) parts.push(`(${options.locale})`);
      } else if (formatType === 'percent') {
        parts.push(`Formatting ${range || 'cells'} as percentage`);
      } else {
        // Text/styling format
        const styling: string[] = [];
        if (options.bold) styling.push('bold');
        if (options.italic) styling.push('italic');
        if (options.backgroundColor) styling.push(`${options.backgroundColor} background`);
        if (options.textColor) styling.push(`${options.textColor} text`);
        if (options.borders) styling.push('borders');
        if (options.alignment) styling.push(`${options.alignment} aligned`);
        
        if (styling.length > 0) {
          parts.push(`Applying ${styling.join(', ')} to ${range || 'cells'}`);
        } else {
          parts.push(`Formatting ${range || 'cells'}`);
        }
      }
      return parts.join(' ');
    }
    
    case 'conditionalFormat': {
      const rules = sheetConfig.rules as Array<Record<string, unknown>> || [];
      if (rules.length > 0) {
        const rule = rules[0];
        const condition = rule.condition as string;
        const value = rule.value;
        const format = rule.format as Record<string, unknown> || {};
        const color = format.backgroundColor || 'highlighted';
        
        if (condition === 'equals') {
          return `Highlighting cells in ${range} where value equals "${value}" with ${color}`;
        } else if (condition === 'greaterThan') {
          return `Highlighting cells in ${range} where value > ${value} with ${color}`;
        } else if (condition === 'lessThan') {
          return `Highlighting cells in ${range} where value < ${value} with ${color}`;
        } else if (condition === 'contains') {
          return `Highlighting cells in ${range} containing "${value}" with ${color}`;
        } else if (condition === 'negative') {
          return `Highlighting negative values in ${range} with ${color}`;
        } else if (condition === 'positive') {
          return `Highlighting positive values in ${range} with ${color}`;
        }
        return `Adding conditional formatting to ${range}`;
      }
      return `Adding conditional formatting rules to ${range}`;
    }
    
    case 'dataValidation': {
      const validationType = sheetConfig.validationType as string;
      if (validationType === 'dropdown') {
        const values = sheetConfig.values as string[] || [];
        return `Adding dropdown to ${range} with options: ${values.slice(0, 3).join(', ')}${values.length > 3 ? '...' : ''}`;
      } else if (validationType === 'checkbox') {
        return `Adding checkboxes to ${range}`;
      } else if (validationType === 'number') {
        const min = sheetConfig.min;
        const max = sheetConfig.max;
        return `Restricting ${range} to numbers between ${min} and ${max}`;
      }
      return `Adding ${validationType} validation to ${range}`;
    }
    
    case 'chart': {
      const chartType = sheetConfig.chartType as string || 'chart';
      const title = sheetConfig.title as string;
      return title 
        ? `Creating ${chartType} chart: "${title}"`
        : `Creating ${chartType} chart from your data`;
    }
    
    case 'filter': {
      const criteria = sheetConfig.criteria as Array<Record<string, unknown>> || [];
      if (criteria.length > 0) {
        const crit = criteria[0];
        return `Filtering to show rows where ${crit.column} ${crit.condition} ${crit.value}`;
      }
      return 'Applying filter to data';
    }
    
    case 'writeData': {
      const data = sheetConfig.data as unknown[][];
      if (data && data.length > 0) {
        const rows = data.length;
        const cols = data[0]?.length || 0;
        const startCell = sheetConfig.startCell as string || 'A1';
        return `Writing ${rows} rows × ${cols} columns starting at ${startCell}`;
      }
      return 'Writing data to sheet';
    }
    
    case 'createTable': {
      const tableName = sheetConfig.tableName as string;
      return tableName 
        ? `Creating table "${tableName}" from ${range}`
        : `Converting ${range} to a Google Sheets table`;
    }
    
    default:
      return `Applying ${sheetAction || 'sheet action'} to ${range || 'selected range'}`;
  }
}

// ============================================
// SDK AGENT CONTEXT BUILDER
// ============================================

/**
 * Convert frontend context to SDK Agent DataContext format
 * 
 * Priority for context fields (from buildEnhancedContext):
 * 1. context.* (enhanced fields from frontend buildEnhancedContext)
 * 2. explicitRowInfo.* 
 * 3. selectionInfo.*
 * 4. Fallback construction
 */
function buildAgentDataContext(context: any, command: string): AgentDataContext {
  const selectionInfo = context?.selectionInfo || {};
  const explicitRowInfo = context?.explicitRowInfo || {};
  
  // Build headers map from context
  const headers: Record<string, string> = {};
  
  // Priority 1: headerRow as object { A: "Name", B: "Sales" }
  if (context?.headerRow && typeof context.headerRow === 'object' && !Array.isArray(context.headerRow)) {
    Object.entries(context.headerRow).forEach(([col, name]) => {
      if (name) headers[col] = String(name);
    });
  }
  // Priority 2: headers array [{column, name}] from selectionInfo
  else if (selectionInfo?.headers && Array.isArray(selectionInfo.headers)) {
    selectionInfo.headers.forEach((h: { column: string; name: string }) => {
      if (h.column && h.name) headers[h.column] = h.name;
    });
  }
  // Priority 3: headers array (old format)
  else if (context?.headers && Array.isArray(context.headers)) {
    context.headers.forEach((name: string, idx: number) => {
      const col = String.fromCharCode(65 + idx); // A, B, C, ...
      if (name) headers[col] = name;
    });
  }
  // Priority 4: headerRow as array (old format)
  else if (context?.headerRow && Array.isArray(context.headerRow)) {
    context.headerRow.forEach((name: string, idx: number) => {
      const col = String.fromCharCode(65 + idx);
      if (name) headers[col] = name;
    });
  }
  // Priority 5: explicitRowInfo.headerNames
  else if (explicitRowInfo.headerNames) {
    explicitRowInfo.headerNames.forEach((h: { column: string; name: string }) => {
      headers[h.column] = h.name;
    });
  }
  
  // Get columns with data - check enhanced context first, then selectionInfo
  const columnsWithData = context?.columnsWithData || 
    selectionInfo.columnsWithData || 
    Object.keys(headers);
  
  const emptyColumns = context?.emptyColumns || 
    selectionInfo.emptyColumns || 
    [];
  
  // Get row info - check enhanced context first (from buildEnhancedContext)
  const headerRow = context?.headerRowNumber || 
    explicitRowInfo.headerRowNumber || 
    selectionInfo.headerRow || 
    1;
  
  const dataStartRow = context?.dataStartRow || 
    explicitRowInfo.dataStartRow || 
    selectionInfo.dataStartRow || 
    2;
  
  const dataEndRow = context?.dataEndRow || 
    explicitRowInfo.dataEndRow || 
    selectionInfo.dataEndRow || 
    100;
  
  const rowCount = dataEndRow - dataStartRow + 1;
  
  // Get data range - check enhanced context first (this is the properly built full range)
  const dataRange = context?.dataRange || 
    explicitRowInfo.dataRange || 
    selectionInfo.dataRange || 
    `${columnsWithData[0] || 'A'}${dataStartRow}:${columnsWithData[columnsWithData.length - 1] || 'A'}${dataEndRow}`;
  
  // Log what we resolved
  console.log('[buildAgentDataContext] Resolved context:', {
    dataRange,
    columnsWithData: columnsWithData.length,
    headerRow,
    dataStartRow,
    dataEndRow,
    headersCount: Object.keys(headers).length
  });
  
  // Get sample data
  const sampleData: Record<string, string[]> = {};
  if (context?.sampleData) {
    Object.entries(context.sampleData).forEach(([col, values]) => {
      sampleData[col] = (values as any[]).slice(0, 3).map(v => String(v));
    });
  }
  
  return {
    headers,
    dataRange,
    rowCount,
    sampleData,
    emptyColumns,
    columnsWithData,
    headerRow,
    dataStartRow,
    dataEndRow,
    userGoal: command,
  };
}

// ============================================
// MAIN HANDLER
// ============================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { command, context } = body;

    if (!command) {
      return NextResponse.json({ error: 'Command is required' }, { status: 400 });
    }

    // Authenticate request using centralized auth service
    const auth = authenticateRequest(body);
    if (!auth.success) {
      return NextResponse.json(
        createAuthErrorResponse(auth),
        { status: getAuthErrorStatus(auth.code) }
      );
    }
    
    const { provider, apiKey, modelId, model } = auth;

    // ============================================
    // SDK AGENT PATH (Feature Flag)
    // ============================================
    if (USE_SDK_AGENT) {
      console.log('[parse-chain] 🚀 Using SDK Agent with self-correction');
      
      try {
        // Build agent-compatible data context
        const agentContext: AgentDataContext = buildAgentDataContext(context, command);
        console.log('[parse-chain] Agent context:', {
          headers: Object.keys(agentContext.headers),
          dataRange: agentContext.dataRange,
          rowCount: agentContext.rowCount,
          emptyColumns: agentContext.emptyColumns.slice(0, 3),
        });
        
        // Get evaluator model for self-correction
        const enableSelfCorrection = process.env.AGENT_SELF_CORRECTION !== 'false';
        let evaluatorModel = null;
        
        if (enableSelfCorrection) {
          evaluatorModel = model;
          console.log(`[parse-chain] Self-correction enabled using ${provider}/${modelId}`);
        } else {
          console.log('[parse-chain] Self-correction disabled');
        }
        
        // Get max attempts from config (default: 2)
        const maxAttempts = parseInt(process.env.AGENT_MAX_ATTEMPTS || '2', 10);
        console.log(`[parse-chain] Max attempts: ${maxAttempts}`);
        
        // Create and run the agent
        const agent = createSheetsAgent(model, evaluatorModel, agentContext, { maxAttempts });
        const result = await agent.generate({ prompt: command });
        
        console.log('[parse-chain] Agent result:', {
          text: result.text?.substring(0, 100),
          toolCalls: result.toolCalls.length,
          toolCallNames: result.toolCalls.map(tc => tc.toolName),
        });
        
        // Convert to legacy format for frontend compatibility
        const legacyResponse = convertAgentResultToLegacyFormat(result, agentContext, command);
        
        console.log('[parse-chain] Legacy response:', {
          isMultiStep: legacyResponse.isMultiStep,
          isCommand: legacyResponse.isCommand,
          steps: legacyResponse.steps?.length,
          outputMode: legacyResponse.outputMode,
          sheetAction: legacyResponse.sheetAction,
          inputRange: legacyResponse.inputRange,
        });
        
        const elapsed = Date.now() - startTime;
        console.log(`[parse-chain] ✅ SDK Agent completed in ${elapsed}ms`);
        
        return NextResponse.json(legacyResponse);
        
      } catch (agentError) {
        console.error('[parse-chain] ❌ SDK Agent error, falling back to legacy:', agentError);
        console.error('[parse-chain] Error stack:', (agentError as Error).stack);
        // Fall through to legacy path
      }
    }

    console.log('[parse-chain] Starting workflow generation (legacy path)');
    console.log('[parse-chain] Command:', command.substring(0, 80) + '...');

    // Log received context for debugging
    console.log('[parse-chain] Context keys:', Object.keys(context || {}));
    console.log('[parse-chain] Has selectionInfo:', !!context?.selectionInfo);
    console.log('[parse-chain] Has columnDataRanges:', !!context?.columnDataRanges);
    console.log('[parse-chain] Has sampleData:', !!context?.sampleData);
    console.log('[parse-chain] Has headers:', Array.isArray(context?.headers) ? context.headers.length : !!context?.headerRow);
    console.log('[parse-chain] Has explicitRowInfo:', !!context?.explicitRowInfo);
    if (context?.explicitRowInfo) {
      console.log('[parse-chain] explicitRowInfo:', JSON.stringify(context.explicitRowInfo));
    }
    
    // 1. Extract explicit output column from command (e.g., "to column H", "for column G")
    let explicitOutputColumn: string | null = null;
    const outputColMatch = command.match(/(?:to|in|into|for)\s+column\s+([A-Z])\b/i);
    if (outputColMatch) {
      explicitOutputColumn = outputColMatch[1].toUpperCase();
      console.log('[parse-chain] Detected explicit output column:', explicitOutputColumn);
    }
    
    // 2. Extract data context
    const dataContext = extractDataContext(context);
    console.log('[parse-chain] Data columns:', dataContext.dataColumns.join(', '));
    console.log('[parse-chain] Data range:', dataContext.dataRange || 'MISSING!');
    console.log('[parse-chain] Row info: startRow=' + dataContext.startRow + ', endRow=' + dataContext.endRow + ', rowCount=' + dataContext.rowCount);
    console.log('[parse-chain] Sample data columns:', Object.keys(dataContext.sampleData).join(', ') || 'none');
    
    // ============================================
    // SIMPLIFIED: No intent classification needed
    // AI handles intent from skill instructions alone
    // ============================================
    console.log('[parse-chain] SIMPLIFIED - AI determines intent from instructions');

    // ============================================
    // SIMPLIFIED: No embedding or DB lookups needed
    // AI handles intent from skill instructions alone
    // ============================================
    const embedding: number[] | null = null;
    const similarWorkflows: StoredWorkflow[] = [];
    const baseExamples: StoredWorkflow[] = [];
    console.log('[parse-chain] SIMPLIFIED - no embeddings or DB lookups');

    // 4. Analyze request for vagueness/complexity
    const requestAnalysis = analyzeRequest(command, dataContext);
    console.log('[parse-chain] Request analysis:', {
      type: requestAnalysis.type,
      specificity: requestAnalysis.specificity.toFixed(2),
      recommendation: requestAnalysis.recommendation,
      hasVagueAdjectives: requestAnalysis.hasVagueAdjectives,
      impliedActions: requestAnalysis.impliedActionCount
    });
    
    // 4.5. Build smart prompt (uses adaptive skills or legacy based on config)
    // SIMPLIFIED: No forced skill - AI determines from instructions
    const promptOptions = {};
    
    const prompt = await buildSmartPrompt(command, dataContext, similarWorkflows, baseExamples, promptOptions);
    console.log('[parse-chain] Prompt length:', prompt.length, 'chars');
    console.log('[parse-chain] Prompt preview (first 500):', prompt.substring(0, 500));
    
    // 5. Generate workflow with AI
    console.log('[parse-chain] Using model provider:', provider, modelId);
    // Model already obtained from authenticateRequest()
    
    const { text } = await generateText({
      model,
      prompt,
    });

    console.log('[parse-chain] AI response length:', text.length);
    console.log('[parse-chain] AI raw response (first 500 chars):', text.substring(0, 500));

    // 6. Parse and validate (lightly!) - pass intent classification for skill-aware handling
    // SIMPLIFIED: No intent classification - pass null
    const chain = parseAndValidate(text, dataContext, command, embedding, explicitOutputColumn, null);
    
    // Debug: Log what we're returning - including per-step column assignments
    console.log('[parse-chain] Returning steps:', chain.steps.map(s => ({ 
      action: s.action, 
      desc: s.description?.substring(0, 30),
      inputCols: s.inputColumns?.join(',') || 'none',
      outputCol: s.outputColumn || 'none'
    })));
    console.log('[parse-chain] Returning input config: inputRange=' + chain.inputRange + ', inputColumn=' + chain.inputColumn + ', inputColumns=' + (chain.inputColumns?.join(',') || 'none'));
    
    // CRITICAL: Log the actual JSON being returned to verify it matches our expectation
    const responseJson = JSON.stringify({
      inputRange: chain.inputRange,
      inputColumn: chain.inputColumn,
      inputColumns: chain.inputColumns,
      hasMultipleInputColumns: chain.hasMultipleInputColumns,
      stepCount: chain.steps?.length
    });
    console.log('[parse-chain] Response JSON (input config):', responseJson);
    
    // ============================================
    // LEARNING DISABLED - Trusting AI with instructions
    // ============================================
    // Modern LLMs handle schemas well without example databases.
    // This removes embedding generation and database overhead.
    // 
    // REMOVED: recordSkillExecution() - dynamic examples system
    // REMOVED: learnFromOutcome() - intent cache learning
    // ============================================
    
    const elapsed = Date.now() - startTime;
    console.log(`[parse-chain] Completed in ${elapsed}ms`);

    return NextResponse.json(chain);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[parse-chain] Error:', errorMessage);
    console.error('[parse-chain] Stack:', error instanceof Error ? error.stack : 'N/A');
    
    return NextResponse.json(
      { error: 'Failed to generate workflow: ' + errorMessage },
      { status: 500 }
    );
  }
}

// ============================================
// DATA CONTEXT EXTRACTION
// ============================================

interface ExtendedDataContext extends DataContext {
  startRow: number;
  endRow: number;
  dataRange: string;  // Full A1 notation range
  // Explicit row information for precise targeting (e.g., header formatting)
  explicitRowInfo?: {
    headerRowNumber: number | null;
    headerRange: string | null;
    dataStartRow: number;
    dataEndRow: number;
    dataRange: string;
    fullRangeIncludingHeader: string | null;
    headerNames?: Array<{ column: string; name: string }>;
  };
}

function extractDataContext(context: any): ExtendedDataContext {
  const selInfo = context?.selectionInfo;
  const columnData = context?.columnDataRanges || {};
  
  // BUGFIX (2026-01-21): More robust data column extraction
  // Try multiple sources in order of preference
  let dataColumns: string[] = [];
  
  // Priority 0: Enhanced context.columnsWithData (from buildEnhancedContext)
  if (context?.columnsWithData && Array.isArray(context.columnsWithData) && context.columnsWithData.length > 0) {
    dataColumns = context.columnsWithData;
    console.log('[parse-chain] Using context.columnsWithData (enhanced):', dataColumns.join(','));
  }
  // Priority 1: selectionInfo.columnsWithData (from auto-detection or explicit selection)
  else if (selInfo?.columnsWithData && Array.isArray(selInfo.columnsWithData) && selInfo.columnsWithData.length > 0) {
    dataColumns = selInfo.columnsWithData;
    console.log('[parse-chain] Using selInfo.columnsWithData:', dataColumns.join(','));
  }
  // Priority 2: columnDataRanges with hasData=true
  else if (Object.keys(columnData).length > 0) {
    dataColumns = Object.keys(columnData).filter(col => columnData[col]?.hasData);
    console.log('[parse-chain] Using columnDataRanges:', dataColumns.join(','));
  }
  // Priority 3: If we have sampleData, use those columns
  else if (context?.sampleData && typeof context.sampleData === 'object') {
    dataColumns = Object.keys(context.sampleData);
    console.log('[parse-chain] Using sampleData columns:', dataColumns.join(','));
  }
  // Priority 4: Fallback - detect from headers if available
  else if (context?.headers && Array.isArray(context.headers) && context.headers.length > 0) {
    dataColumns = context.headers.map((h: any) => h.column).filter(Boolean);
    console.log('[parse-chain] Using headers for data columns:', dataColumns.join(','));
  }
  // Priority 5: Ultimate fallback - assume first 3 columns (A, B, C)
  else {
    dataColumns = ['A', 'B', 'C'];
    console.warn('[parse-chain] WARNING: No data columns detected, assuming first 3 columns:', dataColumns.join(','));
  }
  
  // Get empty columns from frontend, but ensure we have at least 10 for multi-aspect workflows
  const frontendEmptyColumns = selInfo?.emptyColumns?.map((e: any) => e.column) || [];
  const emptyColumns = frontendEmptyColumns.length >= 10 
    ? frontendEmptyColumns 
    : getEmptyColumnsAfter(dataColumns, 10);
  
  console.log('[parse-chain] Empty columns:', 
    frontendEmptyColumns.length > 0 
      ? `using ${frontendEmptyColumns.length} from frontend, ` + (frontendEmptyColumns.length < 10 ? 'generating more to total 10' : 'sufficient')
      : 'generated 10 dynamically'
  );
  console.log('[parse-chain] Empty columns list:', emptyColumns.slice(0, 6).join(', '));
  
  const headers: Record<string, string> = {};
  // Check multiple locations for headers:
  // 1. context.headers (array format from Agent.gs)
  // 2. context.headerRow (object format)
  // 3. selectionInfo.selectedHeaders
  if (context?.headers && Array.isArray(context.headers)) {
    context.headers.forEach((h: any) => {
      if (h.column && h.name) {
        headers[h.column] = h.name;
      }
    });
  }
  if (context?.headerRow && typeof context.headerRow === 'object') {
    Object.entries(context.headerRow).forEach(([col, name]) => {
      if (!headers[col] && name) {
        headers[col] = String(name);
      }
    });
  }
  if (selInfo?.selectedHeaders && Array.isArray(selInfo.selectedHeaders)) {
    selInfo.selectedHeaders.forEach((h: any) => {
      if (h.column && h.name && !headers[h.column]) {
        headers[h.column] = h.name;
      }
    });
  }
  
  // Log headers for debugging
  console.log('[parse-chain] Headers found:', Object.keys(headers).length > 0 ? JSON.stringify(headers) : 'none');
  
  const sampleData: Record<string, string[]> = {};
  // Check multiple locations for sample data:
  // 1. selectionInfo.columnSamples (newer format)
  // 2. context.sampleData (older format from Agent.gs)
  const sampleSource = selInfo?.columnSamples || context?.sampleData || {};
  if (sampleSource && typeof sampleSource === 'object') {
    Object.entries(sampleSource).forEach(([col, samples]: [string, any]) => {
      if (Array.isArray(samples)) {
        sampleData[col] = samples.slice(0, 3); // Include up to 3 samples for better context
      }
    });
  }
  
  // Log sample data for debugging
  console.log('[parse-chain] Sample data available for columns:', Object.keys(sampleData).join(', ') || 'none');
  
  // Extract row information - check enhanced context first
  // Priority: context.* (enhanced) > selInfo.* > columnDataRanges fallback
  let startRow = context?.dataStartRow || selInfo?.dataStartRow;
  let endRow = context?.dataEndRow || selInfo?.dataEndRow;
  let rowCount = context?.totalRowCount || selInfo?.dataRowCount;
  
  // If selectionInfo doesn't have row info, try to get from columnDataRanges
  if (!startRow && dataColumns.length > 0) {
    const firstCol = dataColumns[0];
    const colInfo = columnData[firstCol];
    if (colInfo) {
      startRow = colInfo.startRow || colInfo.dataStartRow;
      endRow = colInfo.endRow || colInfo.dataEndRow || (startRow ? startRow + (colInfo.rowCount || 9) : undefined);
      rowCount = colInfo.rowCount || colInfo.dataRowCount;
      console.log('[parse-chain] Row info from columnDataRanges:', { col: firstCol, startRow, endRow, rowCount });
    }
  }
  
  // Final fallback to defaults
  startRow = startRow || 2;
  endRow = endRow || (startRow + 9);
  rowCount = rowCount || (endRow - startRow + 1);
  
  // Build full data range in A1 notation
  // IMPORTANT: Always build the range to include ALL data columns, not just the auto-detected first column
  let dataRange = '';
  
  // Priority 0: Use enhanced context.dataRange if it spans multiple columns correctly
  if (context?.dataRange && dataColumns.length > 0) {
    // Check if context.dataRange already includes all columns
    const rangeMatch = context.dataRange.match(/([A-Z]+)\d+:([A-Z]+)\d+/);
    if (rangeMatch) {
      const rangeStartCol = rangeMatch[1];
      const rangeEndCol = rangeMatch[2];
      // If the range spans the same columns as dataColumns, use it
      if (rangeStartCol === dataColumns[0] && rangeEndCol === dataColumns[dataColumns.length - 1]) {
        dataRange = context.dataRange;
        console.log('[parse-chain] Using context.dataRange (enhanced):', dataRange);
      }
    }
  }
  
  // Priority 1: Build from dataColumns if not already set
  if (!dataRange && dataColumns.length > 0) {
    const firstCol = dataColumns[0];
    const lastCol = dataColumns[dataColumns.length - 1];
    dataRange = `${firstCol}${startRow}:${lastCol}${endRow}`;
    console.log('[parse-chain] Built dataRange from columns:', dataRange);
    
    // Note if we're overriding a single-column range
    if (selInfo?.dataRange && dataColumns.length > 1) {
      console.log('[parse-chain] (Overriding selInfo.dataRange', selInfo.dataRange, 'with full range)');
    }
  }
  // Priority 2: Fallback to selInfo.dataRange
  else if (!dataRange && selInfo?.dataRange) {
    dataRange = selInfo.dataRange;
    console.log('[parse-chain] Using selInfo.dataRange as fallback:', dataRange);
  }
  // Final safety: If still no range, construct a minimal one
  else if (!dataRange) {
    dataRange = `A${startRow}:D${endRow}`;
    console.warn('[parse-chain] WARNING: No dataRange detected, using fallback A1 notation:', dataRange);
  }
  
  console.log('[parse-chain] Final dataRange:', dataRange, '| dataColumns:', dataColumns.join(','));
  
  // Include explicitRowInfo if available from frontend
  const explicitRowInfo = context?.explicitRowInfo || null;
  if (explicitRowInfo) {
    console.log('[parse-chain] Including explicitRowInfo for AI:', JSON.stringify(explicitRowInfo));
  }
  
  return { dataColumns, emptyColumns, headers, sampleData, rowCount, startRow, endRow, dataRange, explicitRowInfo };
}

// ============================================
// PARSE AND VALIDATE
// ============================================

function parseAndValidate(
  text: string,
  dataContext: ExtendedDataContext,
  originalCommand: string,
  embedding: number[] | null,
  explicitOutputColumn: string | null = null,
  intentClassification: IntentClassification | null = null
): TaskChain {
  try {
    // Extract JSON from response
    let jsonStr = text.trim();
    
    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    
    // Find JSON object
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // CRITICAL: Check if this is CHAT MODE (user asking question, not transforming data)
    if (parsed.outputMode === 'chat') {
      console.log('[parse-chain] Chat mode detected - returning response without steps');
      
      // Log suggested actions if present
      if (parsed.suggestedActions && Array.isArray(parsed.suggestedActions)) {
        console.log('[parse-chain] suggestedActions found:', parsed.suggestedActions.length, 'actions');
        console.log('[parse-chain] suggestedActions preview:', JSON.stringify(parsed.suggestedActions.slice(0, 2)));
      } else {
        console.log('[parse-chain] No suggestedActions in response');
      }
      
      return {
        isMultiStep: false,
        isCommand: true,
        steps: [],
        summary: parsed.summary || 'Answering your question',
        clarification: parsed.clarification || '',
        outputMode: 'chat',
        chatResponse: parsed.chatResponse || parsed.clarification || '',
        
        // CRITICAL: Include suggested actions for vague/ambiguous requests
        suggestedActions: parsed.suggestedActions || [],
        
        // Include input config for context tracking
        inputRange: dataContext.dataRange,
        inputColumn: dataContext.dataColumns[0],
        inputColumns: dataContext.dataColumns,
        hasMultipleInputColumns: dataContext.dataColumns.length > 1,
        rowCount: dataContext.rowCount,
        
        _embedding: embedding || undefined,
        _command: originalCommand,
      };
    }
    
    // FORMULA MODE: AI decided to use native Google Sheets formula (FREE, instant)
    if (parsed.outputMode === 'formula') {
      console.log('[parse-chain] ✅ FORMULA MODE: AI chose native formula (0 AI cost, instant)');
      const formulaStep = parsed.steps?.[0] || {};
      const formula = formulaStep.prompt || '';
      console.log('[parse-chain] Formula:', formula.substring(0, 100));
      
      // Determine output column - PRIORITY:
      // 1. User explicitly specified column
      // 2. AI returned outputColumn (e.g., for replacing existing column like "G")
      // 3. First empty column (for new columns)
      const outputCol = explicitOutputColumn || formulaStep.outputColumn || dataContext.emptyColumns[0] || 'D';
      console.log('[parse-chain] Formula outputColumn:', outputCol, '(explicit:', explicitOutputColumn, ', ai:', formulaStep.outputColumn, ', empty:', dataContext.emptyColumns[0], ')');
      
      return {
        isMultiStep: false,
        isCommand: true,
        steps: [{
          id: 'step_1',
          order: 1,
          action: 'formula',
          description: formulaStep.description || 'Apply formula',
          prompt: formula,
          outputFormat: 'formula',
          inputColumns: dataContext.dataColumns,
          outputColumn: outputCol,
          dependsOn: null,
          usesResultOf: null,
        }],
        summary: parsed.summary || 'Apply native formula',
        clarification: parsed.clarification || `Using native Google Sheets formula.\n\n✅ FREE - no AI cost\n✅ Instant - no processing time\n✅ Auto-updates when data changes`,
        estimatedTime: 'Instant',
        outputMode: 'formula',
        
        // Include input config
        inputRange: dataContext.dataRange,
        inputColumn: dataContext.dataColumns[0],
        inputColumns: dataContext.dataColumns,
        hasMultipleInputColumns: dataContext.dataColumns.length > 1,
        rowCount: dataContext.rowCount,
        
        _embedding: embedding || undefined,
        _command: originalCommand,
      };
    }
    
    // SHEET MODE: AI decided to use native sheet manipulation (chart, format, etc.) - instant execution
    if (parsed.outputMode === 'sheet') {
      console.log('[parse-chain] ✅ SHEET MODE: AI chose native sheet action (instant execution)');
      
      // ============================================
      // LEVERAGE SKILL ARCHITECTURE
      // 1. If we have intent classification, use it to override AI mistakes
      // 2. Normalize response using the normalizer
      // 3. Validate against skill schema if available
      // ============================================
      
      // Get the skill if intent classification is available
      const classifiedSkillId = intentClassification?.skillId;
      const classifiedAction = intentClassification?.sheetAction;
      const skill: GoogleSheetSkill | undefined = classifiedSkillId ? getSkillById(classifiedSkillId) : undefined;
      
      // Normalize the response
      const normalized = normalizeSheetResponse(
        {
          sheetAction: parsed.sheetAction,
          sheetConfig: parsed.sheetConfig,
          steps: parsed.steps,
        },
        {
          command: originalCommand,
          dataContext,
        }
      );
      
      // Use intent classification to override if AI returned wrong action
      // Trust the classifier if it's confident and returned a sheet action
      let sheetAction = normalized.sheetAction;
      if (classifiedAction && classifiedAction !== sheetAction && intentClassification?.confidence && intentClassification.confidence >= 0.8) {
        console.log(`[parse-chain] 🎯 Intent classifier override: ${sheetAction} → ${classifiedAction} (confidence: ${intentClassification.confidence.toFixed(2)})`);
        sheetAction = classifiedAction;
      }
      
      const sheetConfig = normalized.sheetConfig;
      
      // Log skill-aware processing
      if (skill) {
        console.log(`[parse-chain] 📦 Using skill: ${skill.id} v${skill.version}`);
        // Validate required fields from skill schema
        const missingFields = skill.schema.requiredFields.filter(
          field => sheetConfig[field] === undefined && field !== 'range' // range is often derived
        );
        if (missingFields.length > 0) {
          console.log(`[parse-chain] ⚠️ Missing required fields from skill schema: ${missingFields.join(', ')}`);
        }
      }
      
      if (normalized.wasNormalized) {
        console.log('[parse-chain] Response normalized:', normalized.normalizations.join(', '));
      }
      
      console.log('[parse-chain] Sheet action:', sheetAction);
      console.log('[parse-chain] Sheet config:', JSON.stringify(sheetConfig).substring(0, 200));
      
      return {
        isMultiStep: false,
        isCommand: true,
        steps: [{
          id: 'step_1',
          order: 1,
          action: sheetAction || 'format',  // Default to format for sheet mode
          description: parsed.summary || 'Apply sheet action',
          prompt: '',
          outputFormat: 'sheet',
          inputColumns: dataContext.dataColumns,
          outputColumn: '',
          dependsOn: null,
          usesResultOf: null,
        }],
        summary: parsed.summary || 'Apply native sheet action',
        clarification: parsed.clarification || generateSmartClarification(sheetAction, sheetConfig, originalCommand),
        estimatedTime: 'Instant',
        outputMode: 'sheet',
        sheetAction: sheetAction,
        sheetConfig: sheetConfig,
        
        // Include input config
        inputRange: dataContext.dataRange,
        inputColumn: dataContext.dataColumns[0],
        inputColumns: dataContext.dataColumns,
        hasMultipleInputColumns: dataContext.dataColumns.length > 1,
        rowCount: dataContext.rowCount,
        
        // Include explicitRowInfo for frontend
        explicitRowInfo: dataContext.explicitRowInfo,
        
        _embedding: embedding || undefined,
        _command: originalCommand,
      };
    }
    
    // Validate steps exist (only for COLUMNS mode)
    if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      throw new Error('No steps in response');
    }
    
    // Build steps with light validation
    let usedOutputColumns = 0; // Track how many output columns we've used across all steps
    const steps: TaskStep[] = parsed.steps.slice(0, 4).map((step: any, idx: number) => {
      const action = normalizeAction(step.action);
      
      // Detect if this step outputs to multiple columns (multi-aspect analysis)
      // Look for " | " separator in outputFormat which indicates multiple aspects
      const outputFormat = step.outputFormat || '';
      const aspects = outputFormat.split('|').map((s: string) => s.trim()).filter(Boolean);
      const isMultiAspect = aspects.length > 1;
      
      // For multi-aspect steps, assign multiple output columns
      let outputCol: string;
      let outputCols: string[] | null = null;
      let explicitSingleColumn = false;
      
      // CRITICAL: If user specified explicit output column (e.g., "to column I"), use ONLY that column!
      // Do NOT expand to multiple columns - user wants everything in the single specified column
      if (explicitOutputColumn && idx === 0) {
        // First step and user specified output column - use their column
        outputCol = explicitOutputColumn;
        outputCols = [explicitOutputColumn]; // Set outputColumns to signal frontend NOT to expand
        explicitSingleColumn = true;
        console.log(`[parse-chain] Step ${idx + 1} using EXPLICIT output column: ${outputCol} (will NOT expand multi-aspect)`);
        
        // CRITICAL: Even if multi-aspect format detected, use SINGLE column when explicitly specified
        // The AI will combine all aspects into one cell (e.g., "Competitors: X | Reason: Y")
        usedOutputColumns++;
      } else if (isMultiAspect) {
        // This step needs multiple columns - use the next N empty columns
        outputCol = dataContext.emptyColumns[usedOutputColumns];
        if (!outputCol) {
          // Fallback: calculate dynamically based on data columns
          const firstEmptyCol = dataContext.emptyColumns[0] || getEmptyColumnsAfter(dataContext.dataColumns, 1)[0];
          const firstEmptyColNum = columnLetterToNumber(firstEmptyCol);
          outputCol = columnNumberToLetter(firstEmptyColNum + usedOutputColumns);
        }
        
        // Calculate end column: start + (aspects - 1)
        const endColIndex = usedOutputColumns + aspects.length - 1;
        const endCol = dataContext.emptyColumns[endColIndex] || columnNumberToLetter(columnLetterToNumber(outputCol) + aspects.length - 1);
        
        console.log(`[parse-chain] Step ${idx + 1} is multi-aspect (${aspects.length} aspects), using columns ${outputCol} through ${endCol}`);
        console.log(`[parse-chain] Debug: outputCol=${outputCol}, endColIndex=${endColIndex}, endCol from array=${dataContext.emptyColumns[endColIndex] || 'undefined'}, calculated endCol=${endCol}`);
        usedOutputColumns += aspects.length; // Reserve all needed columns
      } else {
        // Single output column
        outputCol = dataContext.emptyColumns[usedOutputColumns];
        if (!outputCol) {
          // Fallback: calculate dynamically
          const firstEmptyCol = dataContext.emptyColumns[0] || getEmptyColumnsAfter(dataContext.dataColumns, 1)[0];
          const firstEmptyColNum = columnLetterToNumber(firstEmptyCol);
          outputCol = columnNumberToLetter(firstEmptyColNum + usedOutputColumns);
        }
        usedOutputColumns++; // Reserve one column
      }
      
      // Input columns: first step reads data, later steps include previous outputs
      let inputCols: string[];
      if (idx === 0) {
        // First step: use only data columns
        inputCols = dataContext.dataColumns;
      } else {
        // Later steps: use data columns + previous output columns
        const previousOutputs = dataContext.emptyColumns.slice(0, usedOutputColumns - (isMultiAspect ? aspects.length : 1));
        inputCols = [...dataContext.dataColumns, ...previousOutputs];
      }
      
      // Log what we're setting for debugging
      console.log(`[parse-chain] Step ${idx + 1}: action=${action}, inputCols=[${inputCols.join(',')}], outputCol=${outputCol}, aspects=${aspects.length}`);
      
      return {
        id: `step_${idx + 1}`,
        order: idx + 1,
        action,
        description: step.description || `${action} data`,
        // CRITICAL: If LLM doesn't provide detailed prompt, use user's original command
        // This ensures the actual user intent is passed to the worker, not a generic fallback
        prompt: step.prompt || originalCommand,
        outputFormat: step.outputFormat || '',
        inputColumns: inputCols,
        outputColumn: outputCol,
        // Set outputColumns to prevent frontend from re-expanding
        // null means frontend can expand if needed, array means it's already decided
        outputColumns: outputCols,
        // Flag to signal frontend that user explicitly requested single column
        explicitSingleColumn,
        dependsOn: idx > 0 ? `step_${idx}` : null,
        usesResultOf: idx > 0 ? `step_${idx}` : null,
      };
    });
    
    // Build the step clarification with output columns
    const stepDescriptions = steps.map((s, i) => {
      // Check if this is a multi-aspect step
      const outputFormat = s.outputFormat || '';
      const aspects = outputFormat.split('|').map((a: string) => a.trim()).filter(Boolean);
      
      if (aspects.length > 1) {
        // Multi-aspect: show column range
        const startCol = s.outputColumn;
        const endCol = String.fromCharCode(startCol.charCodeAt(0) + aspects.length - 1);
        return `${i + 1}. ${s.description} → Columns ${startCol}-${endCol} (${aspects.length} aspects)`;
      } else {
        // Single column
        return `${i + 1}. ${s.description} → Column ${s.outputColumn}`;
      }
    }).join('\n');
    
    // Build final input configuration dynamically
    const finalInputColumns = dataContext.dataColumns;
    const finalInputColumn = finalInputColumns[0];
    const finalInputRange = dataContext.dataRange || buildRange(
      finalInputColumns[0], 
      finalInputColumns[finalInputColumns.length - 1], 
      dataContext.startRow, 
      dataContext.endRow
    );
    
    console.log('[parse-chain] Final input config before return:', {
      inputRange: finalInputRange,
      inputColumn: finalInputColumn,
      inputColumns: finalInputColumns.join(','),
      rowCount: dataContext.rowCount,
      startRow: dataContext.startRow,
      endRow: dataContext.endRow
    });
    
    return {
      isMultiStep: steps.length > 1,
      isCommand: false,
      steps,
      summary: parsed.summary || `${steps.length}-step workflow`,
      clarification: parsed.clarification || `I'll process your data with this workflow:\n\n${stepDescriptions}\n\nProcessing ${dataContext.rowCount} rows.`,
      estimatedTime: `~${steps.length * 2} minutes`,
      outputMode: 'columns', // Explicit mode for columns-based workflows
      
      // Chain-level input configuration (critical for frontend execution!)
      inputRange: finalInputRange,
      inputColumn: finalInputColumn,
      inputColumns: finalInputColumns,
      hasMultipleInputColumns: finalInputColumns.length > 1,
      rowCount: dataContext.rowCount,
      
      // Include for learning callback
      _embedding: embedding || undefined,
      _command: originalCommand,
    };
    
  } catch (error) {
    console.error('[parse-chain] Parse error:', error);
    // Return a sensible fallback
    return createFallback(dataContext, originalCommand, embedding);
  }
}

/**
 * Normalize action to valid action
 * Only fix truly invalid actions - trust AI for most
 */
function normalizeAction(action: string): string {
  const normalized = String(action || '').toLowerCase().trim();
  
  // If valid, use as-is
  if (VALID_ACTIONS.includes(normalized)) {
    return normalized;
  }
  
  // Common typos/alternatives
  const alternatives: Record<string, string> = {
    'process': 'analyze',
    'categorize': 'classify',
    'find': 'extract',
    'create': 'generate',
    'write': 'generate',
    'rate': 'score',
    'check': 'validate',
  };
  
  if (alternatives[normalized]) {
    return alternatives[normalized];
  }
  
  // Default to analyze (most versatile)
  return 'analyze';
}

/**
 * Create a sensible fallback when parsing fails
 */
function createFallback(
  dataContext: ExtendedDataContext,
  command: string,
  embedding: number[] | null
): TaskChain {
  console.log('[parse-chain] Using fallback workflow');
  
  // Use actual data columns (should always be populated by extractDataContext)
  const safeDataColumns = dataContext.dataColumns;
  const safeDataRange = dataContext.dataRange || buildRange(
    safeDataColumns[0], 
    safeDataColumns[safeDataColumns.length - 1], 
    dataContext.startRow, 
    dataContext.endRow
  );
  
  const steps: TaskStep[] = [
    {
      id: 'step_1',
      order: 1,
      action: 'analyze',
      description: 'Analyze data and extract insights',
      prompt: `Analyze this data in context of: "${command.substring(0, 100)}"\n\nProvide:\n1. Key insight or finding\n2. Important pattern or concern\n3. Notable observation`,
      outputFormat: 'Insight | Pattern | Observation',
      inputColumns: safeDataColumns,
      outputColumn: dataContext.emptyColumns[0] || 'G',
      dependsOn: null,
      usesResultOf: null,
    },
    {
      id: 'step_2',
      order: 2,
      action: 'generate',
      description: 'Generate actionable recommendation',
      prompt: 'Based on the analysis, generate one specific, actionable recommendation.\n\nBe concrete: Who should do what?',
      outputFormat: 'Recommendation',
      inputColumns: [...safeDataColumns, dataContext.emptyColumns[0]],
      outputColumn: dataContext.emptyColumns[1],
      dependsOn: 'step_1',
      usesResultOf: 'step_1',
    },
  ];
  
  return {
    isMultiStep: true,
    isCommand: false,
    steps,
    summary: '2-step analysis workflow',
    clarification: `I'll analyze your data and generate recommendations.\n\n1. Analyze data → Column ${steps[0].outputColumn}\n2. Generate recommendation → Column ${steps[1].outputColumn}\n\nProcessing ${dataContext.rowCount} rows.`,
    estimatedTime: '~4 minutes',
    
    // Chain-level input configuration - use safe values
    inputRange: safeDataRange,
    inputColumn: safeDataColumns[0],
    inputColumns: safeDataColumns,
    hasMultipleInputColumns: safeDataColumns.length > 1,
    rowCount: dataContext.rowCount,
    
    _embedding: embedding || undefined,
    _command: command,
  };
}

// Model creation is now handled by authenticateRequest() from @/lib/auth/auth-service
