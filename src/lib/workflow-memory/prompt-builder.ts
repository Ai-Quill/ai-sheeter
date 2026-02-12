/**
 * Few-Shot Prompt Builder
 * 
 * Constructs prompts with concrete examples for workflow generation.
 * This is the key to getting high-quality output from the AI.
 * 
 * The principle: Show, don't tell.
 * Instead of abstract instructions, show the AI exactly what good output looks like.
 * 
 * NEW in v2.0: Skill-based adaptive prompts
 * - Detects user intent and loads only relevant skills
 * - Reduces token usage by 50-70%
 * - Learns from success/failure patterns
 * 
 * @version 2.0.0
 * @updated 2026-01-30
 */

import { StoredWorkflow } from './index';

// Import skill system
import {
  selectSkills,
  loadSkillInstructions,
  loadSkillExamples,
  formatExamplesForPrompt,
  analyzeIntent,
  CORE_INSTRUCTIONS,
  BuiltPrompt,
  DataContext as SkillDataContext,
} from '../skills';

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
  // Explicit row information for precise targeting (e.g., header formatting)
  explicitRowInfo?: {
    headerRowNumber: number | null;
    headerRange: string | null;          // e.g., "B3:H3" - EXACT range for header row
    dataStartRow: number;
    dataEndRow: number;
    dataRange: string;                   // e.g., "B4:H11" - data only, no headers
    fullRangeIncludingHeader: string | null;  // e.g., "B3:H11" - includes header
    headerNames?: Array<{ column: string; name: string }>;
  };
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
        ⚠️ IMPORTANT: For "format" actions, use explicitRowInfo to get correct ranges:
        - "format headers" → Use explicitRowInfo.headerRange (NOT first row of dataRange!)
        - "format data" → Use explicitRowInfo.dataRange
        - The headerRange and dataRange are different! Headers might not be at row 1.
      - "conditionalFormat" - Any request to highlight or color-code based on values
      - "dataValidation" - Any request to add dropdowns, checkboxes, or restrict input
      - "filter" - Any request to show/hide rows based on criteria
      - "writeData" - User pastes table/CSV data in the command and wants it written to the sheet
        Use when command contains INLINE TABLE DATA (markdown tables, CSV, pipe-separated, etc.)
        Parse the data into a 2D array and write to the specified location
      - "sheetOps" - Sheet-level operations: freeze, sort, hide/show, insert/delete, resize, etc.
        Uses sheetConfig.operations array where each item has { operation: "[type]", ...params }
      
   B. FORMULA MODE (outputMode: "formula") - Task can be done with native formulas ONLY
      Use when the transformation is mechanical and doesn't require understanding:
      - Translation, text extraction, case conversion, basic math
      ⚠️ NEVER use outputMode "formula" when the request also involves a chart, format, or other sheet action.
      If you need a formula step AND a sheet action (e.g., chart), use outputMode: "sheet" with isMultiStep: true.
      
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
    "domainColumn": "A",
    "dataColumns": ["B", "C", "D"],
    "title": "Revenue Trends Over Time",
    "xAxisTitle": "Month",
    "yAxisTitle": "Revenue",
    "seriesNames": ["Store A", "Store B", "Store C"],
    "curveType": "smooth"
  },
  "summary": "Create line chart for revenue trends",
  "clarification": "Creating a line chart to visualize revenue trends over time."
}

CRITICAL for CHARTS - Unified Column-Based Approach:

YOUR JOB: Identify WHICH COLUMNS to use based on CURRENT sample data. The frontend will detect the full data range.

⚠️ CRITICAL - FRESH CONTEXT ONLY:
1. IGNORE any column info from previous messages in this conversation
2. Look ONLY at the "DATA CONTEXT" section shown above for THIS request
3. Count the columns: if context shows columns B, C, D, E → use ALL relevant ones
4. Extract seriesNames from the ACTUAL headers shown in context, not from memory

== UNIFIED SCHEMA FOR ALL CHART TYPES ==
{
  "chartType": "line|bar|column|pie|area|scatter|histogram",
  "domainColumn": "A",          // ALWAYS: The category/label/date/x-axis column (text or dates)
  "dataColumns": ["B", "C"],    // ALWAYS: Array of numeric value columns
  "seriesNames": ["Revenue", "Expenses"],  // Legend labels from column headers
  "annotationColumn": "A",      // OPTIONAL: Column with text labels for data points (e.g., names, IDs)
  "title": "Chart Title"
}

