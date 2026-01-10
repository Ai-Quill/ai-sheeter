/**
 * @file route.ts
 * @path /api/agent/parse
 * @version 2.0.0
 * @updated 2026-01-10
 * 
 * AI-Powered Command Parsing with Structured Output
 * 
 * Uses Vercel AI SDK's Output.object() for reliable structured data generation.
 * See: https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data
 * 
 * This is more reliable than asking for JSON text because:
 * - Schema is enforced at generation time
 * - Output is automatically validated
 * - Type-safe response guaranteed
 */

import { NextRequest, NextResponse } from 'next/server';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, Output, NoObjectGeneratedError } from 'ai';
import { z } from 'zod';

// Use Gemini Flash for parsing (cheap & fast)
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY || ''
});

// ============================================
// STRUCTURED OUTPUT SCHEMA
// ============================================

/**
 * Schema for parsed command plan
 * Using Zod for type-safe structured output
 */
const ParsedPlanSchema = z.object({
  success: z.boolean().describe('Whether the command was successfully parsed'),
  plan: z.object({
    taskType: z.enum([
      'translate', 'summarize', 'extract', 'classify', 
      'generate', 'clean', 'rewrite', 'custom'
    ]).describe('Type of task to perform'),
    inputRange: z.string().nullable().describe('Cell range to read from, e.g. "A2:A100". Null if not specified.'),
    outputColumns: z.array(z.string()).describe('Column letters to write to, e.g. ["B", "C"]'),
    prompt: z.string().describe('The instruction to run on each cell'),
    summary: z.string().describe('Human-readable summary of what will happen'),
    confidence: z.enum(['high', 'medium', 'low']).describe('Confidence level: high if all fields clear, medium if inferred, low if ambiguous')
  }).nullable().describe('Parsed execution plan, null if clarification needed'),
  clarification: z.object({
    question: z.string().describe('Question to ask the user'),
    suggestions: z.array(z.string()).describe('Example commands to help the user')
  }).nullable().describe('Clarification request if command is ambiguous, null if plan is complete')
});

type ParsedPlan = z.infer<typeof ParsedPlanSchema>;

// ============================================
// SYSTEM PROMPT
// ============================================

const SYSTEM_PROMPT = `You are a command parser for a Google Sheets AI assistant.
Your job is to extract structured information from natural language commands.

The user wants to process data in a spreadsheet. Parse their command into a structured plan.

Guidelines:
1. taskType: Identify the task (translate, summarize, extract, classify, generate, clean, rewrite, or custom)
2. inputRange: Extract cell range like "A2:A100". Set to null if not mentioned.
3. outputColumns: Extract output column letters like ["B", "C"]. Empty array if not specified.
4. prompt: Create the actual instruction to run on each cell
5. summary: Write a clear human-readable summary
6. confidence: 'high' if everything is explicit, 'medium' if you inferred something, 'low' if major ambiguity

If the command is too ambiguous (no input range AND unclear task), set success=false and plan=null.
Provide clarification with a helpful question and example suggestions.

Examples of good commands:
- "Translate A2:A50 to Spanish in B" → high confidence, all fields clear
- "Summarize column A to B" → medium confidence (inferred "A:A" range)
- "Make my data better" → low confidence, needs clarification`;

// ============================================
// API HANDLER
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { command, context } = body;

    if (!command || typeof command !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Command is required' },
        { status: 400 }
      );
    }

    // Build context string if provided
    let contextInfo = '';
    if (context) {
      if (context.selectedRange) {
        contextInfo += `\nCurrently selected range: ${context.selectedRange}`;
      }
      if (context.headers && context.headers.length > 0) {
        contextInfo += `\nSheet headers: ${context.headers.join(', ')}`;
      }
    }

    const userMessage = `Parse this command: "${command}"${contextInfo}`;

    // Use structured output for reliable parsing
    // See: https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data
    const { output } = await generateText({
      model: google('gemini-2.0-flash'),
      system: SYSTEM_PROMPT,
      prompt: userMessage,
      temperature: 0.1, // Low temperature for consistent parsing
      output: Output.object({
        schema: ParsedPlanSchema,
      }),
    });

    // Output is guaranteed to match schema or throw NoObjectGeneratedError
    return NextResponse.json(output);

  } catch (error) {
    console.error('Agent parse error:', error);

    // Handle structured output generation failure
    if (NoObjectGeneratedError.isInstance(error)) {
      console.error('Failed to generate structured output:', error.text);
      return NextResponse.json({
        success: false,
        plan: null,
        clarification: {
          question: "I couldn't understand that command. Could you be more specific?",
          suggestions: [
            "Translate A2:A50 to Spanish in B",
            "Summarize the text in A2:A100 to column B",
            "Extract email addresses from A2:A50 to B"
          ]
        }
      });
    }

    return NextResponse.json(
      { 
        success: false, 
        plan: null,
        clarification: {
          question: "Something went wrong. Please try a simpler command.",
          suggestions: [
            "Translate A2:A50 to Spanish in B",
            "Summarize A2:A100 to B"
          ]
        }
      },
      { status: 500 }
    );
  }
}
