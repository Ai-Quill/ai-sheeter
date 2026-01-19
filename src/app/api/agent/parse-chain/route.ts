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
  isCommand?: boolean;           // Is this a command or just a description?
  steps: TaskStep[];
  summary: string;
  estimatedTime?: string;
  clarification?: string;        // Friendly message explaining the proposal
  suggestedWorkflow?: {          // For descriptions, the proposed solution
    description: string;
    steps: string[];
  };
}

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
 * Use AI to analyze a command and determine if it's multi-step
 * AI understands natural language better than pattern matching
 * 
 * SMART FEATURE: When user describes a problem, AI proposes specific solutions
 */
async function analyzeCommandWithAI(
  command: string, 
  context: any, 
  provider: string,
  apiKey?: string
): Promise<TaskChain> {
  
  const systemPrompt = `You are an expert AI assistant for Google Sheets that understands user intent deeply.

Your job is to analyze user input and:
1. Determine if it's a COMMAND (action to perform) or a DESCRIPTION (problem/situation)
2. If COMMAND: determine if single-step or multi-step
3. If DESCRIPTION: **analyze what they want to achieve and propose a specific workflow**

SMART BEHAVIOR FOR DESCRIPTIONS:
When user describes a problem like "Sales reps write notes but nobody reads them, leadership wants insights, deals are falling through" - DON'T give generic suggestions!

Instead, EXTRACT their actual needs and propose SPECIFIC actions:
- "Leadership wants pipeline insights" → "Extract pipeline insights from sales notes"
- "Reps need next steps" → "Generate specific next actions for each deal"
- "Deals are falling through" → "Identify at-risk deals and flag urgent issues"

Then offer these as a PROPOSED WORKFLOW they can run!

OUTPUT FORMAT (JSON):
{
  "isMultiStep": boolean,
  "isCommand": boolean,
  "steps": [...],
  "summary": "What this workflow does",
  "clarification": "Friendly message explaining the proposed solution",
  "suggestedWorkflow": {
    "description": "Based on your needs, here's what I can do:",
    "steps": ["Step 1 description", "Step 2 description", "Step 3 description"]
  }
}

For DESCRIPTIONS (isCommand: false):
- Set isMultiStep: true if you're proposing a multi-step workflow
- Fill in "steps" with the proposed workflow steps
- Use "clarification" to explain the proposal in a friendly way
- The user will see these steps and can click "Run All Steps" to execute

For COMMANDS:
- isMultiStep: true only if there are clearly SEPARATE sequential actions
- "Extract X, Y, and Z" is ONE step with multiple outputs, not three steps

Steps format:
{
  "id": "step_1",
  "order": 1,
  "action": "classify|translate|summarize|extract|clean|generate|analyze",
  "description": "Clear description of this step",
  "dependsOn": null,
  "usesResultOf": null,
  "prompt": "The specific prompt to execute"
}

RULES:
1. Maximum 5 steps
2. Make steps actionable and specific to their data
3. Reference actual columns if mentioned in context
4. For descriptions, ALWAYS propose a helpful workflow - be proactive!`;

  const userPrompt = `Analyze this user input:

"${command}"

${context?.headers ? `Available columns: ${JSON.stringify(context.headers)}` : ''}
${context?.columnDataRanges ? `Data ranges: ${JSON.stringify(Object.keys(context.columnDataRanges))}` : ''}
${context?.selectionInfo ? `Selection: ${context.selectionInfo.dataRange || 'none'}` : ''}`;

  try {
    // Get the appropriate model
    const model = getModel(provider, apiKey);
    
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.2, // Lower temp for consistent output
    });

    console.log('[parse-chain] AI response:', result.text.substring(0, 200));

    // Parse the JSON response
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Add estimated time for multi-step
      if (parsed.isMultiStep && parsed.steps?.length > 1) {
        parsed.estimatedTime = estimateChainTime(parsed.steps.length);
      }
      
      return parsed;
    }
    
    // Fallback - assume single step
    return {
      isMultiStep: false,
      isCommand: true,
      steps: [],
      summary: 'Processing as single command',
      estimatedTime: 'Unknown'
    };

  } catch (error) {
    console.error('AI analysis error:', error);
    // On error, fail open - process as single command
    return {
      isMultiStep: false,
      isCommand: true,
      steps: [],
      summary: 'Analysis failed - processing as single command',
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