COLUMN RULES:
1. domainColumn: The column containing categories, labels, or dates (usually TEXT)
   - Look for: dates ("01/01/2025"), categories ("Product A"), months ("Jan", "Feb")
   
2. dataColumns: Array of columns containing NUMERIC values
   - For PIE: Use exactly ONE numeric column, e.g., ["B"]
   - For LINE/BAR/COLUMN/AREA: Include ALL numeric columns from context!
     * If context shows 3 numeric columns (D, E, F) → use ["D", "E", "F"]
     * Each column becomes a separate series in the chart
   - For SCATTER: 
     * domainColumn = X values (first numeric column)
     * dataColumns = Y values ONLY (remaining numeric columns, NOT the X column!)
     * Example: Columns B=Spend, C=Revenue, D=Profit
       → domainColumn: "B", dataColumns: ["C", "D"]
       → This plots Revenue vs Spend AND Profit vs Spend

3. seriesNames: Extract from column HEADERS shown in the current context
   - If headers show "Store A", "Store B", "Store C" → use those exact names
   - Order must match dataColumns order
   - DO NOT use names from previous requests!

4. annotationColumn (OPTIONAL but IMPORTANT): Column with text labels to display on data points
   - Use this when data has a natural IDENTIFIER column (names, labels, IDs, etc.)
   - ESPECIALLY important for SCATTER charts where each point represents an entity (company, product, person, city)
   - The annotationColumn is SEPARATE from domainColumn — domainColumn is the X-axis (numeric for scatter), annotationColumn provides text labels ON each point
   - For scatter: if context has A=Company, K=YearsSinceFounded, C=Revenue:
     → domainColumn: "K", dataColumns: ["C"], annotationColumn: "A"
     → This labels each point with the company name!
   - Also useful for bar/column/line when you want entity names on data points
   - Do NOT set annotationColumn if domainColumn already contains the labels (e.g., bar chart where domain=Company)

EXAMPLES:

Line chart (3 series):
  Context columns: A=Month, B=Store A, C=Store B, D=Store C
  → domainColumn: "A", dataColumns: ["B", "C", "D"], seriesNames: ["Store A", "Store B", "Store C"]

Bar chart (3 series):
  Context columns: A=Month, B=Store A, C=Store B, D=Store C
  → domainColumn: "A", dataColumns: ["B", "C", "D"], seriesNames: ["Store A", "Store B", "Store C"]
  (Include ALL numeric columns to compare all stores!)

Pie chart (1 series):
  Context columns: A=Category, B=Amount
  → domainColumn: "A", dataColumns: ["B"], seriesNames: ["Amount"]
  (Pie charts use only ONE data column)

Scatter chart (correlation):
  Context columns: B=Marketing Spend, C=Revenue, D=Profit
  → domainColumn: "B", dataColumns: ["C", "D"], seriesNames: ["Revenue", "Profit"]
  (domainColumn is X-axis, dataColumns are Y-axis - do NOT include X column in dataColumns!)

Scatter chart with labels (entities):
  Context columns: A=Company, B=Marketing Spend, C=Revenue
  → domainColumn: "B", dataColumns: ["C"], seriesNames: ["Revenue"], annotationColumn: "A"
  (Each point is labeled with the company name!)

⚠️ DERIVED VALUES FOR CHARTS (CRITICAL):
When the user requests a chart with a COMPUTED metric that doesn't exist as a column
(e.g., "time since founded", "growth rate", "age", "days since last order"),
you MUST use a MULTI-STEP workflow:
  Step 1: formula → compute the derived value in a new column
  Step 2: chart → use the new column as domainColumn or dataColumn

Example: "chart revenue vs years since founded"
  Context: A=Company, C=Revenue_M, E=Founded (years like 2018, 2015)
  Available empty columns: K, L, M
  → Step 1: formula in column K → =YEAR(TODAY())-E{{ROW}} (header: "Years Since Founded")
  → Step 2: scatter chart with domainColumn: "K", dataColumns: ["C"], annotationColumn: "A"
  (annotationColumn: "A" → labels each point with the company name!)

