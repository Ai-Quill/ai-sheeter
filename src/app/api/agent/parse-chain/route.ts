/**
 * @file /api/agent/parse-chain
 * @version 2.0.0
 * @updated 2026-01-19
 * @author AISheeter Team
 * 
 * CHANGELOG:
 * - 2.0.0 (2026-01-19): Use AI SDK structured output with Zod for guaranteed valid responses
 * - 1.0.0 (2026-01-15): Initial multi-step task chain parsing
 * 
 * ============================================
 * PARSE-CHAIN API - Multi-Step Task Detection
 * ============================================
 * 
 * Uses AI SDK's structured output feature to guarantee valid JSON responses.
 * No more hoping the AI returns proper JSON - the schema enforces it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateText, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';

// Zod schema for structured output - AI SDK enforces this
const TaskStepSchema = z.object({
  id: z.string().describe('Unique step identifier like "step_1", "step_2"'),
  order: z.number().describe('Step order (1, 2, 3...)'),
  action: z.enum(['classify', 'extract', 'summarize', 'generate', 'analyze', 'translate', 'clean', 'score', 'validate'])
    .describe('The type of action to perform'),
  description: z.string().max(100).describe('Short description of this step (5-15 words)'),
  dependsOn: z.string().nullable().describe('ID of previous step this depends on, or null'),
  usesResultOf: z.string().nullable().describe('ID of step whose output to use as input, or null'),
  prompt: z.string().min(10).describe('Detailed instruction for AI to execute on each row'),
});

const TaskChainSchema = z.object({
  isMultiStep: z.boolean().describe('True if this is a multi-step workflow'),
  isCommand: z.boolean().describe('True if user gave a command, false if they described a problem'),
  steps: z.array(TaskStepSchema).max(5).describe('Array of workflow steps (max 5)'),
  summary: z.string().describe('Brief summary of the entire workflow'),
  clarification: z.string().describe('Friendly message explaining the proposed solution to the user'),
  estimatedTime: z.string().optional().describe('Estimated time like "~4 minutes"'),
});

// TypeScript types derived from Zod schema
type TaskStep = z.infer<typeof TaskStepSchema>;
type TaskChain = z.infer<typeof TaskChainSchema>;

/**
 * POST /api/agent/parse-chain
 * Parse a command and detect if it's multi-step
 * Uses AI to understand intent - not just pattern matching
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

    // Use AI to analyze the command - let AI decide if it's multi-step
    // AI is smarter than pattern matching for understanding natural language
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
 * Use AI SDK structured output to analyze command
 * The Zod schema GUARANTEES valid response structure - no more JSON parsing issues!
 */
async function analyzeCommandWithAI(
  command: string, 
  context: any, 
  provider: string,
  apiKey?: string
): Promise<TaskChain> {
  
  const systemPrompt = `You are an AI assistant for Google Sheets that converts user requests into actionable workflows.

Your job:
1. COMMAND ("classify column A", "translate to Spanish") → isCommand: true
2. DESCRIPTION ("sales notes are messy, need insights") → isCommand: false, propose workflow

FOR DESCRIPTIONS - propose CONCRETE ACTIONS:
Example: "Sales reps write notes but nobody reads them. Leadership wants insights, deals falling through."

Good steps:
- Step 1: action="extract", description="Extract key insights from notes", prompt="From each note, extract: deal status, concerns, next steps"
- Step 2: action="generate", description="Generate action items", prompt="Suggest 2-3 specific follow-up actions for each deal"
- Step 3: action="classify", description="Flag at-risk deals", prompt="Classify as: At-Risk, On Track, or Needs Follow-up"

BAD - never just split user text:
- "Sales reps write notes..." (this is NOT an action)
- "Leadership wants insights..." (this is NOT an action)

FOR COMMANDS:
- Single action → isMultiStep: false, steps: []
- Chained ("classify then summarize") → isMultiStep: true, proper steps

RULES:
1. Max 5 steps
2. Each step needs: action (verb), short description, detailed prompt
3. Steps must be executable on spreadsheet data
4. For descriptions, ALWAYS propose helpful workflow`;

  const userPrompt = `Analyze this user input and create a workflow:

"${command}"

${context?.headers ? `Available columns: ${JSON.stringify(context.headers)}` : ''}
${context?.columnDataRanges ? `Data ranges: ${JSON.stringify(Object.keys(context.columnDataRanges))}` : ''}
${context?.selectionInfo ? `Selection: ${context.selectionInfo.dataRange || 'none'}` : ''}`;

  try {
    const model = getModel(provider, apiKey);
    
    // Use AI SDK structured output - schema enforces valid response!
    const { output } = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.2,
      output: Output.object({
        schema: TaskChainSchema,
      }),
    });

    console.log('[parse-chain] Structured output:', JSON.stringify(output).substring(0, 300));

    // Output is already validated by Zod schema!
    const result = output as TaskChain;
    
    // Add estimated time if not provided
    if (result.isMultiStep && result.steps.length > 1 && !result.estimatedTime) {
      result.estimatedTime = estimateChainTime(result.steps.length);
    }
    
    return result;

  } catch (error) {
    console.error('[parse-chain] Structured output error:', error);
    // Fallback - process as single command
    return {
      isMultiStep: false,
      isCommand: true,
      steps: [],
      summary: 'Analysis failed - processing as single command',
      clarification: 'I had trouble understanding that. Try a simpler command.',
      estimatedTime: '< 1 minute'
    };
  }
}

/**
 * Get the AI model based on provider
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
      return google('gemini-2.0-flash-exp');
  }
}

/**
 * Estimate execution time based on number of steps
 */
function estimateChainTime(stepCount: number): string {
  const baseMinutes = stepCount * 2;
  if (baseMinutes < 1) return '< 1 minute';
  if (baseMinutes < 5) return `~${baseMinutes} minutes`;
  return `${baseMinutes}-${baseMinutes + 2} minutes`;
}
