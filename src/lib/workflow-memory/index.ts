/**
 * Workflow Memory Service
 * 
 * Provides semantic search and storage for successful workflows.
 * Uses embeddings to find similar past workflows regardless of phrasing.
 * 
 * @version 1.0.0
 * @updated 2026-01-20
 */

import { supabaseAdmin } from '@/lib/supabase';
import { generateEmbedding } from '@/lib/ai/embeddings';

// ============================================
// TYPES
// ============================================

export interface StoredWorkflow {
  id: string;
  command: string;
  workflow: WorkflowData;
  domain: string | null;
  similarity?: number;
}

export interface WorkflowData {
  steps: WorkflowStep[];
  summary?: string;
  clarification?: string;
}

export interface WorkflowStep {
  action: string;
  description: string;
  prompt: string;
  outputFormat?: string;
}

// DataContext type is imported here and re-exported at the bottom for convenience
import { type DataContext } from './prompt-builder';

// ============================================
// FIND SIMILAR WORKFLOWS
// ============================================

/**
 * Find workflows similar to the given command using semantic search
 * 
 * @param command - User's command to match
 * @param limit - Maximum number of results (default 3)
 * @param threshold - Minimum similarity threshold (default 0.7)
 * @param domain - Optional domain to filter by
 * @returns Array of similar workflows with similarity scores
 */
export async function findSimilarWorkflows(
  command: string,
  limit: number = 3,
  threshold: number = 0.7,
  domain?: string
): Promise<StoredWorkflow[]> {
  try {
    // Generate embedding for the command
    const embedding = await generateEmbedding(command);
    
    // Search using the database function
    const { data, error } = await supabaseAdmin.rpc('find_similar_workflows', {
      query_embedding: embedding,
      match_count: limit,
      match_threshold: threshold,
      filter_domain: domain || null,
    });
    
    if (error) {
      console.error('[WorkflowMemory] Search error:', error);
      return [];
    }
    
    return (data || []).map((row: any) => ({
      id: row.id,
      command: row.command,
      workflow: row.workflow,
      domain: row.domain,
      similarity: row.similarity,
    }));
  } catch (error) {
    console.error('[WorkflowMemory] Error finding similar workflows:', error);
    return [];
  }
}

/**
 * Find similar workflows using a pre-computed embedding
 * (Avoids duplicate embedding generation when we already have it)
 */
export async function findSimilarWorkflowsByEmbedding(
  embedding: number[],
  limit: number = 3,
  threshold: number = 0.7,
  domain?: string
): Promise<StoredWorkflow[]> {
  try {
    const { data, error } = await supabaseAdmin.rpc('find_similar_workflows', {
      query_embedding: embedding,
      match_count: limit,
      match_threshold: threshold,
      filter_domain: domain || null,
    });
    
    if (error) {
      console.error('[WorkflowMemory] Search error:', error);
      return [];
    }
    
    return (data || []).map((row: any) => ({
      id: row.id,
      command: row.command,
      workflow: row.workflow,
      domain: row.domain,
      similarity: row.similarity,
    }));
  } catch (error) {
    console.error('[WorkflowMemory] Error finding similar workflows:', error);
    return [];
  }
}

// ============================================
// STORE WORKFLOW
// ============================================

/**
 * Store a successful workflow for future matching
 * 
 * @param command - Original user command
 * @param workflow - The workflow that was successful
 * @param domain - Optional domain classification
 * @param dataContext - Optional data context
 * @returns The ID of the stored (or updated) workflow
 */
export async function storeWorkflow(
  command: string,
  workflow: WorkflowData,
  domain?: string,
  dataContext?: DataContext
): Promise<string | null> {
  try {
    // Generate embedding for the command
    const embedding = await generateEmbedding(command);
    
    // Use upsert function to avoid duplicates
    const { data, error } = await supabaseAdmin.rpc('upsert_workflow_memory', {
      p_command: command,
      p_embedding: embedding,
      p_workflow: workflow,
      p_domain: domain || null,
      p_data_context: dataContext || null,
      similarity_threshold: 0.95, // Very similar = same workflow
    });
    
    if (error) {
      console.error('[WorkflowMemory] Store error:', error);
      return null;
    }
    
    console.log('[WorkflowMemory] Stored workflow:', data);
    return data;
  } catch (error) {
    console.error('[WorkflowMemory] Error storing workflow:', error);
    return null;
  }
}

/**
 * Store a workflow with a pre-computed embedding
 */
export async function storeWorkflowWithEmbedding(
  command: string,
  embedding: number[],
  workflow: WorkflowData,
  domain?: string,
  dataContext?: DataContext
): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.rpc('upsert_workflow_memory', {
      p_command: command,
      p_embedding: embedding,
      p_workflow: workflow,
      p_domain: domain || null,
      p_data_context: dataContext || null,
      similarity_threshold: 0.95,
    });
    
    if (error) {
      console.error('[WorkflowMemory] Store error:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('[WorkflowMemory] Error storing workflow:', error);
    return null;
  }
}

// ============================================
// RECORD USAGE
// ============================================

/**
 * Record that a workflow was used successfully
 * (Increments success count, updates last_used_at)
 */
export async function recordWorkflowUsage(workflowId: string): Promise<void> {
  try {
    await supabaseAdmin.rpc('record_workflow_memory_usage', {
      p_workflow_id: workflowId,
    });
  } catch (error) {
    // Non-critical, just log
    console.error('[WorkflowMemory] Usage recording error:', error);
  }
}

// ============================================
// RE-EXPORTS
// ============================================

// Re-export from prompt builder for convenience
export { buildFewShotPrompt } from './prompt-builder';
export type { DataContext };  // Re-export the imported type
export { BASE_EXAMPLES, getRelevantBaseExamples } from './base-examples';

// ============================================
// EXPORTS
// ============================================

export const workflowMemory = {
  findSimilar: findSimilarWorkflows,
  findSimilarByEmbedding: findSimilarWorkflowsByEmbedding,
  store: storeWorkflow,
  storeWithEmbedding: storeWorkflowWithEmbedding,
  recordUsage: recordWorkflowUsage,
};

export default workflowMemory;
