/**
 * Few-Shot Prompt Builder
 * 
 * Constructs prompts with concrete examples for workflow generation.
 * This is the key to getting high-quality output from the AI.
 * 
 * The principle: Show, don't tell.
 * Instead of abstract instructions, show the AI exactly what good output looks like.
 * 
 * @version 1.0.0
 * @updated 2026-01-20
 */

import { StoredWorkflow } from './index';

// ============================================
// TYPES
// ============================================

export interface DataContext {
  dataColumns: string[];
  emptyColumns: string[];
  headers: Record<string, string>;
  sampleData: Record<string, string[]>;
  rowCount: number;
  // Extended properties for accurate range information
  dataRange?: string;    // Full A1 notation like "A6:E18"
  startRow?: number;     // First row of data (e.g., 6)
  endRow?: number;       // Last row of data (e.g., 18)
}

interface WorkflowExample {
  command: string;
  context?: string;
  workflow: {
    steps: Array<{
      action: string;
      description: string;
      prompt: string;
      outputFormat: string;
    }>;
    summary: string;
    clarification: string;
  };
}

// ============================================
// PROMPT BUILDER
// ============================================

/**
 * Build a few-shot prompt for workflow generation
 * 
 * @param command - User's original command
 * @param dataContext - Information about the user's data
 * @param similarWorkflows - Semantically similar workflows from memory
 * @param baseExamples - Base examples from database (fallback if no similar workflows)
 * @returns The complete prompt string
 */
