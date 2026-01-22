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

import { generateEmbedding } from '@/lib/ai/embeddings';
import { findSimilarWorkflowsByEmbedding, getBaseExamplesFromDB, StoredWorkflow } from '@/lib/workflow-memory';
import { buildFewShotPrompt, DataContext } from '@/lib/workflow-memory/prompt-builder';
import { authenticateRequest, getAuthErrorStatus, createAuthErrorResponse } from '@/lib/auth/auth-service';
import { getModel } from '@/lib/ai/models';

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
  
  // Chain-level input configuration (for frontend executeTaskChain)
  inputRange?: string;           // A1 notation like "C8:F15"
  inputColumn?: string;          // First data column
  inputColumns?: string[];       // All data columns
  hasMultipleInputColumns?: boolean;
  rowCount?: number;
  
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

    console.log('[parse-chain] Starting workflow generation');
    console.log('[parse-chain] Command:', command.substring(0, 80) + '...');

    // Log received context for debugging
    console.log('[parse-chain] Context keys:', Object.keys(context || {}));
    console.log('[parse-chain] Has selectionInfo:', !!context?.selectionInfo);
    console.log('[parse-chain] Has columnDataRanges:', !!context?.columnDataRanges);
    console.log('[parse-chain] Has sampleData:', !!context?.sampleData);
    console.log('[parse-chain] Has headers:', Array.isArray(context?.headers) ? context.headers.length : !!context?.headerRow);
    
    // 1. Extract data context
    const dataContext = extractDataContext(context);
    console.log('[parse-chain] Data columns:', dataContext.dataColumns.join(', '));
    console.log('[parse-chain] Data range:', dataContext.dataRange || 'MISSING!');
    console.log('[parse-chain] Row info: startRow=' + dataContext.startRow + ', endRow=' + dataContext.endRow + ', rowCount=' + dataContext.rowCount);
    console.log('[parse-chain] Sample data columns:', Object.keys(dataContext.sampleData).join(', ') || 'none');

    // 2. Generate embedding for semantic search
    let embedding: number[] | null = null;
    let similarWorkflows: StoredWorkflow[] = [];
    
    try {
      embedding = await generateEmbedding(command);
      console.log('[parse-chain] Generated embedding');
      
      // 3. Find similar successful workflows
      similarWorkflows = await findSimilarWorkflowsByEmbedding(embedding, 3, 0.7);
      console.log(`[parse-chain] Found ${similarWorkflows.length} similar workflows`);
      
      if (similarWorkflows.length > 0) {
        console.log('[parse-chain] Best match similarity:', similarWorkflows[0].similarity?.toFixed(3));
      }
    } catch (embeddingError) {
      // Embedding service unavailable - continue without semantic search
      console.warn('[parse-chain] Embedding failed, will use base examples:', embeddingError);
    }

    // 3.5. Get base examples from database (used as fallback if no similar workflows)
    let baseExamples: StoredWorkflow[] = [];
    try {
      baseExamples = await getBaseExamplesFromDB(6); // Get more than we need
      console.log(`[parse-chain] Fetched ${baseExamples.length} base examples from database`);
    } catch (baseError) {
      console.warn('[parse-chain] Could not fetch base examples from database:', baseError);
      // Will use minimal hardcoded fallback in prompt-builder
    }

    // 4. Build few-shot prompt
    const prompt = buildFewShotPrompt(command, dataContext, similarWorkflows, baseExamples);
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

    // 6. Parse and validate (lightly!)
    const chain = parseAndValidate(text, dataContext, command, embedding);
    
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
}

function extractDataContext(context: any): ExtendedDataContext {
  const selInfo = context?.selectionInfo;
  const columnData = context?.columnDataRanges || {};
  
  // BUGFIX (2026-01-21): More robust data column extraction
  // Try multiple sources in order of preference
  let dataColumns: string[] = [];
  
  // Priority 1: selectionInfo.columnsWithData (from auto-detection or explicit selection)
  if (selInfo?.columnsWithData && Array.isArray(selInfo.columnsWithData) && selInfo.columnsWithData.length > 0) {
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
  
  // Calculate empty columns dynamically based on actual data columns
  const emptyColumns = selInfo?.emptyColumns?.map((e: any) => e.column) || 
    getEmptyColumnsAfter(dataColumns, 10);
  
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
  
  // Extract row information - IMPROVED: Use columnDataRanges as fallback
  let startRow = selInfo?.dataStartRow;
  let endRow = selInfo?.dataEndRow;
  let rowCount = selInfo?.dataRowCount;
  
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
  if (dataColumns.length > 0) {
    const firstCol = dataColumns[0];
    const lastCol = dataColumns[dataColumns.length - 1];
    dataRange = `${firstCol}${startRow}:${lastCol}${endRow}`;
    
    // Override any single-column dataRange from selInfo with multi-column range
    if (selInfo?.dataRange && dataColumns.length > 1) {
      console.log('[parse-chain] Overriding selInfo.dataRange', selInfo.dataRange, 'with full range', dataRange);
    }
  } else if (selInfo?.dataRange) {
    // Fallback to selInfo.dataRange only if no dataColumns detected
    dataRange = selInfo.dataRange;
    console.log('[parse-chain] Using selInfo.dataRange as fallback:', dataRange);
  }
  // Final safety: If still no range, construct a minimal one
  else {
    dataRange = `A${startRow}:D${endRow}`;
    console.warn('[parse-chain] WARNING: No dataRange detected, using fallback A1 notation:', dataRange);
  }
  
  console.log('[parse-chain] Final dataRange:', dataRange, '| dataColumns:', dataColumns.join(','));
  
  return { dataColumns, emptyColumns, headers, sampleData, rowCount, startRow, endRow, dataRange };
}

// ============================================
// PARSE AND VALIDATE
// ============================================

function parseAndValidate(
  text: string,
  dataContext: ExtendedDataContext,
  originalCommand: string,
  embedding: number[] | null
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
    
    // Validate steps exist
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
      if (isMultiAspect) {
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
        prompt: step.prompt || `Process the data using ${action}`,
        outputFormat: step.outputFormat || '',
        inputColumns: inputCols,
        outputColumn: outputCol,
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
      rowCount: dataContext.rowCount
    });
    
    return {
      isMultiStep: steps.length > 1,
      isCommand: false,
      steps,
      summary: parsed.summary || `${steps.length}-step workflow`,
      clarification: parsed.clarification || `I'll process your data with this workflow:\n\n${stepDescriptions}\n\nProcessing ${dataContext.rowCount} rows.`,
      estimatedTime: `~${steps.length * 2} minutes`,
      
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
