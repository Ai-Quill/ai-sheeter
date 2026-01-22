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

TASK: Generate a workflow to accomplish the user's request.
IMPORTANT: Study the SAMPLE DATA carefully to understand what type of content you're processing.

${formatExamples(examples)}

---

NOW GENERATE A WORKFLOW FOR THIS NEW REQUEST:

User Request: "${command}"

=== DATA CONTEXT (STUDY THIS CAREFULLY) ===
${contextStr}
===========================================

Available Output Columns: ${dataContext.emptyColumns.slice(0, 4).join(', ') || 'G, H, I, J'}

CRITICAL REQUIREMENTS:
1. ANALYZE THE SAMPLE DATA to understand what type of content is in each column and what can be extracted or analyzed

2. Design the workflow to match the user's request as closely as possible:
   - Each step should process the data logically
   - Steps should flow naturally from one to the next if they depend on each other's output
   - Use the SOURCE data columns in earlier steps

3. Use ONLY these actions: extract, analyze, classify, generate, summarize, score, clean, validate, translate, rewrite

4. Each step must have: action, description (5-15 words), prompt (detailed instructions), outputFormat

5. Reference ACTUAL COLUMN NAMES in your prompts (e.g., "Based on the Sales Notes in column F...")

6. For outputFormat with multiple aspects separated by "|" (e.g., "Performance | UX | Pricing"), each aspect gets its own output column

Return ONLY valid JSON matching the example format above. No markdown, no explanation.`;
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
    
    // Log which examples were selected
    console.log('[PromptBuilder] Selected examples:', baseExamples.slice(0, 3).map(ex => ({
      command: ex.command.substring(0, 50) + '...',
      stepCount: ex.workflow?.steps?.length,
      actions: ex.workflow?.steps?.map(s => s.action)
    })));
    
    return baseExamples.slice(0, 3).map(ex => ({
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
  
  // Columns with headers
  parts.push(`Columns with data: ${ctx.dataColumns.join(', ')}`);
  
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
