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

import { BaseExample, getRelevantBaseExamples } from './base-examples';
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
 * @returns The complete prompt string
 */
export function buildFewShotPrompt(
  command: string,
  dataContext: DataContext,
  similarWorkflows: StoredWorkflow[]
): string {
  // Get examples: prefer similar workflows, fall back to base examples
  const examples = getExamples(command, similarWorkflows);
  
  // Format the data context
  const contextStr = formatDataContext(dataContext);
  
  // Build the prompt with clear examples
  return `You are an expert workflow designer for spreadsheet data processing.

TASK: Generate a multi-step workflow (2-4 steps) to accomplish the user's request.

${formatExamples(examples)}

---

NOW GENERATE A WORKFLOW FOR THIS NEW REQUEST:

User Request: "${command}"

Data Context:
${contextStr}

Available Output Columns: ${dataContext.emptyColumns.slice(0, 4).join(', ') || 'G, H, I, J'}

IMPORTANT REQUIREMENTS:
- Generate 2-4 steps that flow logically (each step's output feeds the next)
- Use ONLY these actions: extract, analyze, classify, generate, summarize, score, clean, validate, translate, rewrite
- Each step must have: action, description (5-15 words), prompt (detailed instructions 30+ chars), outputFormat
- Follow the SAME STRUCTURE as the examples above

Return ONLY valid JSON matching the example format above. No markdown, no explanation.`;
}

// ============================================
// HELPERS
// ============================================

/**
 * Get the best examples to include in the prompt
 */
function getExamples(command: string, similarWorkflows: StoredWorkflow[]): WorkflowExample[] {
  // If we have similar workflows from memory, use those (they're proven to work)
  if (similarWorkflows.length >= 2) {
    console.log(`[PromptBuilder] Using ${similarWorkflows.length} similar workflows from memory`);
    return similarWorkflows.map(sw => ({
      command: sw.command,
      workflow: sw.workflow as WorkflowExample['workflow'],
    }));
  }
  
  // Otherwise, use base examples (with keyword relevance)
  console.log('[PromptBuilder] Using base examples (no similar workflows in memory)');
  const relevantExamples = getRelevantBaseExamples(command, 2); // Use top 2 most relevant
  
  // Log which examples were selected
  console.log('[PromptBuilder] Selected examples:', relevantExamples.map(ex => ({
    command: ex.command.substring(0, 50) + '...',
    stepCount: ex.workflow.steps.length,
    actions: ex.workflow.steps.map(s => s.action)
  })));
  
  return relevantExamples.map(ex => ({
    command: ex.command,
    context: ex.context,
    workflow: ex.workflow,
  }));
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
 */
function formatDataContext(ctx: DataContext): string {
  const parts: string[] = [];
  
  // Columns
  parts.push(`- Columns with data: ${ctx.dataColumns.join(', ')}`);
  
  // Headers if available
  if (Object.keys(ctx.headers).length > 0) {
    const headerList = Object.entries(ctx.headers)
      .map(([col, name]) => `${col}: "${name}"`)
      .join(', ');
    parts.push(`- Column headers: ${headerList}`);
  }
  
  // Sample data
  if (Object.keys(ctx.sampleData).length > 0) {
    parts.push('- Sample data:');
    Object.entries(ctx.sampleData).forEach(([col, samples]) => {
      if (samples.length > 0) {
        const truncated = samples.slice(0, 2).map(s => 
          s.length > 60 ? s.substring(0, 60) + '...' : s
        );
        parts.push(`  ${col}: ${JSON.stringify(truncated)}`);
      }
    });
  }
  
  // Row count
  parts.push(`- Total rows: ${ctx.rowCount}`);
  
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

export default buildFewShotPrompt;
