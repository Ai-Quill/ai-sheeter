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
      'generate', 'clean', 'rewrite', 'custom', 'analyze'
    ]).describe('Type of task to perform: analyze for complex multi-factor reasoning, classify for predefined categories only'),
    inputRange: z.string().nullable().describe('Cell range to read from, e.g. "A2:A100". Null if not specified.'),
    outputColumns: z.array(z.string()).describe('Column letters to write to, e.g. ["B", "C"]'),
    prompt: z.string().describe('The instruction to run on each cell'),
    summary: z.string().describe('Human-readable summary of what will happen'),
    confidence: z.enum(['high', 'medium', 'low']).describe('Confidence level: high if all fields clear, medium if inferred, low if ambiguous')
  }).nullable().describe('Parsed execution plan, null if clarification needed'),
  formulaSuggestion: z.object({
    formula: z.string().describe('Google Sheets formula using {input} as cell reference placeholder, e.g. =UPPER({input}) or =DATEDIF({input},TODAY(),"Y")'),
    description: z.string().describe('Brief description of what this formula does'),
    reliability: z.enum(['guaranteed', 'conditional']).describe('guaranteed = simple text/math formulas that always work; conditional = date/regex formulas that depend on data format'),
    warning: z.string().nullable().describe('Warning for conditional formulas explaining what could fail, e.g. "Requires valid date format"'),
  }).nullable().describe('If the task can be solved with a native Google Sheets formula, suggest it here. Formulas are instant and free. Null if AI is needed (translation, summarization, sentiment, creative tasks).'),
  clarification: z.object({
    question: z.string().describe('Question to ask the user'),
    suggestions: z.array(z.string()).describe('Example commands to help the user')
  }).nullable().describe('Clarification request if command is ambiguous, null if plan is complete')
});

type ParsedPlan = z.infer<typeof ParsedPlanSchema>;

// ============================================
// SYSTEM PROMPT - Enhanced for Smart Multi-Output Detection
// ============================================

