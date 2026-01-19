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
 */
async function analyzeCommandWithAI(
  command: string, 
  context: any, 
  provider: string,
  apiKey?: string
): Promise<TaskChain> {
  
  const systemPrompt = `You are an expert at understanding user intent for a Google Sheets AI assistant.

Your job is to analyze user input and determine:
1. Is this a command (action to perform) or just a description/explanation?
2. If it's a command, is it single-step or multi-step?
3. If multi-step, break it into individual executable steps.

IMPORTANT DISTINCTIONS:
- "Sales reps write notes but nobody reads them" → DESCRIPTION, not a command (isMultiStep: false)
- "Extract signals from column F" → Single command (isMultiStep: false)
- "Extract signals, then classify deals, then generate next steps" → Multi-step command (isMultiStep: true)
- "Based on all the data, score win probability" → Single command (isMultiStep: false, even though complex)

OUTPUT FORMAT (JSON):
{
  "isMultiStep": boolean,
  "isCommand": boolean,
  "steps": [...],  // Only if isMultiStep is true
  "summary": "What this does",
  "clarification": "If not a command, suggest what they might want to do"
}

For multi-step commands, steps format:
{
  "id": "step_1",
  "order": 1,
  "action": "classify|translate|summarize|extract|clean|generate|analyze",
  "description": "What this step does",
  "dependsOn": null,
  "usesResultOf": null,
  "prompt": "The prompt for this step"
}

RULES:
1. Be conservative - only mark as multi-step if there are clearly SEPARATE actions
2. "Extract X, Y, and Z" is ONE step with multiple outputs, not three steps
3. Complex single commands (even with conditions) are still single-step
4. Maximum 5 steps
5. If input is a description, suggest a command they could use`;

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