DO NOT label axis as "Years Since Founded" when plotting raw "Founded" year values!
If you use raw columns without a formula step, use accurate axis labels:
  - Column "Founded" (2018, 2015...) → xAxisTitle: "Founded Year" (NOT "Years Since Founded")
  - Column "Revenue_M" → yAxisTitle: "Revenue ($M)"

Multi-step formula+chart JSON example:
{
  "outputMode": "sheet",
  "isMultiStep": true,
  "isCommand": true,
  "steps": [
    {
      "action": "formula",
      "description": "Years Since Founded",
      "prompt": "=YEAR(TODAY())-E{{ROW}}",
      "outputFormat": "formula",
      "outputColumn": "[first empty column]"
    },
    {
      "action": "chart",
      "description": "Create scatter chart"
    }
  ],
  "sheetAction": "chart",
  "sheetConfig": {
    "chartType": "scatter",
    "domainColumn": "[formula output column]",
    "dataColumns": ["C"],
    "annotationColumn": "A",
    "title": "Revenue vs Years Since Founded",
    "xAxisTitle": "Years Since Founded",
    "yAxisTitle": "Revenue ($M)",
    "trendlines": true,
    "seriesNames": ["Revenue"]
  },
  "summary": "Compute years since founded, then create scatter chart",
  "clarification": "I'll first calculate Years Since Founded from the Founded year column, then create a scatter chart showing Revenue vs Years Since Founded."
}

⚠️ REMEMBER: When the data has a clear identifier column (names, labels, categories, IDs) and you're making a SCATTER chart,
ALWAYS include annotationColumn pointing to that identifier column so data points are labeled!

CHART OPTIONS - BE SMART, PROVIDE COMPLETE CONFIG:
The frontend just executes what you specify. You decide ALL visual aspects based on context.

REQUIRED for every chart:
- legendPosition: "bottom" (many series/long names), "right" (pie), "top" (default), "none"
- yAxisFormat: "currency" (money), "percent" (%), "decimal" (numbers), "short" (auto-abbreviate)

OPTIONAL - provide when relevant:
- curveType: "smooth" for trends, "none" for precise data points
- pieHole: 0.4 for donut, 0 for pie
- pieSliceText: "percentage" (default), "value" (small datasets), "label", "none"
- stacked: true for comparing parts of whole
- pointSize: 3-5 (dense data), 7-10 (sparse data)
- barGroupWidth: "50%" (many bars), "75%" (default), "90%" (few bars)
- slantedTextAngle: 45 (short labels), 60-90 (dates/long labels)

TRENDLINES (scatter charts):
⚠️ IMPORTANT: Provide labelInLegend for EVERY trendline - one per series!
Format for 2 series:
[
  {"type":"linear", "series":0, "labelInLegend":"Revenue ROI"},
  {"type":"linear", "series":1, "labelInLegend":"Profit ROI"}
]

labelInLegend rules:
- EVERY trendline MUST have labelInLegend - Google Charts shows equations otherwise!
- Use context-aware labels matching user intent:
  * "ROI trend" → "Revenue ROI", "Profit ROI"
  * "growth trend" → "Revenue growth", "Sales growth"
  * "correlation" → "Revenue correlation", "Profit correlation"
- NEVER use generic "Linear trend" or leave labelInLegend empty!

SMART DEFAULTS - Think about what the user needs:
- Revenue/Sales/Price data → yAxisFormat: "currency"
- Percentage data → yAxisFormat: "percent"  
- Date columns on X-axis → slantedTextAngle: 60
- Many data series (5+) → legendPosition: "bottom"
- Pie with percentages shown → pieSliceText: "percentage"
- Small pie (3-5 slices) → pieSliceText: "value"

For FORMAT sheet action:

⚠️ CRITICAL - Use explicitRowInfo for accurate range targeting!

When user says "format headers":
  → Use the HEADER RANGE from explicitRowInfo (e.g., "B3:H3")
  → Do NOT use the first row of dataRange - that's DATA, not headers!

When user says "format data":
  → Use the DATA-ONLY RANGE from explicitRowInfo (e.g., "B4:H11")