export function buildFewShotPrompt(
  command: string,
  dataContext: DataContext,
  similarWorkflows: StoredWorkflow[],
  baseExamples: StoredWorkflow[] = []
): string {
  // Get examples: prefer similar workflows, fall back to base examples
  const examples = getExamples(command, similarWorkflows, baseExamples);
  
  // Format the data context
  const contextStr = formatDataContext(dataContext);
  
  // Build the prompt with clear examples
  return `You are an expert workflow designer for spreadsheet data processing.

TASK: Generate a workflow to accomplish the user's request by following the pattern from similar examples above.
IMPORTANT: Study the SAMPLE DATA carefully to understand what type of content you're processing.

${formatExamples(examples)}

---

NOW GENERATE A WORKFLOW FOR THIS NEW REQUEST:

User Request: "${command}"

=== DATA CONTEXT (STUDY THIS CAREFULLY) ===
${contextStr}
===========================================

Available Output Columns: ${dataContext.emptyColumns.slice(0, 4).join(', ')}

CRITICAL RULES - FOLLOW STRICTLY:

1. DETECT OUTPUT MODE - Think about WHAT the user wants:

   The key distinction is between ACTIONS (do something to the sheet) vs QUESTIONS (tell me something).
   
   A. SHEET MODE (outputMode: "sheet") - User wants to PERFORM an action on the sheet
      
      Ask yourself: Is the user asking me to CREATE, MODIFY, or APPLY something to the spreadsheet?
      
      Sheet actions include:
      - Creating visualizations (charts, graphs)
      - Changing how data looks (formatting, styling)
      - Adding visual indicators (highlighting, color coding)
      - Adding data entry controls (dropdowns, checkboxes)
      - Changing what rows are visible (filtering)
      
      These are ACTIONS that change the sheet - they need outputMode: "sheet"
      
      Available sheetActions:
      - "chart" - Any request to visualize, plot, graph, or chart data
      - "format" - Any request to change number/date formatting or text styling
      - "conditionalFormat" - Any request to highlight or color-code based on values
      - "dataValidation" - Any request to add dropdowns, checkboxes, or restrict input
      - "filter" - Any request to show/hide rows based on criteria
      
   B. FORMULA MODE (outputMode: "formula") - Task can be done with native formulas
      Use when the transformation is mechanical and doesn't require understanding:
      - Translation, text extraction, case conversion, basic math
      
   C. CHAT MODE (outputMode: "chat") - User is asking a QUESTION
      The user wants INFORMATION, not an action. They want you to TELL them something.
      Look for question patterns: "What...", "Which...", "How many...", "Summarize for me..."
      
   D. COLUMNS MODE (outputMode: "columns") - User wants AI to PROCESS data row-by-row
      The user wants intelligent transformation that requires understanding context.
   
   **Key reasoning principle:**
   - Imperative/action requests → "sheet" or "formula" or "columns"
   - Interrogative/question requests → "chat"
   
   If someone says "create", "make", "add", "format", "highlight", "filter", "visualize", "plot" - 
   they want an ACTION, not a conversation. Use the appropriate action mode.

2. FOR CHAT MODE (outputMode: "chat"):
   - Set steps: [] (empty array)
   - Set isMultiStep: false
   - Set chatResponse: [your actual answer in MARKDOWN format]
   - Set summary: Brief description of what you're doing
   
   CRITICAL: Format chatResponse as MARKDOWN with clear structure:
   - Use ## for main sections (e.g., "## Top 3 Priorities by Segment")
   - Use ### for subsections (e.g., "### Enterprise Customers")
   - Use **bold** for emphasis
   - Use bullet lists (- or 1.) for items
   - Use tables for structured data
   - Add spacing between sections
   
   Example chatResponse format:
   
   ## Top 3 Priorities by Segment
   
   ### Enterprise Customers
   1. **Dashboard Performance** - Multiple customers report 10+ second load times
   2. **Better Documentation** - Onboarding taking 3+ weeks
   
   ## Main Churn Risks
   - 🚨 **High Priority**: Missing Okta SSO blocks $30K purchase
   - ⚠️ **Medium**: Free tier too limited (100 rows → need 1000)

3. FOR COLUMNS MODE (outputMode: "columns"):
   - ALWAYS RETURN AT LEAST 1 STEP: Even for simple tasks, return a workflow with 1 step
   - Set outputMode: "columns"
   - Follow all rules below for step creation

4. MATCH THE PATTERN: If the user's request is similar to one of the examples above, use the SAME STRUCTURE (same number of steps, similar actions). Don't add extra steps.

5. MULTI-ASPECT ANALYSIS: If the user asks to "rate" or "analyze" multiple specific aspects (Performance, UX, Pricing, etc.):
   - Use ONE step, not multiple steps
   - Action should be "classify"
   - outputFormat should list all aspects separated by " | " (e.g., "Performance | UX | Pricing | Features")
   - Each aspect will automatically get its own output column

6. DON'T ADD UNNECESSARY STEPS: Only create the steps the user explicitly requested. Don't add cleaning, validation, or summarization unless specifically asked.

7. Use ONLY these actions: extract, analyze, classify, generate, summarize, score, clean, validate, translate, rewrite

8. Each step must have: action, description (5-15 words), prompt (detailed instructions), outputFormat

9. SMART COLUMN SELECTION: Look at the SAMPLE DATA and HEADERS to determine which columns contain the relevant information. For example:
   - If asked to extract from "feedback", look for a column with header "Feedback" or sample data that looks like feedback text
   - Don't just use the first column - read the data context carefully!

RESPONSE FORMAT:

For SHEET mode - CHART (visualizations):
{
  "outputMode": "sheet",
  "sheetAction": "chart",
  "sheetConfig": {
    "chartType": "line",
    "xAxisColumn": "B",
    "dataColumns": ["C", "D", "E"],
    "title": "Revenue Trends Over Time",
    "xAxisTitle": "Month",
    "yAxisTitle": "Revenue",
    "seriesNames": ["PK Himlam", "PK Thanh Nhàn", "PK Văn Phú"],
    "curveType": "smooth"
  },
  "summary": "Create line chart for revenue trends",
  "clarification": "Creating a line chart to visualize revenue trends over time."
}

CRITICAL for CHARTS - Column-Based Approach:

YOUR JOB: Identify WHICH COLUMNS to use based on sample data. The frontend will detect the full data range.

1. COLUMN SELECTION (not row ranges!):
   - xAxisColumn: The column letter containing dates/labels for X-axis (e.g., "B")
   - dataColumns: Array of column letters containing numeric data series (e.g., ["C", "D", "E"])
   - Look at SAMPLE DATA to identify: dates are usually text like "01/01/2025", numeric data are numbers
   - The frontend will automatically detect ALL rows with data in these columns

2. DETECTING DATE vs NUMERIC COLUMNS from sample data:
   - Date columns have: "01/01/2025", "Jan 2025", "Tháng 1", "Monday", etc.
   - Numeric columns have: numbers, currency values, percentages
   - Use the date/label column as xAxisColumn
   - Use numeric columns as dataColumns

3. SERIES NAMES:
   - Extract from column HEADERS shown in context
   - Example headers: "PK Himlam", "PK Thanh Nhàn" → use these as seriesNames
   - Order should match dataColumns order

4. CHART OPTIONS:
   - curveType: "smooth" for curved lines, omit for straight
   - legendPosition: "bottom", "right", "top", "none"

For FORMAT sheet action:
{
  "outputMode": "sheet",
  "sheetAction": "format",
  "sheetConfig": {
    "formatType": "currency",
    "range": "B2:B100",
    "options": { "decimals": 2 }
  },
  "summary": "Format as currency",
  "clarification": "Applying currency format to the selected range."
}

For CONDITIONAL FORMAT sheet action:
{
  "outputMode": "sheet",
  "sheetAction": "conditionalFormat",
  "sheetConfig": {
    "range": "C2:C100",
    "rules": [
      { "condition": "greaterThan", "value": 100, "format": { "backgroundColor": "#90EE90" } },
      { "condition": "lessThan", "value": 0, "format": { "backgroundColor": "#FFB6C1" } }
    ]
  },
  "summary": "Highlight high/low values",
  "clarification": "Adding conditional formatting to highlight values."
}

For DATA VALIDATION sheet action:
{
  "outputMode": "sheet",
  "sheetAction": "dataValidation",
  "sheetConfig": {
    "validationType": "dropdown",
    "range": "D2:D100",
    "values": ["High", "Medium", "Low"]
  },
  "summary": "Add dropdown validation",
  "clarification": "Creating dropdown list for data entry."
}

For FILTER sheet action:
{
  "outputMode": "sheet",
  "sheetAction": "filter",
  "sheetConfig": {
    "dataRange": "A1:E100",
    "criteria": [
      { "column": "B", "condition": "equals", "value": "Active" }
    ]
  },
  "summary": "Filter to show active items",
  "clarification": "Applying filter to show only active rows."
}

For FORMULA mode (prefer this for text operations - it's FREE!):
{
  "outputMode": "formula",
  "isMultiStep": false,
  "isCommand": true,
  "steps": [{
    "action": "formula",
    "description": "Apply native Google Sheets formula",
    "prompt": "=GOOGLETRANSLATE(B{{ROW}}, \\"auto\\", \\"es\\")",
    "outputFormat": "formula"
  }],
  "summary": "Translate using GOOGLETRANSLATE formula",
  "clarification": "Using native Google Sheets GOOGLETRANSLATE formula.\\n\\n✅ FREE - no AI cost\\n✅ Instant - no processing time\\n✅ Auto-updates when data changes",
  "estimatedTime": "Instant"
}

IMPORTANT for formulas:
- Use {{ROW}} as placeholder for row number (will be replaced: {{ROW}} → 2, 3, 4...)
- Escape quotes in JSON: use \\" not "
- Common formulas:
  - GOOGLETRANSLATE(cell, "auto", "es") - translate to Spanish
  - REGEXEXTRACT(cell, "@(.*)") - extract email domain
  - TRIM(cell) - remove whitespace
  - UPPER(cell), LOWER(cell), PROPER(cell) - case conversion

For CHAT mode (user asking question):
{
  "outputMode": "chat",
  "isMultiStep": false,
  "isCommand": true,
  "steps": [],
  "summary": "Analyzing feedback to answer your question",
  "clarification": "I analyzed all feedback rows and identified...",
  "chatResponse": "[Your detailed answer here - analyze the actual data and provide insights]"
}

For COLUMNS mode (user transforming data with AI):
{
  "outputMode": "columns",
  "isMultiStep": false,
  "isCommand": true,
  "steps": [/* workflow steps */],
  "summary": "Extract competitors to column I",
  "clarification": "I'll scan each row and extract..."
}

Return ONLY valid JSON matching the format above. No markdown, no explanation.`;
}

