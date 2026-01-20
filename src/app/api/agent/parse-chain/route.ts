/**
 * @file /api/agent/parse-chain
 * @version 5.0.0
 * @updated 2026-01-19
 * @author AISheeter Team
 * 
 * CHANGELOG:
 * - 5.0.0 (2026-01-19): Learning system integration
 *   - Uses workflow-learning lib for dynamic patterns
 *   - Patterns stored in database, cached in memory
 *   - System learns from successful workflows
 *   - Falls back to base patterns when DB unavailable
 * - 4.0.0: Quality-first with domain intelligence
 * - 3.0.0: Standard JSON prompt
 * 
 * ============================================
 * PARSE-CHAIN API - Intelligent Task Chain Generation
 * ============================================
 * 
 * This endpoint gets smarter over time by learning from:
 * 1. Successful workflow executions
 * 2. User modifications to suggested workflows
 * 3. New domain patterns discovered through usage
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import workflowLearning, {
  LearnedDomain,
  LearnedWorkflow,
  WorkflowStep,
} from '@/lib/workflow-learning';

// ============================================
// TYPES
// ============================================

interface TaskStep {
  id: string;
  order: number;
  action: string;
  description: string;
  inputColumns: string[];
  outputColumn: string;
  prompt: string;
  outputFormat?: string;
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
  domain?: string;
  workflowId?: string;  // Track which workflow was used for feedback
}

// ============================================
// MAIN HANDLER
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { command, context, provider = 'GEMINI', apiKey } = body;

    if (!command) {
      return NextResponse.json({ error: 'Command is required' }, { status: 400 });
    }

    // Extract data context
    const dataContext = extractDataContext(context);
    
    // Detect domain and workflow
    console.log('[parse-chain] 🔍 Detecting domain for command:', command.substring(0, 60) + '...');
    
    const domain = await workflowLearning.detectDomain(command);
    console.log('[parse-chain] Domain detected:', domain?.name || 'none');
    
    const workflow = await workflowLearning.findWorkflow(command, domain);
    console.log('[parse-chain] Matched workflow:', workflow?.id || 'none', workflow ? `(${workflow.steps.length} steps)` : '');

    if (workflow && workflow.steps.length > 0) {
      // Use learned workflow
      console.log('[parse-chain] ✨ Using learned workflow:', workflow.triggerPatterns[0]);
      const chain = buildChainFromWorkflow(workflow, domain, dataContext, command);
      
      // Verify the chain has valid steps
      const hasValidSteps = chain.steps.every(s => CORE_VALID_ACTIONS.includes(s.action));
      if (!hasValidSteps) {
        console.log('[parse-chain] ⚠️ Learned workflow has invalid actions, falling back to AI');
      } else {
        // Record usage (async, non-blocking)
        workflowLearning.recordWorkflowUsage(workflow.id).catch(() => {});
        return NextResponse.json(chain);
      }
    }

    // No matching workflow - use AI to generate one
    console.log('[parse-chain] 🤖 Generating AI workflow');
    const chain = await generateAIWorkflow(command, context, dataContext, provider, apiKey);
    
    return NextResponse.json(chain);

  } catch (error) {
    console.error('Parse chain error:', error);
    return NextResponse.json({ error: 'Failed to parse command chain' }, { status: 500 });
  }
}

// ============================================
// DATA CONTEXT EXTRACTION
// ============================================

interface DataContext {
  dataColumns: string[];
  emptyColumns: string[];
  headers: Record<string, string>;
  sampleData: Record<string, string[]>;
  rowCount: number;
  startRow: number;
  endRow: number;
}

function extractDataContext(context: any): DataContext {
  const selInfo = context?.selectionInfo;
  const columnData = context?.columnDataRanges || {};
  
  const dataColumns = selInfo?.columnsWithData || 
    Object.keys(columnData).filter(col => columnData[col]?.hasData);
  const emptyColumns = selInfo?.emptyColumns?.map((e: any) => e.column) || [];
  
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
  
  const startRow = selInfo?.dataStartRow || 2;
  const endRow = selInfo?.dataEndRow || 100;
  const rowCount = selInfo?.dataRowCount || (endRow - startRow + 1);
  
  return { dataColumns, emptyColumns, headers, sampleData, rowCount, startRow, endRow };
}

// ============================================
// BUILD CHAIN FROM LEARNED WORKFLOW
// ============================================

function buildChainFromWorkflow(
  workflow: LearnedWorkflow,
  domain: LearnedDomain | null,
  dataContext: DataContext,
  originalCommand: string
): TaskChain {
  const { dataColumns, emptyColumns, headers, startRow, endRow } = dataContext;
  
  // Build steps from workflow template
  const steps: TaskStep[] = workflow.steps.map((stepTemplate: WorkflowStep, idx: number) => {
    const outputCol = emptyColumns[idx] || String.fromCharCode('G'.charCodeAt(0) + idx);
    
    // Input columns: first step reads original data, later steps include previous outputs
    const inputCols = idx === 0 
      ? dataColumns 
      : [...dataColumns, ...emptyColumns.slice(0, idx)];
    
    // Customize prompt with actual column info
    let prompt = stepTemplate.promptTemplate;
    if (Object.keys(headers).length > 0) {
      const headerList = Object.entries(headers).map(([col, name]) => `${col}: ${name}`).join(', ');
      prompt = `Data columns: ${headerList}\n\n${prompt}`;
    }
    
    return {
      id: `step_${idx + 1}`,
      order: idx + 1,
      action: stepTemplate.action,
      description: stepTemplate.description,
      inputColumns: inputCols,
      outputColumn: outputCol,
      prompt,
      outputFormat: stepTemplate.outputFormat,
      dependsOn: idx > 0 ? `step_${idx}` : null,
      usesResultOf: idx > 0 ? `step_${idx}` : null,
    };
  });
  
  // Build clarification message
  const stepDescriptions = steps.map((s, i) => 
    `${i + 1}. ${s.description} → Column ${s.outputColumn}`
  ).join('\n');
  
  return {
    isMultiStep: true,
    isCommand: false,
    steps,
    summary: `${domain?.name || 'data'} analysis: ${steps.length} steps`,
    clarification: `I'll analyze your data with this workflow:\n\n${stepDescriptions}\n\nProcessing ${dataContext.rowCount} rows.`,
    estimatedTime: `~${steps.length * 2} minutes`,
    domain: domain?.name,
    workflowId: workflow.id,
  };
}

// ============================================
// AI-GENERATED WORKFLOW
// ============================================

async function generateAIWorkflow(
  command: string,
  context: any,
  dataContext: DataContext,
  provider: string,
  apiKey?: string
): Promise<TaskChain> {
  
  const { dataColumns, emptyColumns, headers, sampleData, rowCount, startRow, endRow } = dataContext;
  
  // Get valid actions from learning system
  const validActions = await workflowLearning.getValidActionNames();
  const actions = await workflowLearning.getActions();
  
  // Build action descriptions for prompt
  const actionDescriptions = actions
    .map(a => `- ${a.name}: ${a.description}`)
    .join('\n');

  const systemPrompt = `You are an expert at designing spreadsheet data workflows.

AVAILABLE ACTIONS:
${actionDescriptions}

Create a workflow with 2-4 steps. Each step must have:
- action: One of [${validActions.join(', ')}]
- description: 5-15 words describing what this step does
- prompt: Specific AI instruction (30+ chars) for processing each row
- outputFormat: Expected output format

IMPORTANT:
1. Steps must logically connect - Step 2 uses Step 1's output
2. Be SPECIFIC in prompts - not generic
3. Reference actual column names from context
4. Maximum 4 steps

Return ONLY valid JSON:
{
  "steps": [
    {
      "action": "extract|analyze|generate|classify|...",
      "description": "What this step does",
      "prompt": "Detailed, specific instruction",
      "outputFormat": "Expected format"
    }
  ],
  "summary": "Brief workflow summary",
  "clarification": "Friendly explanation for user"
}`;

  const headerInfo = Object.keys(headers).length > 0 
    ? Object.entries(headers).map(([col, name]) => `${col}: "${name}"`).join(', ')
    : 'No headers detected';
    
  const sampleInfo = Object.entries(sampleData)
    .map(([col, samples]) => `${col}: ${JSON.stringify(samples)}`)
    .join('\n');

  const userPrompt = `USER REQUEST: "${command}"

DATA CONTEXT:
- Data columns: ${dataColumns.join(', ')}
- Output columns: ${emptyColumns.slice(0, 4).join(', ') || 'G, H, I, J'}
- Headers: ${headerInfo}
- Samples:
${sampleInfo || 'No samples'}
- Rows: ${rowCount} (${startRow}-${endRow})

Return JSON workflow:`;

  try {
    const model = getModel(provider, apiKey);
    
    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
    });

    console.log('[parse-chain] AI response:', text.substring(0, 300));

    const result = parseAIResponse(text, dataContext, command, validActions);
    
    if (!isHighQuality(result)) {
      console.log('[parse-chain] ⚠️ Low quality, using smart fallback');
      return createSmartFallback(command, dataContext, validActions);
    }
    
    return result;

  } catch (error) {
    console.error('[parse-chain] AI error:', error);
    return createSmartFallback(command, dataContext, validActions);
  }
}

// ============================================
// PARSE AI RESPONSE
// ============================================

function parseAIResponse(
  text: string, 
  dataContext: DataContext,
  originalCommand: string,
  validActions: string[]
): TaskChain {
  try {
    console.log('[parseAIResponse] Starting parse...');
    console.log('[parseAIResponse] validActions:', validActions.length > 0 ? validActions.join(', ') : 'EMPTY - using fallback');
    
    // Extract JSON
    let jsonStr = text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      throw new Error('No steps array in response');
    }
    
    console.log(`[parseAIResponse] Found ${parsed.steps.length} raw steps`);
    
    const { dataColumns, emptyColumns } = dataContext;
    
    // Build steps with STRICT validation
    const steps: TaskStep[] = parsed.steps.slice(0, 4).map((step: any, idx: number) => {
      console.log(`[parseAIResponse] Processing step ${idx + 1}: raw action="${step.action}"`);
      
      // FORCE validation - never trust AI output
      const action = validateAction(step.action, validActions);
      const description = validateDescription(step.description, action);
      const prompt = validatePrompt(step.prompt, action);
      
      console.log(`[parseAIResponse] Step ${idx + 1} validated: action="${action}", desc="${description.substring(0, 40)}..."`);
      
      const outputCol = emptyColumns[idx] || String.fromCharCode('G'.charCodeAt(0) + idx);
      const inputCols = idx === 0 
        ? dataColumns 
        : [...dataColumns, ...emptyColumns.slice(0, idx)];
      
      return {
        id: `step_${idx + 1}`,
        order: idx + 1,
        action,  // Validated action
        description,  // Validated description
        inputColumns: inputCols,
        outputColumn: outputCol,
        prompt,  // Validated prompt
        outputFormat: step.outputFormat || '',
        dependsOn: idx > 0 ? `step_${idx}` : null,
        usesResultOf: idx > 0 ? `step_${idx}` : null,
      };
    });
    
    console.log(`[parseAIResponse] ✓ Built ${steps.length} validated steps`);
    
    return {
      isMultiStep: steps.length > 1,
      isCommand: false,
      steps,
      summary: parsed.summary || `${steps.length}-step workflow`,
      clarification: parsed.clarification || 'I\'ll process your data with this workflow.',
      estimatedTime: `~${steps.length * 2} minutes`,
    };
    
  } catch (error) {
    console.error('[parseAIResponse] Parse error:', error);
    throw error;
  }
}

// ============================================
// VALIDATION HELPERS
// ============================================

// Hardcoded fallback to ALWAYS ensure valid actions
const CORE_VALID_ACTIONS = ['extract', 'analyze', 'generate', 'classify', 'summarize', 'score', 'clean', 'translate', 'validate', 'rewrite', 'custom'];

function validateAction(action: string, validActions: string[]): string {
  // Use hardcoded list if validActions is empty
  const actions = validActions.length > 0 ? validActions : CORE_VALID_ACTIONS;
  
  const normalized = String(action || '').toLowerCase().trim();
  
  console.log(`[validateAction] Input: "${action}" → normalized: "${normalized}"`);
  
  if (actions.includes(normalized)) {
    console.log(`[validateAction] ✓ Valid action: ${normalized}`);
    return normalized;
  }
  
  // Common mappings from invalid to valid actions
  const map: Record<string, string> = {
    'process': 'analyze',
    'categorize': 'classify',
    'category': 'classify',
    'label': 'classify',
    'tag': 'classify',
    'find': 'extract',
    'get': 'extract',
    'pull': 'extract',
    'identify': 'extract',
    'create': 'generate',
    'write': 'generate',
    'suggest': 'generate',
    'recommend': 'generate',
    'rate': 'score',
    'rank': 'score',
    'grade': 'score',
    'evaluate': 'analyze',
    'assess': 'analyze',
    'review': 'analyze',
    'check': 'validate',
    'verify': 'validate',
    'fix': 'clean',
    'correct': 'clean',
    'convert': 'translate',
    'transform': 'rewrite',
  };
  
  const mapped = map[normalized];
  if (mapped && actions.includes(mapped)) {
    console.log(`[validateAction] 🔄 Mapped "${normalized}" → "${mapped}"`);
    return mapped;
  }
  
  // Default to analyze (most versatile action)
  console.log(`[validateAction] ⚠️ Unknown action "${normalized}" → defaulting to "analyze"`);
  return 'analyze';
}

function validateDescription(description: string, action: string): string {
  const desc = String(description || '').trim();
  
  // Check if description looks like user's original command (bad)
  const looksLikeUserCommand = /nobody has time|leadership wants|falling through|reps need/i.test(desc);
  
  if (desc.length >= 10 && desc.length <= 80 && !looksLikeUserCommand) {
    return desc;
  }
  
  console.log(`[validateDescription] ⚠️ Bad description (len=${desc.length}, isCommand=${looksLikeUserCommand}): "${desc.substring(0, 50)}..."`);
  
  // Defaults by action
  const defaults: Record<string, string> = {
    extract: 'Extract key information and signals from data',
    analyze: 'Analyze data and generate actionable insights',
    generate: 'Generate specific recommendations and next steps',
    classify: 'Classify and categorize items by priority/risk',
    summarize: 'Summarize key points concisely',
    score: 'Score and rank items numerically',
    clean: 'Clean and standardize data format',
    validate: 'Validate data quality and flag issues',
    translate: 'Translate content to target language',
    rewrite: 'Rewrite content for clarity and tone',
    custom: 'Process data with custom logic',
  };
  
  return defaults[action] || `${action.charAt(0).toUpperCase() + action.slice(1)} the data`;
}

function validatePrompt(prompt: string, action: string): string {
  const p = String(prompt || '').trim();
  if (p.length >= 30) return p;
  
  // Defaults by action
  const defaults: Record<string, string> = {
    extract: 'From this data, extract:\n1. Key information\n2. Notable patterns\n3. Important details',
    analyze: 'Analyze this data and provide:\n1. Key insight\n2. Supporting evidence\n3. Confidence (High/Medium/Low)',
    generate: 'Based on the analysis, generate a specific, actionable recommendation.',
    classify: 'Classify as exactly ONE of: High, Medium, or Low.\nFormat: [Category] - [Brief reason]',
    summarize: 'Summarize the key points in 1-2 sentences.',
    score: 'Score 1-10 and briefly explain.\nFormat: [Score]/10 - [Reason]',
    clean: 'Clean and standardize this data.',
    validate: 'Check validity and note any issues.\nFormat: [Valid/Invalid] - [Issues]',
  };
  
  return defaults[action] || p || 'Process this data.';
}

function isHighQuality(result: TaskChain): boolean {
  if (result.steps.length === 0) return false;
  
  for (const step of result.steps) {
    if (step.prompt.length < 20) return false;
    if (step.description.length < 5) return false;
  }
  
  return true;
}

// ============================================
// SMART FALLBACK
// ============================================

function createSmartFallback(
  command: string,
  dataContext: DataContext,
  validActions: string[]
): TaskChain {
  const { dataColumns, emptyColumns } = dataContext;
  
  // Analyze command intent
  const wantsInsights = /insight|understand|analyze|learn/i.test(command);
  const wantsActions = /action|next step|recommend|suggest/i.test(command);
  const wantsClassification = /risk|priority|category|classify|score|rate/i.test(command);
  
  const steps: TaskStep[] = [];
  let outputIdx = 0;
  
  // Step 1: Always analyze first
  if (validActions.includes('analyze')) {
    steps.push({
      id: 'step_1',
      order: 1,
      action: 'analyze',
      description: 'Analyze data and extract key insights',
      inputColumns: dataColumns,
      outputColumn: emptyColumns[outputIdx] || 'G',
      prompt: 'Analyze this data and provide:\n1. Key insight or finding\n2. Main concern or opportunity\n3. Notable pattern\n\nBe specific.',
      outputFormat: 'Insight | Concern | Pattern',
      dependsOn: null,
      usesResultOf: null,
    });
    outputIdx++;
  }
  
  // Step 2: Classification if requested
  if (wantsClassification && validActions.includes('classify')) {
    steps.push({
      id: 'step_2',
      order: 2,
      action: 'classify',
      description: 'Classify priority or risk level',
      inputColumns: [...dataColumns, emptyColumns[0] || 'G'],
      outputColumn: emptyColumns[outputIdx] || 'H',
      prompt: 'Based on the data and analysis, classify as:\n- High: Urgent attention needed\n- Medium: Should address soon\n- Low: Can wait\n\nFormat: [Level] - [Reason]',
      outputFormat: 'Level - Reason',
      dependsOn: 'step_1',
      usesResultOf: 'step_1',
    });
    outputIdx++;
  }
  
  // Step 3: Generate actions if requested
  if (wantsActions && validActions.includes('generate')) {
    steps.push({
      id: `step_${steps.length + 1}`,
      order: steps.length + 1,
      action: 'generate',
      description: 'Generate specific next action',
      inputColumns: [...dataColumns, ...emptyColumns.slice(0, outputIdx)],
      outputColumn: emptyColumns[outputIdx] || String.fromCharCode('G'.charCodeAt(0) + outputIdx),
      prompt: 'Based on all data and analysis, generate ONE specific, actionable next step.\n\nBe concrete: Who should do what by when?',
      outputFormat: 'Action item',
      dependsOn: `step_${steps.length}`,
      usesResultOf: `step_${steps.length}`,
    });
  }
  
  return {
    isMultiStep: steps.length > 1,
    isCommand: false,
    steps,
    summary: `${steps.length}-step analysis workflow`,
    clarification: `I'll analyze your data in ${steps.length} steps.`,
    estimatedTime: `~${steps.length * 2} minutes`,
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