const SYSTEM_PROMPT = `You are an EXPERT command parser for a Google Sheets AI assistant.
Your job is to understand what users REALLY want and create precise, actionable plans.

## CRITICAL: Understanding User Intent

Users often describe PROBLEMS, not commands. Your job is to figure out the BEST solution.

**Example of Problem-to-Solution Thinking:**
- User says: "Sales reps write notes but nobody reads them. Leadership wants insights."
- This is NOT a simple classification task
- This is a REQUEST for: insights + next steps + risk assessment
- Solution: Analyze with multiple outputs → 3 columns (insight, action, risk)

## Task Type Selection (BE PRECISE!)

Choose the MOST ACCURATE task type based on the PRIMARY cognitive task:

| TaskType | When to Use | Example |
|----------|-------------|---------|
| **analyze** | Complex understanding requiring reasoning across multiple factors, business intelligence, deal analysis | "Analyze deals for insights and risks" |
| **generate** | Create NEW content: recommendations, action items, suggestions | "Suggest follow-up actions" |
| **extract** | Pull SPECIFIC data FROM text: names, dates, signals, entities | "Extract buying signals from notes" |
| **classify** | Assign to PREDEFINED categories (Hot/Warm/Cold, Yes/No, etc.) | "Label as Hot/Warm/Cold" |
| **summarize** | Condense long text to shorter form | "Summarize in 1 sentence" |
| **translate** | Convert between languages | "Translate to Spanish" |
| **clean** | Fix formatting, typos, standardize | "Clean up addresses" |
| **rewrite** | Transform style/tone of existing text | "Make more professional" |
| **custom** | Calculations, dates, formatting, conversions | "Calculate days outstanding" |

**CRITICAL DISTINCTIONS:**
- "Generate insights about deal health" → taskType: "analyze" (reasoning/understanding)
- "Extract key points from text" → taskType: "extract" (finding existing info)
- "Classify as High/Med/Low" → taskType: "classify" (predefined categories)
- "What should we do next?" → taskType: "generate" (creating recommendations)
- Complex multi-factor analysis → taskType: "analyze" (NOT classify!)

## MULTI-OUTPUT DETECTION (EXTREMELY IMPORTANT!)

**ALWAYS detect when users want MULTIPLE distinct outputs.** Look for:

1. **Separators in request**: "return Insight | Next step | Risk" or "X / Y / Z"
2. **Multiple distinct nouns**: "insights, recommendations, and risk levels"
3. **Numbered expectations**: "1) summary 2) action 3) priority"
4. **Conjunctions with distinct items**: "extract signals AND generate next steps AND classify risk"
5. **Multiple column mentions**: "to columns G, H, I"
6. **Problem descriptions with multiple stakeholder needs**: "leadership wants X, reps need Y, deals need Z"
7. **Phrases like**: "for each row, provide...", "return multiple fields"

**When multi-output is detected:**
- outputColumns: ["G", "H", "I"] (ONE column per DISTINCT output type)
- prompt: Must specify EACH output with clear separator

**Multi-Output Prompt Format (USE THIS!):**
"Analyze this row and provide outputs separated by |||:
1. [First output description]
2. [Second output description]  
3. [Third output description]"

## Input Range Rules

**For tasks needing FULL CONTEXT** (analyze, generate recommendations, score, classify complex):
- Include ALL data columns in inputRange: "C2:F100" (spans columns C through F)
- AI needs complete row context for intelligent decisions
- Example: To analyze deals, need Company + Size + Stage + Notes

**For single-field tasks** (translate, summarize single column, extract from one field):
- Use single column: "A2:A100"

## Prompt Engineering (BE EXTREMELY SPECIFIC!)

**BAD prompt**: "Analyze this data"
**GOOD prompt**: "Analyze this deal (Company, Size, Stage, Notes) and provide: [1-line insight about deal health] ||| [specific next action for rep] ||| [Risk: High/Medium/Low]"

**For multi-output, ALWAYS use explicit separators (|||):**
- "Return outputs separated by |||: [Insight] ||| [Next Step] ||| [Risk Level]"

**Specify format for each output:**
- For insights: "one sentence about..."
- For actions: "specific, actionable recommendation"
- For categories: "exactly one of: High, Medium, Low"

## Formula Detection (computational tasks ONLY)

Only suggest formulas for PURE computation:
- Date math: =TODAY()-{input}, =DATEDIF(...)
- Text manipulation: =UPPER(), =TRIM(), =LEFT()
- Math operations: ={input}*1.1, =ROUND()

**NEVER suggest formulas for:**
- Translation, summarization, analysis, classification, generation
- Extraction from unstructured text
- Anything requiring understanding or reasoning

## EXAMPLES (Study These Carefully!)

### Example 1: Problem Description → Multi-Output Analysis

Command: "Sales reps write these notes but nobody has time to read them all. Leadership wants pipeline insights, reps need next steps, and deals are falling through the cracks."
Context: Column C: Company, D: Deal Size, E: Stage, F: Sales Notes, G/H/I: empty

→ taskType: "analyze" (complex multi-factor reasoning, NOT classify!)
→ inputRange: "C8:F15" (ALL context columns for full row understanding)
→ outputColumns: ["G", "H", "I"] (THREE distinct outputs!)
→ prompt: "Analyze this deal row (Company, Deal Size, Stage, Sales Notes) and provide THREE outputs separated by |||:
1. Pipeline Insight: One sentence about deal health, key signal or concern
2. Next Step: Specific actionable recommendation for the sales rep
3. Risk Level: High, Medium, or Low (with brief reason)"
→ summary: "Analyze each deal: pipeline insight → G, next step → H, risk level → I"
→ confidence: "high"

### Example 2: Explicit Multi-Column Extraction

Command: "Extract the key buying signals, objections, and competitors mentioned from Sales Notes to columns G, H, I"
Context: Column F: Sales Notes (long text), G/H/I: empty

→ taskType: "extract"
→ inputRange: "C8:F15" (include context for better extraction)
→ outputColumns: ["G", "H", "I"]
→ prompt: "From this deal data, extract THREE things separated by |||:
1. Buying Signals: Positive indicators (budget approved, champion, timeline, urgency)
2. Objections: Concerns, blockers, or hesitations mentioned
3. Competitors: Any competitor names mentioned (or 'None')"
→ summary: "Extract from notes: buying signals → G, objections → H, competitors → I"
→ confidence: "high"

### Example 3: Scoring with Reasoning

Command: "Based on ALL the data, score win probability as High/Medium/Low and give a 1-sentence reason"
Context: Multiple data columns including prior analysis, J empty

→ taskType: "analyze" (requires reasoning across multiple factors)
→ inputRange: "C8:I15" (include all prior columns)
→ outputColumns: ["J"]
→ prompt: "Based on all deal data (company, size, stage, signals, objections), provide: [High/Medium/Low] - [One sentence explaining why]"
→ summary: "Score win probability with reasoning based on all deal data → J"
→ confidence: "high"

### Example 4: Generate Specific Actions

Command: "Generate specific next action for each deal based on the signals and objections"
Context: Deal data plus extracted signals/objections, K empty

→ taskType: "generate"
→ inputRange: "C8:J15"
→ outputColumns: ["K"]
→ prompt: "Based on this deal's signals, objections, and current stage, generate ONE specific, actionable next step the rep should take this week"
→ summary: "Generate specific next action for each deal → K"
→ confidence: "high"

### Example 5: Simple Classification (Single Output)

Command: "Classify as Hot/Warm/Cold"
Context: Column B: Lead Description, C: empty

→ taskType: "classify"
→ inputRange: "B2:B100"
→ outputColumns: ["C"]
→ prompt: "Classify this lead as exactly one of: Hot (ready to buy), Warm (interested but needs nurturing), Cold (not interested or qualified)"
→ summary: "Classify leads as Hot/Warm/Cold → C"
→ confidence: "high"

### Example 6: Date Calculation (Formula)

Command: "Calculate days outstanding"
Context: Column C: Invoice Date, D: empty

→ taskType: "custom"
→ inputRange: "C2:C100"
→ outputColumns: ["D"]
→ prompt: "Calculate days since {{input}}"
→ formulaSuggestion: { formula: "=TODAY()-{input}", description: "Days since date", reliability: "conditional", warning: "Requires valid date format" }
→ confidence: "high"

## Final Rules (ALWAYS FOLLOW!)

1. **When in doubt about outputs, use MORE columns not fewer** - don't cram multiple outputs into one column
2. **taskType must match the PRIMARY cognitive task** - analyze for reasoning, extract for pulling data, classify only for predefined categories
3. **Include ALL data columns in inputRange for analysis/scoring tasks** - AI needs full context
4. **Use ||| as separator for multi-output prompts** - easy to parse programmatically
5. **Be extremely specific in prompts** - tell AI exactly what format each output should be
6. **Problem descriptions are NOT commands** - translate them into actionable multi-step solutions`;

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
    console.log('[Parse] Task detection:', detected.type, 'confidence:', detected.confidence);
    console.log('[Parse] Formula alternative:', detected.formulaAlternative ? detected.formulaAlternative.description : 'none');
    
    // ============================================
    // SMART OVERRIDE: Detect complex problem descriptions
    // These need multi-column analysis even if task detector returns 'custom'
    // ============================================
    const isComplexProblem = 
      /nobody.*(time|read|understand)/i.test(command) ||
      /leadership\s+wants/i.test(command) ||
      /falling\s+through/i.test(command) ||
      /insight/i.test(command) ||
      /(wants|needs).+,\s*(reps?|team|they)\s+(want|need)/i.test(command) ||
      /pipeline\s+(insight|intelligence)/i.test(command);
    
    const needsMultiOutput = 
      /\|/i.test(command) ||  // Pipe separator
      /(insight|next step|risk|action).+(insight|next step|risk|action)/i.test(command) ||
      /columns?\s+[A-Z],?\s*[A-Z]/i.test(command);
    
    if (isComplexProblem && detected.type === 'custom') {
      console.log('[Parse] 🔄 OVERRIDE: Detected complex problem description → changing to "analyze"');
      detected.type = 'analyze' as any;
      detected.confidence = 'medium';
    }
    
    console.log('[Parse] Final task type:', detected.type, 'isComplexProblem:', isComplexProblem, 'needsMultiOutput:', needsMultiOutput);
    
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
    // FAST AI PATH: High confidence, with or without formula option
    // Skip for 'calculate' type - let AI do smart formula detection
    // ============================================
    if (detected.confidence === 'high' && inputCol && inputRange && detected.type !== 'calculate') {
      const optimizedPrompt = taskOptimizer.buildOptimizedPrompt(
        command,
        detected,
        { headerName: context?.headerRow?.[inputCol], today }
      );
      
      const strategy = taskOptimizer.getProcessingStrategy(detected, rowCount);
      
      console.log('⚡ Fast AI path: Using task optimizer (no API call for parsing)');
      console.log('Optimized prompt:', optimizedPrompt);
      
      // Build response with optional formula
      const response: any = {
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
          reason: detected.formulaAlternative 
            ? `Formula available but ${detected.formulaAlternative.warning || 'may fail on some data'}. AI is more robust.`
            : 'No formula alternative available',
        },
      };
      
      // Include formula option if available (conditional formulas)
      if (detected.formulaAlternative && detected.formulaAlternative.reliability === 'conditional') {
        response._formulaOption = {
          template: detected.formulaAlternative.formula,
          description: detected.formulaAlternative.description,
          reliability: detected.formulaAlternative.reliability,
          warning: detected.formulaAlternative.warning,
          inputColumn: inputCol,
          outputColumn: outputCol,
          startRow: parseInt(inputRange.match(/\d+/)?.[0] || '2'),
          endRow: parseInt(inputRange.match(/:.*?(\d+)/)?.[1] || '100'),
          rowCount,
        };
        console.log('📋 Including formula option (conditional):', detected.formulaAlternative.warning);
      }
      
      return NextResponse.json(response);
    }

    // ============================================
    // STANDARD PATH: AI Parsing
    // ============================================
    
    // Get multiple empty columns for potential multi-output
    const emptyColumns = context?.selectionInfo?.emptyColumns?.map((e: any) => e.column) || [];
    const allDataColumns = context?.selectionInfo?.columnsWithData || [];
    
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
    
    // ============================================
    // SPECIAL HANDLING: Complex Problem Descriptions
    // ============================================
    if (isComplexProblem) {
      console.log('[Parse] 🎯 Complex problem detected - adding multi-output hints');
      contextInfo += `\n\n## IMPORTANT: This is a complex problem description!`;
      contextInfo += `\nThe user is describing a PROBLEM, not giving a simple command.`;
      contextInfo += `\nThey likely want MULTIPLE outputs. Use taskType "analyze" (NOT "custom" or "classify").`;
      contextInfo += `\nAvailable empty columns for output: ${emptyColumns.slice(0, 3).join(', ') || 'G, H, I'}`;
      contextInfo += `\nAll data columns (use as input): ${allDataColumns.join(', ') || 'C, D, E, F'}`;
      contextInfo += `\nCreate a prompt that generates MULTIPLE outputs separated by |||`;
      contextInfo += `\nSet outputColumns to multiple columns like ["G", "H", "I"] for: insight, next step, risk level`;
    }

    const userMessage = `Parse this command: "${command}"${contextInfo}`;
    
    console.log('[Parse] AI prompt context length:', contextInfo.length);

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
    
    console.log('[Parse] AI raw output:', JSON.stringify(output, null, 2));

    // Process AI response - handle formula suggestions
    const response: any = { ...output };
    
    // ============================================
    // POST-PROCESSING: Fix AI response for complex problems
    // ============================================
    if (isComplexProblem && response.plan) {
      console.log('[Parse] 🔧 Post-processing complex problem response...');
      
      // Fix task type if AI returned "custom" or "classify" for a complex problem
      if (response.plan.taskType === 'custom' || response.plan.taskType === 'classify') {
        console.log(`[Parse] Fixing taskType: ${response.plan.taskType} → analyze`);
        response.plan.taskType = 'analyze';
      }
      
      // Ensure multiple output columns for multi-output requests
      if (response.plan.outputColumns?.length === 1 && needsMultiOutput) {
        const baseCol = response.plan.outputColumns[0];
        const colCode = baseCol.charCodeAt(0);
        response.plan.outputColumns = [
          baseCol,
          String.fromCharCode(colCode + 1),
          String.fromCharCode(colCode + 2)
        ];
        console.log(`[Parse] Expanded outputColumns: ${response.plan.outputColumns.join(', ')}`);
      }
      
      // Ensure inputRange spans all data columns for complex analysis
      if (allDataColumns.length > 1 && response.plan.inputRange) {
        const firstCol = allDataColumns[0];
        const lastCol = allDataColumns[allDataColumns.length - 1];
        const rowMatch = response.plan.inputRange.match(/(\d+):.*?(\d+)/);
        if (rowMatch) {
          const startRow = rowMatch[1];
          const endRow = rowMatch[2];
          const newRange = `${firstCol}${startRow}:${lastCol}${endRow}`;
          if (response.plan.inputRange !== newRange) {
            console.log(`[Parse] Expanded inputRange: ${response.plan.inputRange} → ${newRange}`);
            response.plan.inputRange = newRange;
          }
        }
      }
      
      // Enhance prompt for multi-output if it doesn't have separators
      if (response.plan.prompt && !response.plan.prompt.includes('|||')) {
        console.log('[Parse] Adding ||| separator hint to prompt');
        response.plan.prompt = response.plan.prompt.replace(
          /{{input}}/g,
          '{{input}}'
        ) + '\n\nProvide outputs separated by ||| (triple pipes)';
      }
    }
    
    // If AI suggested a formula, transform it for the frontend
    if (output?.formulaSuggestion && output?.plan && inputCol && inputRange) {
      const fs = output.formulaSuggestion;
      console.log('🧮 AI suggested formula:', fs.formula, 'reliability:', fs.reliability);
      
      if (fs.reliability === 'guaranteed') {
        // Guaranteed formula - offer as primary action
        response.useFormula = true;
        response.formula = {
          template: fs.formula,
          description: fs.description,
          reliability: fs.reliability,
          inputColumn: inputCol,
          outputColumn: outputCol,
          startRow: parseInt(inputRange.match(/\d+/)?.[0] || '2'),
          endRow: parseInt(inputRange.match(/:.*?(\d+)/)?.[1] || '100'),
          rowCount,
        };
        response._meta = {
          recommendation: 'formula',
          reason: 'Formula is 100% reliable for this task - instant and free!',
        };
      } else {
        // Conditional formula - show as option, AI is default
        response.useFormula = false;
        response._formulaOption = {
          template: fs.formula,
          description: fs.description,
          reliability: fs.reliability,
          warning: fs.warning,
          inputColumn: inputCol,
          outputColumn: outputCol,
          startRow: parseInt(inputRange.match(/\d+/)?.[0] || '2'),
          endRow: parseInt(inputRange.match(/:.*?(\d+)/)?.[1] || '100'),
          rowCount,
        };
        response._meta = {
          recommendation: 'ai',
          reason: `Formula available but ${fs.warning || 'may fail on some data'}. AI is more robust.`,
        };
      }
    }
    
    // Clean up - don't send raw formulaSuggestion to frontend
    delete response.formulaSuggestion;

    return NextResponse.json(response);

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