// ============================================
// HELPERS
// ============================================

/**
 * Get the best examples to include in the prompt
 */
function getExamples(
  command: string, 
  similarWorkflows: StoredWorkflow[],
  baseExamples: StoredWorkflow[]
): WorkflowExample[] {
  // If we have similar workflows from memory, use those (they're proven to work)
  if (similarWorkflows.length >= 2) {
    console.log(`[PromptBuilder] Using ${similarWorkflows.length} similar workflows from memory`);
    return similarWorkflows.map(sw => ({
      command: sw.command,
      workflow: sw.workflow as WorkflowExample['workflow'],
    }));
  }
  
  // Otherwise, use base examples from database
  if (baseExamples.length > 0) {
    console.log(`[PromptBuilder] Using ${baseExamples.length} base examples from database`);
    
    // Rank examples by relevance to the command
    const rankedExamples = rankExamplesByRelevance(command, baseExamples);
    
    // Log which examples were selected
    console.log('[PromptBuilder] Selected examples:', rankedExamples.slice(0, 3).map(ex => ({
      command: ex.command.substring(0, 50) + '...',
      stepCount: ex.workflow?.steps?.length,
      actions: ex.workflow?.steps?.map(s => s.action)
    })));
    
    return rankedExamples.slice(0, 3).map(ex => ({
      command: ex.command,
      workflow: ex.workflow as WorkflowExample['workflow'],
    }));
  }
  
  // Final fallback: use minimal hardcoded examples
  console.warn('[PromptBuilder] No base examples in database, using minimal fallback');
  return getFallbackExamples(command);
}

