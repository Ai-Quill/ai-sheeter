/**
 * System Prompts Service - Context Engineering for AISheeter
 * 
 * Implements Anthropic's context engineering principles:
 * - System prompts at "right altitude" (not too rigid, not too vague)
 * - Task-specific guidance for better outputs
 * - Spreadsheet-optimized formatting
 * 
 * @see https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
 * @see docs/architecture/context-engineering.md
 */

/**
 * Base system prompt for all spreadsheet operations
 * This is included in all requests to ensure consistent, cell-friendly outputs
 */
const SPREADSHEET_BASE = `You are an AI assistant integrated into Google Sheets.
Your responses will be placed directly into spreadsheet cells.

Core behaviors:
- Be concise and cell-friendly (cells have limited display width)
- Use semicolons (;) as list separators for Excel/Sheets compatibility
- Return clean, parseable text without markdown formatting
- No asterisks (**), hashtags (#), or other markdown syntax
- If you cannot complete a request, explain briefly why`;

/**
 * Task-specific system prompts
 * Each builds on SPREADSHEET_BASE with specialized instructions
 */
export const SystemPrompts = {
  /**
   * General purpose - used when no specific task is detected
   */
  GENERAL: SPREADSHEET_BASE,

  /**
   * Data extraction from unstructured text
   * @example "Extract name and email from: John Smith, john@example.com"
   */
  EXTRACT: `${SPREADSHEET_BASE}

Task: Extract structured data from unstructured text.
Output format: field1: value1 | field2: value2
If a field cannot be found, use "N/A"
Be precise - extract exactly what is requested, nothing more.`,

  /**
   * Text summarization
   * @example "Summarize this article in one sentence"
   */
  SUMMARIZE: `${SPREADSHEET_BASE}

Task: Summarize content concisely.
Guidelines:
- Keep summaries to 1-2 sentences unless more detail is requested
- Focus on key facts, figures, and main points
- Omit filler words and unnecessary context`,

  /**
   * Classification/Categorization
   * @example "Classify this support ticket as: Bug, Feature Request, or Question"
   */
  CLASSIFY: `${SPREADSHEET_BASE}

Task: Classify input into categories.
Guidelines:
- Return ONLY the category name, nothing else
- If unsure, pick the most likely category
- For multi-label classification, separate with semicolons`,

  /**
   * Translation
   * @example "Translate to Spanish: Hello, how are you?"
   */
  TRANSLATE: `${SPREADSHEET_BASE}

Task: Translate text accurately.
Guidelines:
- Preserve the original meaning and tone
- Keep formatting and structure intact
- For proper nouns, keep them in original form unless commonly translated`,

  /**
   * Code/Formula generation
   * @example "Write a formula to sum column A if column B > 100"
   */
  CODE: `${SPREADSHEET_BASE}

Task: Generate code or formulas.
Guidelines:
- For Sheets formulas, use standard Google Sheets syntax
- Return only the formula/code, no explanations unless asked
- Test edge cases mentally before responding`,

  /**
   * Data analysis/insights
   * @example "What trends do you see in this sales data?"
   */
  ANALYZE: `${SPREADSHEET_BASE}

Task: Analyze data and provide insights.
Guidelines:
- Lead with the most important finding
- Use numbers and percentages when available
- Be specific and actionable`,

  /**
   * Formatting/Cleaning data
   * @example "Clean this phone number: (555) 123-4567"
   */
  FORMAT: `${SPREADSHEET_BASE}

Task: Format or clean data.
Guidelines:
- Follow any specified format exactly
- If no format specified, use standard conventions
- Return only the formatted result`,
} as const;

/**
 * Task type for prompt selection
 */
export type TaskType = keyof typeof SystemPrompts;

/**
 * Get the appropriate system prompt for a task type
 */
export function getSystemPrompt(taskType?: string): string {
  if (!taskType) return SystemPrompts.GENERAL;
  
  const key = taskType.toUpperCase() as TaskType;
  return SystemPrompts[key] || SystemPrompts.GENERAL;
}

/**
 * Infer task type from user input
 * Used when taskType is not explicitly provided
 */
export function inferTaskType(input: string): TaskType {
  const lower = input.toLowerCase();
  
  // Check for task indicators in order of specificity
  if (lower.includes('extract') || lower.includes('parse') || lower.includes('get the')) {
    return 'EXTRACT';
  }
  if (lower.includes('summarize') || lower.includes('summary') || lower.includes('tldr')) {
    return 'SUMMARIZE';
  }
  if (lower.includes('classify') || lower.includes('categorize') || lower.includes('is this a')) {
    return 'CLASSIFY';
  }
  if (lower.includes('translate') || lower.includes('in spanish') || lower.includes('in french') || lower.includes('in german')) {
    return 'TRANSLATE';
  }
  if (lower.includes('formula') || lower.includes('code') || lower.includes('function') || lower.includes('script')) {
    return 'CODE';
  }
  if (lower.includes('analyze') || lower.includes('analysis') || lower.includes('trend') || lower.includes('insight')) {
    return 'ANALYZE';
  }
  if (lower.includes('format') || lower.includes('clean') || lower.includes('fix') || lower.includes('convert')) {
    return 'FORMAT';
  }
  
  return 'GENERAL';
}