Examples:
{
  "outputMode": "sheet",
  "sheetAction": "format",
  "sheetConfig": {
    "formatType": "text",
    "range": "[USE explicitRowInfo.headerRange for headers, e.g., B3:H3]",
    "options": { "bold": true, "backgroundColor": "#003366", "textColor": "#FFFFFF", "alignment": "center" }
  },
  "summary": "Format headers bold with blue background",
  "clarification": "Applying bold formatting, dark blue background, white text, and center alignment to the header row."
}

For currency formatting:
{
  "outputMode": "sheet",
  "sheetAction": "format",
  "sheetConfig": {
    "formatType": "currency",
    "range": "B4:B11",
    "options": { "decimals": 2 }
  },
  "summary": "Format as currency",
  "clarification": "Applying currency format to the selected range."
}

For STYLING (borders, alignment, bold, etc.) - ALWAYS use "format" action with formatType "text":
{
  "outputMode": "sheet",
  "sheetAction": "format",
  "sheetConfig": {
    "formatType": "text",
    "range": "B3:H11",
    "options": { 
      "borders": true,
      "alignment": "right"
    }
  },
  "summary": "Add borders and right-align",
  "clarification": "Adding borders and right alignment to the data range."
}

For MULTIPLE FORMAT OPERATIONS in one command (e.g., "bold header AND currency AND borders"):
{
  "outputMode": "sheet",
  "sheetAction": "format",
  "sheetConfig": {
    "operations": [
      { 
        "range": "A1:G1", 
        "formatting": { "bold": true, "backgroundColor": "#1a73e8", "textColor": "#FFFFFF", "fontSize": 11 }
      },
      { 
        "range": "C2:E31", 
        "formatting": { "formatType": "currency" }
      },
      { 
        "range": "A1:G31", 
        "formatting": { "borders": true }
      }
    ]
  },
  "summary": "Apply professional formatting",
  "clarification": "Applying bold blue header, currency format to columns C-E, and borders to all cells."
}

⚠️ CRITICAL: Each operation in the array MUST have both "range" AND "formatting" with actual values!
Do NOT return empty formatting objects like { "formatting": {} }

IMPORTANT - Format options you can combine:
- borders: true (adds borders around all cells)
- alignment: "left", "center", "right" (horizontal alignment)
- verticalAlign: "top", "middle", "bottom"
- bold: true
- italic: true
- underline: true
- backgroundColor: "#RRGGBB"
- textColor: "#RRGGBB" 
- fontSize: number (e.g., 12)
- fontFamily: "Arial", "Times New Roman", etc.
- wrap: true (text wrapping)

⚠️ CRITICAL: When user requests MULTIPLE format operations (e.g., "borders AND right-align"):
- Use a SINGLE "format" action with ALL options combined
- Do NOT try to split into multiple steps
- sheetAction MUST be "format" (not undefined!)

⚠️ FOR VAGUE FORMATTING REQUESTS (e.g., "make it look professional", "format nicely"):
If the user's request is too vague to determine specific formatting, use CHAT mode to suggest specific commands:
{
  "outputMode": "chat",
  "chatResponse": "I can help you format your data professionally! Here are some specific commands you can try:\\n\\n1. **Format headers**: 'Make headers bold with dark blue background'\\n2. **Format currency**: 'Format Price, Revenue, Profit columns as currency'\\n3. **Format dates**: 'Format dates as Month Day, Year'\\n4. **Add styling**: 'Add borders and right-align numbers'\\n5. **Highlight values**: 'Make negative values red and bold'\\n\\nOr you can be specific, like: 'Format the entire table with professional styling including bold headers, currency formatting for money columns, and borders'",
  "summary": "Suggesting formatting options"
}

DO NOT return outputMode: "sheet" with an empty sheetConfig - that will fail!

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

For WRITE DATA sheet action (user pastes table data in command):

⚠️ CRITICAL: DETECT PASTED TABLE DATA: If the user's command contains inline table data, use writeData action!
⚠️ DO NOT go to chat mode when user pastes data - they want to WRITE it to the sheet!
⚠️ DO NOT confuse pasted data with existing sheet context - parse what the USER typed/pasted!