/**
 * Format examples for the prompt
 */
function formatExamples(examples: WorkflowExample[]): string {
  return `EXAMPLES OF GOOD WORKFLOWS:

${examples.map((ex, i) => `
=== Example ${i + 1} ===
User request: "${ex.command}"
${ex.context ? `Data context: ${ex.context}` : ''}

Generated workflow:
${JSON.stringify(ex.workflow, null, 2)}
`).join('\n')}`;
}

/**
 * Format the data context for the prompt
 * This is CRITICAL - the AI needs to understand the actual data to generate good workflows
 */
function formatDataContext(ctx: DataContext): string {
  const parts: string[] = [];
  
  // IMPORTANT: Actual data range - AI MUST use this for sheetConfig.dataRange
  if (ctx.dataRange) {
    parts.push(`📍 ACTUAL DATA RANGE: ${ctx.dataRange}`);
    parts.push(`   (Use this exact range for sheetConfig.dataRange - do NOT guess!)`);
  }
  if (ctx.startRow && ctx.endRow) {
    parts.push(`   Data rows: ${ctx.startRow} to ${ctx.endRow} (${ctx.endRow - ctx.startRow + 1} rows including header)`);
  }
  
  // Columns with headers
  parts.push(`\nColumns with data: ${ctx.dataColumns.join(', ')}`);
  
  // Headers if available - show what each column represents
  if (Object.keys(ctx.headers).length > 0) {
    parts.push('\nColumn headers:');
    ctx.dataColumns.forEach(col => {
      const header = ctx.headers[col];
      if (header) {
        parts.push(`  - ${col}: "${header}"`);
      } else {
        parts.push(`  - ${col}: (no header)`);
      }
    });
  }
  
  // Sample data - THIS IS CRITICAL for understanding what the data actually contains
  if (Object.keys(ctx.sampleData).length > 0) {
    parts.push('\nSample data (first rows):');
    ctx.dataColumns.forEach(col => {
      const samples = ctx.sampleData[col] || [];
      if (samples.length > 0) {
        const header = ctx.headers[col] || col;
        const truncated = samples.slice(0, 3).map(s => {
          const str = String(s);
          return str.length > 100 ? str.substring(0, 100) + '...' : str;
        });
        parts.push(`  ${header} (${col}): ${JSON.stringify(truncated)}`);
      }
    });
  }
  
  // Row count
  parts.push(`\nTotal rows to process: ${ctx.rowCount}`);
  
  return parts.join('\n');
}

