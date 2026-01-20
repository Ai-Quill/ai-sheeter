/**
 * @file /api/agent/parse-chain
 * @version 3.0.0
 * @updated 2026-01-19
 * @author AISheeter Team
 * 
 * CHANGELOG:
 * - 3.0.0 (2026-01-19): Switched from Zod structured output to standard JSON prompt
 *   - Faster execution (no schema overhead)
 *   - More reliable (models often ignore Zod constraints)
 *   - Better control over sanitization and validation
 * - 2.0.0 (2026-01-19): Use AI SDK structured output with Zod
 * - 1.0.0 (2026-01-15): Initial multi-step task chain parsing
 * 
 * ============================================
 * PARSE-CHAIN API - Multi-Step Task Detection
 * ============================================
 * 
 * Uses standard JSON prompt with manual parsing.
 * Faster and more reliable than Zod structured output for this use case.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

// ============================================
// TYPES (no Zod - just TypeScript)
// ============================================

interface TaskStep {
  id: string;
  order: number;
  action: string;
  description: string;
  dependsOn: string | null;
  usesResultOf: string | null;
  prompt: string;
}

interface TaskChain {
  isMultiStep: boolean;
  isCommand: boolean;
  steps: TaskStep[];
  summary: string;
  clarification: string;
  estimatedTime?: string;
}

// Valid actions
const VALID_ACTIONS = ['classify', 'extract', 'summarize', 'generate', 'analyze', 'translate', 'clean', 'score', 'validate', 'rewrite', 'custom'];

// Action mapping for common mistakes
const ACTION_MAP: Record<string, string> = {
  'process': 'analyze',
  'processing': 'analyze',
  'analyse': 'analyze',
  'categorize': 'classify',
  'category': 'classify',
  'label': 'classify',
  'tag': 'classify',
  'find': 'extract',
  'get': 'extract',
  'pull': 'extract',
  'create': 'generate',
  'write': 'generate',
  'make': 'generate',
  'produce': 'generate',
  'condense': 'summarize',
  'shorten': 'summarize',
  'brief': 'summarize',
  'fix': 'clean',
  'correct': 'clean',
  'rate': 'score',
  'rank': 'score',
  'check': 'validate',
  'verify': 'validate',
};

/**
 * POST /api/agent/parse-chain
 * Parse a command and detect if it's multi-step
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { command, context, provider = 'GEMINI', apiKey } = body;

    if (!command) {
      return NextResponse.json(
        { error: 'Command is required' },
        { status: 400 }
      );
    }

    const chain = await analyzeCommandWithAI(command, context, provider, apiKey);
    return NextResponse.json(chain);

  } catch (error) {
    console.error('Parse chain error:', error);
    return NextResponse.json(
      { error: 'Failed to parse command chain' },
      { status: 500 }
    );
  }
}

/**
 * Analyze command using standard JSON prompt (faster than Zod)
 */
async function analyzeCommandWithAI(
  command: string, 
  context: any, 
  provider: string,
  apiKey?: string
): Promise<TaskChain> {
  
  const systemPrompt = `You convert user requests into spreadsheet workflows. Return ONLY valid JSON.

RULES:
1. COMMAND ("classify column A") → {"isCommand": true, "isMultiStep": false, "steps": []}
2. PROBLEM DESCRIPTION → {"isCommand": false, "isMultiStep": true, "steps": [...]}

VALID ACTIONS: extract, analyze, generate, classify, summarize, score, clean, translate, validate, rewrite

For problem descriptions, create 2-4 actionable steps. Each step:
- action: One of the VALID ACTIONS (NOT "process"!)
- description: 5-15 words about WHAT this step does (NOT user's words!)
- prompt: 20+ char AI instruction for processing each row

EXAMPLE INPUT: "Sales notes need insights, next steps, risk flags"
EXAMPLE OUTPUT:
{
  "isMultiStep": true,
  "isCommand": false,
  "steps": [
    {"id": "step_1", "order": 1, "action": "extract", "description": "Extract key insights from sales notes", "prompt": "Extract: 1) Buying signals 2) Concerns 3) Competitors", "dependsOn": null, "usesResultOf": null},
    {"id": "step_2", "order": 2, "action": "generate", "description": "Generate recommended next action", "prompt": "Suggest ONE specific next step based on the signals", "dependsOn": "step_1", "usesResultOf": "step_1"},
    {"id": "step_3", "order": 3, "action": "classify", "description": "Classify deal risk level", "prompt": "Classify as: High-Risk, Medium-Risk, or Low-Risk", "dependsOn": "step_2", "usesResultOf": "step_2"}
  ],
  "summary": "3-step workflow: extract insights, generate actions, classify risk",
  "clarification": "I'll analyze your sales notes in 3 steps to extract insights, suggest next actions, and flag risk levels."
}

Return ONLY the JSON object, no markdown, no explanation.`;

  const userPrompt = `User input: "${command}"
${context?.headers ? `Columns: ${JSON.stringify(context.headers)}` : ''}
${context?.selectionInfo?.columnsWithData ? `Data in: ${context.selectionInfo.columnsWithData.join(', ')}` : ''}

Return JSON:`;

  try {
    const model = getModel(provider, apiKey);
    
    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 1000,
    });

    console.log('[parse-chain] Raw response:', text.substring(0, 500));

    // Parse JSON from response
    const result = parseJsonResponse(text, command);
    
    console.log('[parse-chain] ✅ Parsed result:', result.summary, 'steps:', result.steps.length);
    return result;

  } catch (error) {
    console.error('[parse-chain] Error:', error);
    return createFallbackResponse('API error');
  }
}

