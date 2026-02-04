/**
 * Dynamic Skill Examples
 * 
 * Loads skill examples dynamically from the database using vector similarity.
 * This enables continuous learning - successful executions become examples.
 * 
 * @version 1.0.0
 * @created 2026-02-01
 */

import { supabaseAdmin } from '@/lib/supabase';
import { generateEmbedding } from '@/lib/ai/embeddings';
import { SkillExample } from './types';

/**
 * Database row structure from find_skill_examples RPC
 */
interface DBSkillExample {
  id: string;
  command: string;
  ai_response: Record<string, unknown>;
  data_context: Record<string, unknown> | null;
  similarity: number;
  quality_score: number;
  created_at: string;
}

/**
 * Extended skill example with similarity metadata
 */
export interface DynamicSkillExample extends SkillExample {
  similarity: number;
  qualityScore: number;
  source: 'database' | 'hardcoded';
}

/**
 * Load dynamic examples for a skill from the database
 * 
 * DISABLED: We trust the AI to understand from skill instructions alone.
 * Modern LLMs (GPT-4, Claude, Gemini) handle schemas well without examples.
 * 
 * This removes:
 * - Embedding generation overhead
 * - Database vector similarity queries
 * - Seed maintenance burden
 * 
 * @param skillId - The skill identifier (e.g., 'format', 'dataValidation')
 * @param command - The user's command to find similar examples for
 * @param maxExamples - Maximum number of examples to return
 * @param similarityThreshold - Minimum similarity score (0-1)
 * @returns Empty array - AI uses skill instructions instead
 */
export async function loadDynamicExamples(
  skillId: string,
  command: string,
  maxExamples: number = 2,
  similarityThreshold: number = 0.5
): Promise<DynamicSkillExample[]> {
  // SIMPLIFIED: Return empty array - AI handles it from instructions
  console.log(`[DynamicExamples] DISABLED - trusting AI for ${skillId}`);
  return [];
  
  /* ORIGINAL CODE - kept for reference
  try {
    // Generate embedding for the command
    const embedding = await generateEmbedding(command);
    
    // Format embedding as Postgres array string for pgvector
    const embeddingStr = `[${embedding.join(',')}]`;
    
    // Query the database for similar examples
    const { data, error } = await supabaseAdmin.rpc('find_skill_examples', {
      p_skill_id: skillId,
      p_command_embedding: embeddingStr,
      p_limit: maxExamples,
      p_threshold: similarityThreshold
    });
    
    if (error) {
      console.error(`[DynamicExamples] Error fetching examples for ${skillId}:`, error);
      return [];
    }
    
    if (!data || data.length === 0) {
      console.log(`[DynamicExamples] No examples found for ${skillId}`);
      return [];
    }
    
    // Convert database rows to SkillExample format
    const examples: DynamicSkillExample[] = (data as DBSkillExample[]).map(row => ({
      command: row.command,
      response: row.ai_response,
      context: row.data_context ? summarizeContext(row.data_context) : undefined,
      similarity: row.similarity,
      qualityScore: row.quality_score,
      source: 'database' as const
    }));
    
    console.log(`[DynamicExamples] Found ${examples.length} examples for ${skillId}:`, 
      examples.map(e => ({ command: e.command.slice(0, 50), similarity: e.similarity.toFixed(2) }))
    );
    
    return examples;
  } catch (error) {
    console.error(`[DynamicExamples] Error loading examples for ${skillId}:`, error);
    return [];
  }
  END OF ORIGINAL CODE */
}

/**
 * Mark a successful execution as a good example
 * 
 * @param usageId - The skill_usage record ID
 * @param qualityScore - Quality score (0-1, default 0.8)
 */
export async function markAsGoodExample(
  usageId: string,
  qualityScore: number = 0.8
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.rpc('mark_as_good_example', {
      p_usage_id: usageId,
      p_quality_score: qualityScore
    });
    
    if (error) {
      console.error('[DynamicExamples] Error marking as good example:', error);
      return false;
    }
    
    console.log(`[DynamicExamples] Marked ${usageId} as good example with quality ${qualityScore}`);
    return true;
  } catch (error) {
    console.error('[DynamicExamples] Error marking as good example:', error);
    return false;
  }
}

/**
 * Get count of dynamic examples per skill
 */
export async function getExampleCounts(): Promise<Record<string, number>> {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_skill_example_count');
    
    if (error) {
      console.error('[DynamicExamples] Error getting example counts:', error);
      return {};
    }
    
    const counts: Record<string, number> = {};
    for (const row of (data || [])) {
      counts[row.skill_id] = Number(row.example_count);
    }
    
    return counts;
  } catch (error) {
    console.error('[DynamicExamples] Error getting example counts:', error);
    return {};
  }
}

/**
 * Summarize data context for example display
 * Creates a brief description of the context
 */
function summarizeContext(context: Record<string, unknown>): string {
  const parts: string[] = [];
  
  if (context.headers && Array.isArray(context.headers)) {
    parts.push(`Headers: ${(context.headers as string[]).slice(0, 5).join(', ')}`);
  }
  
  if (context.dataRange) {
    parts.push(`Range: ${context.dataRange}`);
  }
  
  if (context.explicitRowInfo) {
    const rowInfo = context.explicitRowInfo as Record<string, unknown>;
    if (rowInfo.dataStartRow && rowInfo.dataEndRow) {
      parts.push(`Data rows: ${rowInfo.dataStartRow}-${rowInfo.dataEndRow}`);
    }
  }
  
  return parts.length > 0 ? parts.join(', ') : 'Sheet context';
}

/**
 * Convert hardcoded examples to dynamic format for consistency
 */
export function convertHardcodedExamples(
  examples: SkillExample[]
): DynamicSkillExample[] {
  return examples.map(ex => ({
    ...ex,
    similarity: 1.0, // Hardcoded examples have perfect "similarity" by definition
    qualityScore: 0.9, // Default high quality for curated examples
    source: 'hardcoded' as const
  }));
}

/**
 * Score hardcoded examples based on relevance to command
 * Simple keyword matching for fallback ranking
 */
export function scoreHardcodedExample(
  example: SkillExample,
  command: string
): number {
  const commandLower = command.toLowerCase();
  const exampleLower = example.command.toLowerCase();
  
  // Check for exact match
  if (commandLower === exampleLower) return 1.0;
  
  // Count matching words
  const commandWords = new Set(commandLower.split(/\s+/));
  const exampleWords = exampleLower.split(/\s+/);
  
  let matchCount = 0;
  for (const word of exampleWords) {
    if (commandWords.has(word)) matchCount++;
  }
  
  // Calculate overlap ratio
  const overlapScore = exampleWords.length > 0 
    ? matchCount / exampleWords.length 
    : 0;
  
  // Check relevance hints if available
  let hintBonus = 0;
  if (example.relevanceHints) {
    for (const hint of example.relevanceHints) {
      if (commandLower.includes(hint.toLowerCase())) {
        hintBonus += 0.1;
      }
    }
  }
  
  return Math.min(1.0, overlapScore * 0.8 + hintBonus);
}
