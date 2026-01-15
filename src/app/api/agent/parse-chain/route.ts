/**
 * @file /api/agent/parse-chain
 * @version 1.0.0
 * @updated 2026-01-15
 * @author AISheeter Team
 * 
 * CHANGELOG:
 * - 1.0.0 (2026-01-15): Initial multi-step task chain parsing
 * 
 * ============================================
 * PARSE-CHAIN API - Multi-Step Task Detection
 * ============================================
 * 
 * Parses natural language commands that contain multiple steps:
 * - "Classify leads, then summarize by category"
 * - "Clean data, translate to Spanish, and categorize"
 * - "Extract emails, validate them, then score"
 * 
 * Returns a chain of tasks with dependencies.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

// Task chain structure
interface TaskStep {
  id: string;
  order: number;
  action: string;           // "classify", "translate", "summarize", etc.
  description: string;      // Human-readable description
  dependsOn: string | null; // Previous step ID or null
  usesResultOf: string | null; // Which step's result to use as input
  prompt: string;           // The prompt for this step
  outputColumn?: string;    // Where to write results
}

interface TaskChain {
  isMultiStep: boolean;
  steps: TaskStep[];
  summary: string;
  estimatedTime: string;
}

// Keywords that indicate multi-step commands
const CHAIN_INDICATORS = [
  'then', 'and then', 'after that', 'next', 'finally',
  'first', 'second', 'third', 
  ', and ', ', then ',
  'based on', 'using the results'
];

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

    // Quick check: does this look like a multi-step command?
    const lowerCommand = command.toLowerCase();
    const hasChainIndicator = CHAIN_INDICATORS.some(ind => lowerCommand.includes(ind));
    
    if (!hasChainIndicator) {
      // Single step - return simple response
      return NextResponse.json({
        isMultiStep: false,
        steps: [],
        summary: 'Single task detected',
        reason: 'No chain indicators found'
      });
    }

    // Use AI to parse the multi-step command
    const chain = await parseMultiStepCommand(command, context, provider, apiKey);
    
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
 * Use AI to parse a multi-step command into individual tasks
 */
async function parseMultiStepCommand(
  command: string, 
  context: any, 
  provider: string,
  apiKey?: string
): Promise<TaskChain> {
  
  const systemPrompt = `You are a task decomposition expert. Parse the user's command into individual steps.

CONTEXT:
- This is for a Google Sheets AI agent
- Each step should be a distinct, executable task
- Steps can depend on previous steps' results

OUTPUT FORMAT (JSON):
{
  "isMultiStep": true,
  "steps": [
    {
      "id": "step_1",
      "order": 1,
      "action": "classify|translate|summarize|extract|clean|generate",
      "description": "Brief description of what this step does",
      "dependsOn": null,
      "usesResultOf": null,
      "prompt": "The prompt to execute this step"
    },
    {
      "id": "step_2", 
      "order": 2,
      "action": "...",
      "description": "...",
      "dependsOn": "step_1",
      "usesResultOf": "step_1",
      "prompt": "..."
    }
  ],
  "summary": "One sentence summary of the full workflow"
}

RULES:
1. Maximum 5 steps (simplify if more)
2. Each step must be a single, clear action
3. Use dependsOn when step requires previous step to complete
4. Use usesResultOf when step needs data from previous step
5. Prompts should be specific and actionable`;

  const userPrompt = `Parse this command into steps:

"${command}"

${context?.headers ? `Available columns: ${JSON.stringify(context.headers)}` : ''}
${context?.columnDataRanges ? `Data ranges: ${JSON.stringify(Object.keys(context.columnDataRanges))}` : ''}`;

  try {
    // Get the appropriate model
    const model = getModel(provider, apiKey);
    
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.3, // Lower temp for structured output
    });

    // Parse the JSON response
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Add estimated time based on step count
      parsed.estimatedTime = estimateChainTime(parsed.steps?.length || 1);
      
      return parsed;
    }
    
    // Fallback if parsing fails
    return {
      isMultiStep: true,
      steps: [],
      summary: 'Failed to parse steps',
      estimatedTime: 'Unknown'
    };

  } catch (error) {
    console.error('AI parsing error:', error);
    return {
      isMultiStep: false,
      steps: [],
      summary: 'Parsing failed',
      estimatedTime: 'Unknown'
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
