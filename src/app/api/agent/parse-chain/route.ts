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
import { findSimilarWorkflowsByEmbedding, StoredWorkflow } from '@/lib/workflow-memory';
import { buildFewShotPrompt, DataContext } from '@/lib/workflow-memory/prompt-builder';
import { authenticateRequest, getAuthErrorStatus, createAuthErrorResponse } from '@/lib/auth/auth-service';
import { getModel } from '@/lib/ai/models';

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
      console.warn('[parse-chain] Embedding failed, using base examples:', embeddingError);
    }

    // 4. Build few-shot prompt
    const prompt = buildFewShotPrompt(command, dataContext, similarWorkflows);
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
  
  const dataColumns = selInfo?.columnsWithData || 
    Object.keys(columnData).filter(col => columnData[col]?.hasData);
  
  const emptyColumns = selInfo?.emptyColumns?.map((e: any) => e.column) || 
    ['G', 'H', 'I', 'J'];
  
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
  }
  
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
    const steps: TaskStep[] = parsed.steps.slice(0, 4).map((step: any, idx: number) => {
      const action = normalizeAction(step.action);
      const outputCol = dataContext.emptyColumns[idx] || String.fromCharCode('G'.charCodeAt(0) + idx);
      
      // Input columns: first step reads data, later steps include previous outputs
      const inputCols = idx === 0 
        ? dataContext.dataColumns 
        : [...dataContext.dataColumns, ...dataContext.emptyColumns.slice(0, idx)];
      
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
    const stepDescriptions = steps.map((s, i) => 
      `${i + 1}. ${s.description} → Column ${s.outputColumn}`
    ).join('\n');
    
    return {
      isMultiStep: steps.length > 1,
      isCommand: false,
      steps,
      summary: parsed.summary || `${steps.length}-step workflow`,
      clarification: parsed.clarification || `I'll process your data with this workflow:\n\n${stepDescriptions}\n\nProcessing ${dataContext.rowCount} rows.`,
      estimatedTime: `~${steps.length * 2} minutes`,
      
      // Chain-level input configuration (critical for frontend execution!)
      inputRange: dataContext.dataRange,
      inputColumn: dataContext.dataColumns[0],
      inputColumns: dataContext.dataColumns,
      hasMultipleInputColumns: dataContext.dataColumns.length > 1,
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
  
  const steps: TaskStep[] = [
    {
      id: 'step_1',
      order: 1,
      action: 'analyze',
      description: 'Analyze data and extract insights',
      prompt: `Analyze this data in context of: "${command.substring(0, 100)}"\n\nProvide:\n1. Key insight or finding\n2. Important pattern or concern\n3. Notable observation`,
      outputFormat: 'Insight | Pattern | Observation',
      inputColumns: dataContext.dataColumns,
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
      inputColumns: [...dataContext.dataColumns, dataContext.emptyColumns[0] || 'G'],
      outputColumn: dataContext.emptyColumns[1] || 'H',
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
    
    // Chain-level input configuration
    inputRange: dataContext.dataRange,
    inputColumn: dataContext.dataColumns[0],
    inputColumns: dataContext.dataColumns,
    hasMultipleInputColumns: dataContext.dataColumns.length > 1,
    rowCount: dataContext.rowCount,
    
    _embedding: embedding || undefined,
    _command: command,
  };
}

// Model creation is now handled by authenticateRequest() from @/lib/auth/auth-service
