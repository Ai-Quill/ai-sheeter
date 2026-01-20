/**
 * @file route.ts
 * @path /api/agent/classify-options
 * @version 1.0.0
 * @created 2026-01-13
 * 
 * AI-Powered Classification Options Detection
 * 
 * Analyzes column headers to determine appropriate classification options.
 * Instead of hardcoded patterns, uses AI to understand context and suggest
 * relevant options for each classification column.
 * 
 * Examples:
 * - "Sentiment" → "Positive, Negative, Neutral"
 * - "Related to quality?" → "Yes, No"
 * - "Priority" → "High, Medium, Low"
 * - "Category" → depends on context, could be "Bug, Feature, Question"
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { authenticateRequest, getAuthErrorStatus, createAuthErrorResponse } from '@/lib/auth/auth-service';

// ============================================
// STRUCTURED OUTPUT SCHEMA
// ============================================

const ColumnOptionsSchema = z.object({
  column: z.string().describe('Column letter (e.g., "C", "D", "E")'),
  header: z.string().describe('Column header text'),
  isClassification: z.boolean().describe('Whether this column expects classification output'),
  options: z.string().nullable().describe('Comma-separated classification options (e.g., "Yes, No" or "Positive, Negative, Neutral"), null if not a classification column'),
  reasoning: z.string().describe('Brief explanation of why these options were chosen')
});

const ClassificationAnalysisSchema = z.object({
  columns: z.array(ColumnOptionsSchema).describe('Analysis for each column'),
  language: z.string().describe('Detected language of headers (en, vi, es, etc.)')
});

type ClassificationAnalysis = z.infer<typeof ClassificationAnalysisSchema>;

// ============================================
// SYSTEM PROMPT
// ============================================

const SYSTEM_PROMPT = `You are an AI assistant that analyzes spreadsheet column headers to determine appropriate classification options.

Your job is to look at each column header and determine:
1. Is this a classification column? (expects a category/label, not detailed text)
2. If yes, what classification options are appropriate?

## Guidelines for Classification Detection

A column IS a classification column if it expects:
- A single category label (e.g., "Bug", "Feature", "Question")
- A rating (e.g., "High", "Medium", "Low")
- A yes/no answer
- A sentiment (e.g., "Positive", "Negative", "Neutral")
- A type/status (e.g., "Active", "Inactive", "Pending")

A column is NOT a classification column if it expects:
- Detailed text (e.g., "Analysis", "Summary", "Description")
- A translation
- A generated sentence or paragraph
- Extracted data (e.g., emails, names)

## Guidelines for Options Selection

For each classification column, suggest 2-5 options that make sense:

1. **Yes/No Questions**: Use "Yes, No" or language equivalent
   - "Is this related to X?"
   - "Does it contain Y?"
   - "Can we do Z?"
   
2. **Sentiment/Review**: Use positive/neutral/negative in detected language
   - "Sentiment" → "Positive, Negative, Neutral"
   - "Cảm xúc" → "Tốt, Xấu, Bình thường"
   - "Sentimiento" → "Positivo, Negativo, Neutral"
   
3. **Priority/Level**: Use high/medium/low or equivalent
   - "Priority" → "High, Medium, Low"
   - "Mức độ" → "Cao, Trung bình, Thấp"
   
4. **Custom Categories**: Infer from context if possible
   - "Issue Type" → "Bug, Feature, Question"
   - "Department" → "Sales, Marketing, Engineering, Support"
   - If can't infer, use generic options in detected language

## Language Detection

Detect the language from the headers and provide options in that language:
- English headers → English options
- Vietnamese headers → Vietnamese options
- Spanish headers → Spanish options
- etc.

## Example Analyses

Input: ["Product Title", "Review Text", "Sentiment", "Related to Quality?"]
Output:
- Column "Product Title": isClassification=false (expects text, not category)
- Column "Review Text": isClassification=false (expects text)
- Column "Sentiment": isClassification=true, options="Positive, Negative, Neutral"
- Column "Related to Quality?": isClassification=true, options="Yes, No"

Input: ["Đánh giá", "Phân loại đánh giá", "Liên quan đến chất lượng sản phẩm"]
Output:
- Column "Đánh giá": isClassification=false (review text, not classification)
- Column "Phân loại đánh giá": isClassification=true, options="Tốt, Xấu, Bình thường"
- Column "Liên quan đến chất lượng sản phẩm": isClassification=true, options="Có, Không"

Input: ["Customer Name", "Issue", "Type", "Priority"]
Output:
- Column "Customer Name": isClassification=false (expects name)
- Column "Issue": isClassification=false (expects description)
- Column "Type": isClassification=true, options="Bug, Feature, Question, Other"
- Column "Priority": isClassification=true, options="High, Medium, Low"`;

// ============================================
// API HANDLER
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { columns } = body;

    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Columns array is required' },
        { status: 400 }
      );
    }

    // Authenticate request using centralized auth service
    const auth = authenticateRequest(body);
    if (!auth.success) {
      return NextResponse.json(
        createAuthErrorResponse(auth),
        { status: getAuthErrorStatus(auth.code) }
      );
    }
    
    const { provider: aiProvider, modelId, model } = auth;

    // Build prompt with column information
    const columnList = columns.map((col: any) => 
      `- Column ${col.column}: "${col.header}"`
    ).join('\n');

    const userMessage = `Analyze these spreadsheet columns and determine appropriate classification options:\n\n${columnList}`;

    console.log('[classify-options] Analyzing columns:', columns.map((c: any) => c.column).join(', '));
    console.log('[classify-options] Using model:', aiProvider, modelId);
    
    // Model already obtained from authenticateRequest()
    // Use structured output for reliable parsing
    const { output } = await generateText({
      model,
      system: SYSTEM_PROMPT,
      prompt: userMessage,
      temperature: 0.2,
      output: Output.object({
        schema: ClassificationAnalysisSchema,
      }),
    });
    
    console.log('[classify-options] AI analysis:', JSON.stringify(output, null, 2));

    // Build response with per-column options
    const columnOptions: { [key: string]: string | null } = {};
    const columnReasons: { [key: string]: string } = {};
    
    for (const col of output.columns) {
      columnOptions[col.column] = col.options;
      columnReasons[col.column] = col.reasoning;
      console.log(`  ${col.column} (${col.header}): ${col.options || 'not classification'} - ${col.reasoning}`);
    }

    return NextResponse.json({
      success: true,
      columnOptions,
      language: output.language,
      _debug: {
        columnReasons
      }
    });

  } catch (error: any) {
    console.error('[classify-options] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
