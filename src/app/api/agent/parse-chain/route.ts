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
  action: z.enum(['classify', 'extract', 'summarize', 'generate', 'analyze', 'translate', 'clean', 'score', 'validate', 'rewrite', 'custom'])
    .describe('The type of action to perform'),
  description: z.string().min(5).max(100).describe('Short description of this step (5-15 words, must be meaningful)'),
  dependsOn: z.string().nullable().describe('ID of previous step this depends on, or null'),
  usesResultOf: z.string().nullable().describe('ID of step whose output to use as input, or null'),
  prompt: z.string().min(20).describe('Detailed instruction for AI to execute on each row (at least 20 characters)'),
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
  
  const systemPrompt = `You are an EXPERT AI assistant for Google Sheets that converts user requests into actionable workflows.

## Your Job

1. **COMMAND** ("classify column A", "translate to Spanish") → isCommand: true, usually single step
2. **PROBLEM DESCRIPTION** ("sales notes are messy, need insights") → isCommand: false, propose multi-step workflow

## For Problem Descriptions - Create ACTIONABLE Workflows

When user describes a PROBLEM (not a command), propose a concrete solution workflow.

**Example Input:**
"Sales reps write these notes but nobody has time to read them all. Leadership wants pipeline insights, reps need next steps, and deals are falling through the cracks."

**Good Workflow Response:**
\`\`\`
isMultiStep: true
isCommand: false
steps: [
  {
    id: "step_1",
    order: 1,
    action: "extract",
    description: "Extract buying signals, objections, competitors from notes",
    prompt: "From this deal data, extract: 1) Key buying signals (budget, timeline, champion) 2) Main objections or concerns 3) Any competitors mentioned. Separate with |||",
    dependsOn: null,
    usesResultOf: null
  },
  {
    id: "step_2", 
    order: 2,
    action: "analyze",
    description: "Score win probability with reasoning",
    prompt: "Based on all deal data including extracted signals and objections, provide: [Win Probability: High/Medium/Low] - [One sentence reason why]",
    dependsOn: "step_1",
    usesResultOf: "step_1"
  },
  {
    id: "step_3",
    order: 3,
    action: "generate",
    description: "Generate specific next action for each deal",
    prompt: "Based on this deal's stage, signals, and objections, generate ONE specific, actionable next step the sales rep should take this week",
    dependsOn: "step_2",
    usesResultOf: "step_2"
  }
]
clarification: "I understand - your sales notes contain valuable intelligence that's going unused. Here's a 3-step workflow to extract insights, score deals, and generate action items."
\`\`\`

## BAD Step Examples (NEVER DO THIS!)

❌ Description copies user's words: "Sales reps write notes..." 
❌ Vague action: "Process the data"
❌ No prompt: prompt is empty or too short
❌ Generic description: "Do something with the data"

## Good Step Requirements

Each step MUST have:
1. **action**: One of: classify, extract, summarize, generate, analyze, translate, clean, score, validate
2. **description**: 5-15 words describing WHAT this step does (not why)
3. **prompt**: 20+ characters with SPECIFIC instructions for the AI to execute

## Action Type Guide

| Action | When to Use | Example Prompt |
|--------|-------------|----------------|
| extract | Pull specific data FROM text | "Extract: 1) Buying signals 2) Objections 3) Competitors" |
| analyze | Complex reasoning across factors | "Based on all data, provide: [Insight] - [Risk Level]" |
| generate | Create new content/recommendations | "Generate ONE specific next action for the sales rep" |
| classify | Assign to predefined categories | "Classify as exactly one of: Hot, Warm, Cold" |
| score | Rate with numeric value + reason | "Score 1-10 and explain why" |
| summarize | Condense long text | "Summarize in 1 sentence" |

## For Simple Commands

- Single action → isMultiStep: false, steps: [] (empty array)
- The main /api/agent/parse endpoint handles single commands

## Rules

1. Maximum 5 steps per workflow
2. Each step MUST have valid action, meaningful description (5-15 words), and detailed prompt (20+ chars)
3. Steps must be executable on spreadsheet row data
4. For problems, ALWAYS propose a helpful workflow
5. Clarification should explain the proposed solution warmly`;

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