Look for these patterns in the command:
- Markdown tables: | Header1 | Header2 | ... | Value1 | Value2 |
- Pipe-separated: Header1|Header2|Header3
- CSV-like: value1, value2, value3  
- Comma-separated after colon: "create table for this data: Name,Age,City"
- Tab or newline separated rows
- Any structured data following words like "data:", "table:", "this data", "for this data"

When detected, PARSE the table into a 2D array:

{
  "outputMode": "sheet",
  "sheetAction": "writeData",
  "sheetConfig": {
    "data": [
      ["Task", "Assignee", "Priority", "Status"],
      ["Design mockups", "Alice", "High", "In Progress"],
      ["Write tests", "Bob", "Medium", "Pending"],
      ["Code review", "Charlie", "Low", "Done"]
    ],
    "startCell": "A1"
  },
  "summary": "Write table data to sheet",
  "clarification": "Parsed your table data and writing 4 columns x 4 rows starting at A1."
}

PARSING RULES:
1. First row of table = headers (first array element)
2. Subsequent rows = data rows
3. Handle empty cells as empty strings ""
4. If user specifies location (e.g., "paste in B5"), use that as startCell
5. If no location specified, use "A1" as default startCell

Example commands that should trigger writeData:
- "Create a table from this: | Name | Age | City |..."
- "Help me paste this data: Task, Assignee, Status..."
- "Write this to the sheet: | Product | Price | Qty |..."

For SHEET OPERATIONS (freeze, sort, hide, insert, delete, resize, etc.):
Use sheetAction: "sheetOps" with an operations array. Each operation has its own type and parameters.
{
  "outputMode": "sheet",
  "sheetAction": "sheetOps",
  "sheetConfig": {
    "operations": [
      { "operation": "[operation-type]", ...relevant-params }
    ]
  }
}

Available operation types: freezeRows, freezeColumns, sort, hideRows, hideColumns, showRows, showColumns,
insertRows, insertColumns, deleteRows, deleteColumns, clear, autoResizeColumns, setColumnWidth, etc.

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
  
  // ⭐ EXPLICIT ROW INFO - Use this for precise range targeting!
  // This is the source of truth for header vs data rows
  if (ctx.explicitRowInfo) {
    const rowInfo = ctx.explicitRowInfo;
    parts.push('⭐ EXPLICIT ROW INFORMATION (USE FOR FORMAT ACTIONS):');
    if (rowInfo.headerRowNumber) {
      parts.push(`   📍 HEADER ROW: Row ${rowInfo.headerRowNumber}`);
      parts.push(`   📍 HEADER RANGE: ${rowInfo.headerRange} ← Use this for "format headers" commands!`);
    }
    parts.push(`   📍 DATA START ROW: Row ${rowInfo.dataStartRow}`);
    parts.push(`   📍 DATA END ROW: Row ${rowInfo.dataEndRow}`);
    parts.push(`   📍 DATA-ONLY RANGE: ${rowInfo.dataRange} ← Use this for "format data" commands`);
    if (rowInfo.fullRangeIncludingHeader) {
      parts.push(`   📍 FULL RANGE (with header): ${rowInfo.fullRangeIncludingHeader}`);
    }
    parts.push('');
  }
  
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

// ============================================
// ADAPTIVE PROMPT BUILDER (v2.0)
// ============================================

/**
 * Build an adaptive prompt using the skill system
 * 
 * This is the NEW approach that:
 * - Detects user intent first
 * - Loads ONLY relevant skill instructions (no mixed signals)
 * - For vague/composite requests, ONLY loads chat skill
 * - Reduces token usage by 50-70%
 * 
 * @param command User's original command
 * @param dataContext Information about the user's data
 * @returns Built prompt with metadata
 */
export interface AdaptivePromptOptions {
  /** Force specific skill from intent classification */
  forceSkillId?: string;
  /** Confidence of the classification (used to decide whether to force) */
  confidence?: number;
}