/**
 * Parse and validate JSON response from AI
 */
function parseJsonResponse(text: string, originalCommand: string): TaskChain {
  try {
    // Try to extract JSON from response (handle markdown code blocks)
    let jsonStr = text.trim();
    
    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    
    // Find JSON object in text
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[parse-chain] No JSON found in response');
      return createFallbackResponse('No JSON in response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Validate and sanitize
    const isMultiStep = parsed.isMultiStep === true;
    const isCommand = parsed.isCommand !== false;
    
    let steps: TaskStep[] = [];
    if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
      steps = sanitizeSteps(parsed.steps, originalCommand);
    }
    
    // If we have valid steps, it's multi-step
    const result: TaskChain = {
      isMultiStep: steps.length > 1,
      isCommand: steps.length === 0,
      steps,
      summary: parsed.summary || (steps.length > 0 ? `${steps.length}-step workflow` : 'Single command'),
      clarification: parsed.clarification || "I'll help process this request.",
      estimatedTime: steps.length > 1 ? `~${steps.length * 2} minutes` : '< 1 minute',
    };
    
    return result;
    
  } catch (parseError) {
    console.error('[parse-chain] JSON parse error:', parseError);
    return createFallbackResponse('JSON parse failed');
  }
}

/**
 * Sanitize and fix steps that don't meet requirements
 */
function sanitizeSteps(steps: any[], originalCommand: string): TaskStep[] {
  const sanitized: TaskStep[] = [];
  
  for (let idx = 0; idx < Math.min(steps.length, 5); idx++) {
    const step = steps[idx];
    if (!step) continue;
    
    let action = String(step.action || 'analyze').toLowerCase();
    let description = String(step.description || '');
    let prompt = String(step.prompt || '');
    
    // Fix invalid action
    if (!VALID_ACTIONS.includes(action)) {
      const mapped = ACTION_MAP[action];
      if (mapped) {
        console.log(`[parse-chain] Mapped: "${action}" → "${mapped}"`);
        action = mapped;
      } else {
        console.log(`[parse-chain] Unknown action "${action}" → "analyze"`);
        action = 'analyze';
      }
    }
    
    // Fix description that copies user text
    const isCopiedText = description.length > 80 || 
      originalCommand.toLowerCase().includes(description.toLowerCase().substring(0, 30));
    
    if (isCopiedText || description.length < 5) {
      const defaults: Record<string, string> = {
        'extract': 'Extract key information from data',
        'analyze': 'Analyze data and provide insights',
        'generate': 'Generate recommendations',
        'classify': 'Classify into categories',
        'summarize': 'Summarize key points',
        'score': 'Score and rank items',
        'clean': 'Clean and standardize data',
        'translate': 'Translate content',
        'validate': 'Validate data quality',
        'rewrite': 'Rewrite content',
        'custom': 'Process data',
      };
      description = defaults[action] || `Step ${idx + 1}: ${action}`;
    }
    
    // Truncate if too long
    if (description.length > 100) {
      description = description.substring(0, 97) + '...';
    }
    
    // Fix prompt
    if (prompt.length < 20 || originalCommand.toLowerCase().includes(prompt.toLowerCase().substring(0, 20))) {
      const defaultPrompts: Record<string, string> = {
        'extract': 'Extract: 1) Key signals 2) Main concerns 3) Notable patterns',
        'analyze': 'Analyze and provide: 1) Key insight 2) Main factors to consider',
        'generate': 'Generate ONE specific, actionable recommendation',
        'classify': 'Classify as exactly one of: High, Medium, or Low',
        'summarize': 'Summarize the key points in 1-2 sentences',
        'score': 'Score 1-10 and briefly explain the rating',
        'clean': 'Clean and standardize this data',
        'translate': 'Translate accurately while preserving meaning',
        'validate': 'Check validity and note any issues',
        'rewrite': 'Rewrite to be clearer and more professional',
        'custom': 'Process according to requirements',
      };
      prompt = defaultPrompts[action] || 'Process: {{input}}';
    }
    
    sanitized.push({
      id: step.id || `step_${idx + 1}`,
      order: idx + 1,
      action,
      description,
      dependsOn: idx > 0 ? `step_${idx}` : null,
      usesResultOf: idx > 0 ? `step_${idx}` : null,
      prompt,
    });
  }
  
  return sanitized;
}

/**
 * Create a fallback response
 */
function createFallbackResponse(reason: string): TaskChain {
  console.log('[parse-chain] Fallback:', reason);
  return {
    isMultiStep: false,
    isCommand: true,
    steps: [],
    summary: 'Processing as single command',
    clarification: "I'll process this as a single action.",
    estimatedTime: '< 1 minute'
  };
}

/**
 * Get AI model - use fast models for this task
 */
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
