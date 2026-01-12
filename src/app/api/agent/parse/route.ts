/**
 * @file route.ts
 * @path /api/agent/parse
 * @version 2.2.0
 * @updated 2026-01-13
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
 * 
 * Now supports user's selected model instead of hardcoded Gemini.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateText, Output, NoObjectGeneratedError } from 'ai';
import { z } from 'zod';
import { getModel, AIProvider, getDefaultModel } from '@/lib/ai/models';
import { taskOptimizer, DetectedTask } from '@/lib/ai/task-optimizer';

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

4. **prompt**: CRITICAL - Create a CONCISE, actionable instruction. Shorter prompts = faster processing.
   - Use {{input}} as placeholder for each cell's data
   - Keep prompts SHORT (under 100 chars if possible)
   - Be specific about output format in ONE sentence
   
   Examples (notice how concise):
   - "Calculate employee seniority" → 
     "Years since {{input}} to ${new Date().toISOString().split('T')[0]}. Format: X years, Y months"
   - "Categorize sentiment" → 
     "Sentiment of: {{input}}. Reply: Positive/Negative/Neutral only"
   - "Extract emails" → 
     "Extract emails from: {{input}}. Return comma-separated or 'None'"
   - "Translate to Spanish" →
     "Spanish: {{input}}"
   
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

## Examples with Context (notice CONCISE prompts)

Command: "Calculate employee seniority"
Context: Column B has header "employee start date", Column C is empty
→ taskType: "custom"
→ inputRange: "B2:B100" (from context)
→ outputColumns: ["C"]
→ prompt: "Years since {{input}} to ${new Date().toISOString().split('T')[0]}. Format: X years, Y months"
→ confidence: "medium"

Command: "Fill in the product descriptions"  
Context: Column A has "product name", Column B is empty with header "description"
→ taskType: "generate"
→ inputRange: "A2:A50"
→ outputColumns: ["B"]
→ prompt: "Product description for: {{input}}. 1-2 sentences, engaging."
→ confidence: "medium"

Command: "Classify as urgent or normal"
Context: Column A has "support ticket", Column B is empty
→ taskType: "classify"
→ inputRange: "A2:A100"
→ outputColumns: ["B"]
→ prompt: "{{input}} → Urgent or Normal?"
→ confidence: "high"`;

// ============================================
// API HANDLER
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { command, context, provider, apiKey } = body;

    if (!command || typeof command !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Command is required' },
        { status: 400 }
      );
    }

    // Determine which model to use
    // Priority: user's selected provider > fallback to server's Gemini
    const aiProvider = (provider as AIProvider) || 'GEMINI';
    const modelApiKey = apiKey || process.env.GOOGLE_API_KEY || '';
    const modelId = getDefaultModel(aiProvider);
    
    if (!modelApiKey) {
      return NextResponse.json(
        { success: false, error: `No API key available for ${aiProvider}` },
        { status: 400 }
      );
    }

    // ============================================
    // TASK DETECTION
    // ============================================
    const detected = taskOptimizer.detectTaskType(command);
    console.log('Task detection:', detected.type, 'confidence:', detected.confidence);
    
    // Get context info
    const inputCol = context?.selectionInfo?.columnsWithData?.[0] || 
                     context?.selectionInfo?.sourceColumn;
    const outputCol = context?.selectionInfo?.emptyColumns?.[0]?.column ||
                      (inputCol ? String.fromCharCode(inputCol.charCodeAt(0) + 1) : 'B');
    
    // FIXED: Use selectionInfo's dataStartRow/dataEndRow (excludes header) 
    // instead of columnDataRanges which may include header row as data
    const selInfo = context?.selectionInfo;
    let inputRange: string | undefined;
    let rowCount: number;
    
    if (selInfo?.dataStartRow && selInfo?.dataEndRow && inputCol) {
      // Use corrected range that excludes header
      inputRange = `${inputCol}${selInfo.dataStartRow}:${inputCol}${selInfo.dataEndRow}`;
      rowCount = selInfo.dataRowCount || (selInfo.dataEndRow - selInfo.dataStartRow + 1);
      console.log('[Parse] Using selectionInfo range (header-excluded):', inputRange, 'rows:', rowCount);
    } else {
      // Fallback to columnDataRanges
      inputRange = context?.columnDataRanges?.[inputCol]?.range;
      rowCount = context?.columnDataRanges?.[inputCol]?.rowCount || 10;
      console.log('[Parse] Fallback to columnDataRanges:', inputRange, 'rows:', rowCount);
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    // ============================================
    // FORMULA PATH: Only for GUARANTEED reliability formulas
    // ============================================
    if (detected.formulaAlternative && inputCol && inputRange) {
      const formula = detected.formulaAlternative;
      const isGuaranteed = formula.reliability === 'guaranteed';
      
      console.log('🧮 Formula detected:', formula.description);
      console.log('   Reliability:', formula.reliability);
      
      if (isGuaranteed) {
        // 100% safe formula - offer as primary action
        console.log('✅ Guaranteed formula - offering as primary action');
        
        return NextResponse.json({
          success: true,
          useFormula: true,
          formula: {
            template: formula.formula,
            description: formula.description,
            reliability: formula.reliability,
            inputColumn: inputCol,
            outputColumn: outputCol,
            startRow: parseInt(inputRange.match(/\d+/)?.[0] || '2'),
            endRow: parseInt(inputRange.match(/:.*?(\d+)/)?.[1] || '100'),
            rowCount,
          },
          plan: {
            taskType: detected.type,
            inputRange,
            outputColumns: [outputCol],
            prompt: taskOptimizer.buildOptimizedPrompt(command, detected, { headerName: context?.headerRow?.[inputCol], today }),
            summary: `${formula.description} (${inputRange} → ${outputCol})`,
            confidence: 'high',
          },
          _meta: {
            recommendation: 'formula',
            reason: 'Formula is 100% reliable for this task - instant and free!',
          },
        });
      } else {
        // Conditional formula - use AI as default, show formula as option
        console.log('⚠️ Conditional formula - using AI as default, formula as option');
        
        const optimizedPrompt = taskOptimizer.buildOptimizedPrompt(
          command,
          detected,
          { headerName: context?.headerRow?.[inputCol], today }
        );
        const strategy = taskOptimizer.getProcessingStrategy(detected, rowCount);
        
        return NextResponse.json({
          success: true,
          useFormula: false, // AI is default for conditional formulas
          plan: {
            taskType: detected.type,
            inputRange,
            outputColumns: [outputCol],
            prompt: optimizedPrompt,
            summary: `${detected.type.charAt(0).toUpperCase() + detected.type.slice(1)} ${inputRange} → column ${outputCol}`,
            confidence: 'high',
          },
          // Include formula as OPTION, not default
          _formulaOption: {
            template: formula.formula,
            description: formula.description,
            reliability: formula.reliability,
            warning: formula.warning,
            inputColumn: inputCol,
            outputColumn: outputCol,
            startRow: parseInt(inputRange.match(/\d+/)?.[0] || '2'),
            endRow: parseInt(inputRange.match(/:.*?(\d+)/)?.[1] || '100'),
            rowCount,
          },
          _optimization: {
            batchable: strategy.batchable,
            recommendedBatchSize: strategy.recommendedBatchSize,
            estimatedTokens: strategy.estimatedTokensPerRow * rowCount,
            systemPromptAddition: strategy.systemPrompt,
          },
          _meta: {
            recommendation: 'ai',
            reason: `Formula available but ${formula.warning || 'may fail on some data'}. AI is more robust.`,
          },
        });
      }
    }
    
    // ============================================
    // FAST AI PATH: High confidence, no formula available
    // ============================================
    if (detected.confidence === 'high' && inputCol && inputRange) {
      const optimizedPrompt = taskOptimizer.buildOptimizedPrompt(
        command,
        detected,
        { headerName: context?.headerRow?.[inputCol], today }
      );
      
      const strategy = taskOptimizer.getProcessingStrategy(detected, rowCount);
      
      console.log('⚡ Fast AI path: Using task optimizer (no API call for parsing)');
      console.log('Optimized prompt:', optimizedPrompt);
      
      return NextResponse.json({
        success: true,
        useFormula: false,
        plan: {
          taskType: detected.type,
          inputRange,
          outputColumns: [outputCol],
          prompt: optimizedPrompt,
          summary: `${detected.type.charAt(0).toUpperCase() + detected.type.slice(1)} ${inputRange} → column ${outputCol}`,
          confidence: detected.confidence,
        },
        _optimization: {
          batchable: strategy.batchable,
          recommendedBatchSize: strategy.recommendedBatchSize,
          estimatedTokens: strategy.estimatedTokensPerRow * rowCount,
          systemPromptAddition: strategy.systemPrompt,
        },
        _meta: {
          recommendation: 'ai',
          reason: 'No formula alternative available',
        },
      });
    }

    // ============================================
    // STANDARD PATH: AI Parsing
    // ============================================
    
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
    
    // Include task detection hints for AI
    if (detected.confidence !== 'low') {
      contextInfo += `\n\nTask hint: Detected as "${detected.type}" task.`;
      if (detected.formulaAlternative) {
        contextInfo += ` (Formula alternative available: ${detected.formulaAlternative.description})`;
      }
    }

    const userMessage = `Parse this command: "${command}"${contextInfo}`;

    console.log('Standard path: Using AI parsing');
    console.log('Using model:', aiProvider, modelId);
    
    // Get the model using the unified factory
    const model = getModel(aiProvider, modelId, modelApiKey);
    
    // Use structured output for reliable parsing
    // See: https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data
    const { output } = await generateText({
      model,
      system: SYSTEM_PROMPT,
      prompt: userMessage,
      temperature: 0.1, // Low temperature for consistent parsing
      output: Output.object({
        schema: ParsedPlanSchema,
      }),
    });
    
    console.log('AI output:', JSON.stringify(output, null, 2));

    // Output is guaranteed to match schema or throw NoObjectGeneratedError
    return NextResponse.json(output);

  } catch (error: any) {
    console.error('Agent parse error:', error);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);

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

    // Return error details for debugging
    return NextResponse.json(
      { 
        success: false, 
        plan: null,
        clarification: {
          question: `Something went wrong: ${error?.message || 'Unknown error'}. Please try a simpler command.`,
          suggestions: [
            "Translate A2:A50 to Spanish in B",
            "Summarize A2:A100 to B"
          ]
        },
        _debug: {
          error: error?.message,
          name: error?.name
        }
      },
      { status: 500 }
    );
  }
}