export async function buildAdaptivePrompt(
  command: string,
  dataContext: DataContext,
  options: AdaptivePromptOptions = {}
): Promise<BuiltPrompt> {
  const startTime = Date.now();
  
  // 1. Select skills (includes request analysis internally)
  // If we have a high-confidence skill from intent classification, use it
  const selectionStartTime = Date.now();
  const forceSkills = (options.forceSkillId && (options.confidence || 0) >= 0.8) 
    ? [options.forceSkillId] 
    : [];
  
  if (forceSkills.length > 0) {
    console.log(`[PromptBuilder:Adaptive] 🎯 Forcing skill from intent classification: ${forceSkills[0]}`);
  }
  
  const selection = await selectSkills(command, dataContext as SkillDataContext, { forceSkills });
  const skillSelectionTime = Date.now() - selectionStartTime;
  
  // Log selection result with request analysis
  console.log('[PromptBuilder:Adaptive] Selected skills:', 
    selection.selectedSkills.map(s => s.id).join(', '));
  console.log('[PromptBuilder:Adaptive] Estimated tokens:', selection.estimatedTokens);
  if (selection.requestAnalysis) {
    console.log('[PromptBuilder:Adaptive] Request analysis:', {
      type: selection.requestAnalysis.type,
      specificity: selection.requestAnalysis.specificity.toFixed(2),
      forcedChatMode: selection.requestAnalysis.forcedChatMode
    });
  }
  
  // 2. Load skill instructions (ONLY for selected skills)
  // If chat skill was forced, this will ONLY include chat instructions
  const skillInstructions = loadSkillInstructions(selection.selectedSkills);
  
  // 3. Load skill-specific examples (async - tries DB first, falls back to hardcoded)
  const skillExamples = await loadSkillExamples(selection.selectedSkills, command, 2);
  const formattedExamples = formatExamplesForPrompt(skillExamples);
  
  // 4. Format data context
  const contextStr = formatDataContext(dataContext);
  
  // 5. Compose the adaptive prompt
  // Note: No redundant request guidance - skill selection already handles routing
  // The selected skill's instructions contain everything the AI needs
  const prompt = `${CORE_INSTRUCTIONS}
${skillInstructions}

${formattedExamples}

---

NOW GENERATE A RESPONSE FOR THIS REQUEST:

User Request: "${command}"

=== DATA CONTEXT (STUDY THIS CAREFULLY) ===
${contextStr}
===========================================

Available Output Columns: ${dataContext.emptyColumns.slice(0, 4).join(', ')}

Return ONLY valid JSON matching the schema above. No markdown, no explanation.`;

  const promptBuildTime = Date.now() - startTime;
  
  return {
    prompt,
    includedSkills: selection.selectedSkills.map(s => s.id),
    estimatedTokens: selection.estimatedTokens,
    metadata: {
      skillSelectionTime,
      promptBuildTime,
      usedFallback: selection.usedFallback,
    },
  };
}

/**
 * Analyze a command to see which skills would be selected
 * Useful for debugging and understanding the skill system
 */
export function analyzeCommand(command: string, dataContext?: DataContext) {
  return analyzeIntent(command, dataContext as SkillDataContext | undefined);
}

/**
 * Check if adaptive prompts should be used
 * Defaults to true (adaptive prompts enabled)
 * Set ADAPTIVE_PROMPTS=false to disable
 */
export function shouldUseAdaptivePrompts(): boolean {
  // Adaptive prompts enabled by default
  // Set ADAPTIVE_PROMPTS=false to fall back to legacy
  return process.env.ADAPTIVE_PROMPTS !== 'false';
}

/**
 * Smart prompt builder that chooses between adaptive and legacy
 * 
 * @param command User's command
 * @param dataContext Data context
 * @param similarWorkflows Similar workflows from semantic search
 * @param baseExamples Fallback examples
 * @param options Options including skill hints from intent classification
 */
export async function buildSmartPrompt(
  command: string,
  dataContext: DataContext,
  similarWorkflows: StoredWorkflow[],
  baseExamples: StoredWorkflow[] = [],
  options: AdaptivePromptOptions = {}
): Promise<string> {
  // Check if adaptive prompts are enabled
  if (shouldUseAdaptivePrompts()) {
    const result = await buildAdaptivePrompt(command, dataContext, options);
    return result.prompt;
  }
  
  // Fall back to legacy prompt builder
  return buildFewShotPrompt(command, dataContext, similarWorkflows, baseExamples);
}

export default buildFewShotPrompt;
