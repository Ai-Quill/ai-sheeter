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
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

import { generateEmbedding } from '@/lib/ai/embeddings';
import { findSimilarWorkflowsByEmbedding, StoredWorkflow } from '@/lib/workflow-memory';
import { buildFewShotPrompt, DataContext } from '@/lib/workflow-memory/prompt-builder';

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
    const { command, context, provider = 'GEMINI', apiKey } = body;

    if (!command) {
      return NextResponse.json({ error: 'Command is required' }, { status: 400 });
    }

    console.log('[parse-chain] Starting workflow generation');
    console.log('[parse-chain] Command:', command.substring(0, 80) + '...');

    // 1. Extract data context
    const dataContext = extractDataContext(context);
    console.log('[parse-chain] Data columns:', dataContext.dataColumns.join(', '));

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
    console.log('[parse-chain] Using model provider:', provider);
    const model = getModel(provider, apiKey);
    
    const { text } = await generateText({
      model,
      prompt,
    });

    console.log('[parse-chain] AI response length:', text.length);
    console.log('[parse-chain] AI raw response (first 500 chars):', text.substring(0, 500));

    // 6. Parse and validate (lightly!)
    const chain = parseAndValidate(text, dataContext, command, embedding);
    
    // Debug: Log what we're returning
    console.log('[parse-chain] Returning steps:', chain.steps.map(s => ({ action: s.action, desc: s.description?.substring(0, 30) })));
    
    const elapsed = Date.now() - startTime;
    console.log(`[parse-chain] Completed in ${elapsed}ms`);

    return NextResponse.json(chain);

  } catch (error) {
    console.error('[parse-chain] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate workflow' },
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
  if (context?.headers) {
    context.headers.forEach((h: any) => {
      headers[h.column] = h.name;
    });
  }
  
  const sampleData: Record<string, string[]> = {};
  if (selInfo?.columnSamples) {
    Object.entries(selInfo.columnSamples).forEach(([col, samples]: [string, any]) => {
      sampleData[col] = Array.isArray(samples) ? samples.slice(0, 2) : [];
    });
  }
  
  // Extract row information
  const startRow = selInfo?.dataStartRow || 2;
  const endRow = selInfo?.dataEndRow || (startRow + 9);
  const rowCount = selInfo?.dataRowCount || (endRow - startRow + 1);
  
  // Build full data range in A1 notation
  let dataRange = selInfo?.dataRange || '';
  if (!dataRange && dataColumns.length > 0) {
    const firstCol = dataColumns[0];
    const lastCol = dataColumns[dataColumns.length - 1];
    dataRange = `${firstCol}${startRow}:${lastCol}${endRow}`;
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

// ============================================
// MODEL HELPER
// ============================================

function getModel(provider: string, apiKey?: string) {
  switch (provider.toUpperCase()) {
    case 'CHATGPT':
      const openai = createOpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });
      return openai('gpt-4o-mini');
    case 'CLAUDE':
      const anthropic = createAnthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY });
      return anthropic('claude-3-haiku-20240307');
    case 'GEMINI':
    default:
      const google = createGoogleGenerativeAI({ apiKey: apiKey || process.env.GOOGLE_API_KEY });
      return google('gemini-1.5-flash');
  }
}
