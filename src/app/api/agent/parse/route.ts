/**
 * @file route.ts
 * @path /api/agent/parse
 * @version 2.1.0
 * @updated 2026-01-11
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
Your job is to extract structured information from natural language commands and create executable prompts.

The user wants to process data in a spreadsheet. Parse their command into a structured plan.

## Guidelines

1. **taskType**: Identify the task type:
   - translate, summarize, extract, classify, generate, clean, rewrite (for standard tasks)
   - custom (for calculations, conversions, date operations, formatting, or anything else)
   
2. **inputRange**: Extract cell range like "A2:A100". 
   - If user says "column B", infer the range from context.
   - If AUTO-DETECTED context is provided, use the first column with data.

3. **outputColumns**: Extract output column letters like ["B", "C"]. 
   - If not specified, use empty columns from context, or next column after input.
   - Look at empty columns in context to suggest appropriate outputs.

4. **prompt**: CRITICAL - Create a specific, actionable instruction for the AI to run on each cell's data.
   - Look at the HEADER NAMES in context to understand what the data represents
   - Use {{input}} as placeholder for each cell's data
   - Be specific about the expected output format
   
   Examples:
   - "Calculate employee seniority" with header "employee start date" → 
     "Calculate years of employment from this start date to today. Today is ${new Date().toISOString().split('T')[0]}. Return ONLY the number like '5 years'.\\n\\nStart date: {{input}}"
   - "Categorize sentiment" → 
     "Analyze the sentiment of this text. Return exactly one of: Positive, Negative, or Neutral.\\n\\nText: {{input}}"
   - "Extract emails" → 
     "Extract all email addresses from this text. Return emails separated by commas, or 'None' if no emails found.\\n\\nText: {{input}}"
   
5. **summary**: Write a clear human-readable summary of what will happen

6. **confidence**: 
   - 'high' if command explicitly specifies input/output columns
   - 'medium' if inferred from context (e.g., auto-detected data)
   - 'low' if ambiguous or missing critical info

## Important Rules

- ALWAYS generate a useful prompt, even for vague commands. Use context to figure out what the user likely wants.
- If context has AUTO-DETECTED DATA, the user hasn't explicitly selected anything - use the auto-detected columns.
- Look at header names to understand what the data represents.
- If only one column has data, that's likely the input.
- If there are empty columns, those are likely outputs.
- Only ask for clarification if you truly can't figure out what the user wants.

## Examples with Context

Command: "Calculate employee seniority"
Context: Column B has header "employee start date", Column C is empty
→ taskType: "custom"
→ inputRange: "B2:B100" (from context)
→ outputColumns: ["C"]
→ prompt: "Calculate years of employment from this start date to today (${new Date().toISOString().split('T')[0]}). Return only a number like '5 years'.\\n\\nStart date: {{input}}"
→ confidence: "medium"

Command: "Fill in the product descriptions"  
Context: Column A has "product name", Column B is empty with header "description"
→ taskType: "generate"
→ inputRange: "A2:A50"
→ outputColumns: ["B"]
→ prompt: "Generate a compelling product description for this product.\\n\\nProduct: {{input}}"
→ confidence: "medium"`;

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
        const headerList = context.headers.map((h: { column: string; name: string }) => 
          `${h.column}: "${h.name}"`
        ).join(', ');
        contextInfo += `\nSheet headers: ${headerList}`;
      }
      if (context.columnDataRanges) {
        const ranges = Object.entries(context.columnDataRanges)
          .filter(([_, data]: [string, any]) => data.hasData)
          .map(([col, data]: [string, any]) => `${col}: ${data.range} (${data.rowCount} rows)`)
          .join(', ');
        if (ranges) {
          contextInfo += `\nColumns with data: ${ranges}`;
        }
      }
      if (context.contextDescription) {
        contextInfo += `\n\nDetailed context:\n${context.contextDescription}`;
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