/**
 * Build a simpler prompt when we have a high-confidence match
 * (Used when a very similar workflow exists - just adapt it)
 */
export function buildAdaptationPrompt(
  command: string,
  dataContext: DataContext,
  matchedWorkflow: StoredWorkflow
): string {
  return `You are adapting an existing workflow to a new but similar request.

ORIGINAL REQUEST: "${matchedWorkflow.command}"
ORIGINAL WORKFLOW:
${JSON.stringify(matchedWorkflow.workflow, null, 2)}

NEW REQUEST: "${command}"
NEW DATA CONTEXT:
${formatDataContext(dataContext)}

Adapt the workflow above to fit the new request. Keep the same structure but:
1. Update prompts to reference the new data columns
2. Adjust descriptions if needed
3. Keep what works, change only what's necessary

Return the adapted workflow as JSON.`;
}

/**
 * Rank examples by relevance to the command
 * Prioritizes examples with similar keywords and patterns
 */
function rankExamplesByRelevance(command: string, examples: StoredWorkflow[]): StoredWorkflow[] {
  const commandLower = command.toLowerCase();
  
  return examples.map(ex => {
    let score = 0;
    const exCommandLower = ex.command.toLowerCase();
    
    // High priority: multi-aspect sentiment keywords
    if (commandLower.includes('aspect') || commandLower.includes('rate')) {
      if (exCommandLower.includes('aspect') || exCommandLower.includes('rate')) {
        score += 100;
      }
    }
    
    // Domain matching
    if (commandLower.includes('sentiment') || commandLower.includes('feedback')) {
      if (exCommandLower.includes('sentiment') || exCommandLower.includes('feedback')) {
        score += 50;
      }
    }
    
    if (commandLower.includes('sales') || commandLower.includes('pipeline')) {
      if (exCommandLower.includes('sales') || exCommandLower.includes('pipeline')) {
        score += 50;
      }
    }
    
    if (commandLower.includes('resume') || commandLower.includes('candidate')) {
      if (exCommandLower.includes('resume') || exCommandLower.includes('candidate')) {
        score += 50;
      }
    }
    
    // Pattern matching: number of steps
    const commandWords = commandLower.split(/\s+/);
    if (commandWords.includes('then') || commandWords.includes('and then')) {
      // Multi-step workflow likely - prefer multi-step examples
      if (ex.workflow?.steps && ex.workflow.steps.length > 1) {
        score += 20;
      }
    } else {
      // Single-step workflow likely - prefer single-step examples
      if (ex.workflow?.steps && ex.workflow.steps.length === 1) {
        score += 20;
      }
    }
    
    return { example: ex, score };
  })
  .sort((a, b) => b.score - a.score)
  .map(item => item.example);
}

/**
 * Minimal fallback examples (used only if database is unavailable)
 * Keep these minimal - database is the source of truth
 */
function getFallbackExamples(command: string): WorkflowExample[] {
  return [
    {
      command: 'Extract key information and classify the data',
      workflow: {
        steps: [
          {
            action: 'extract',
            description: 'Extract key information',
            prompt: 'Extract the key information from this data.\n\nBe specific and structured.',
            outputFormat: 'Extracted info'
          },
          {
            action: 'classify',
            description: 'Classify into categories',
            prompt: 'Classify this data into appropriate categories based on the extracted information.',
            outputFormat: 'Category'
          }
        ],
        summary: '2-step workflow: extract and classify',
        clarification: 'I\'ll extract key information and classify the data.'
      }
    }
  ];
}

export default buildFewShotPrompt;
