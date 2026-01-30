/**
 * Skill Learner
 * 
 * Tracks skill usage and learns from success/failure patterns.
 * Integrates with the database to:
 * - Record skill usage outcomes
 * - Analyze failure patterns
 * - Flag skills that need review
 * - Update skill success rates
 * 
 * @version 1.0.0
 */

import { createClient } from '@supabase/supabase-js';
import { 
  SkillOutcome, 
  SkillPerformance, 
  SkillReviewFlag,
  DataContext,
} from './types';
import { getSkillById, ALL_SKILLS } from './intent-detector';

// ============================================
// DATABASE CLIENT
// ============================================

// Use existing Supabase client from the app
const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.warn('[SkillLearner] Supabase not configured - learning disabled');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
};

// ============================================
// RECORD SKILL USAGE
// ============================================

/**
 * Record the outcome of using a skill
 * This is called after every skill execution
 */
export async function recordSkillOutcome(outcome: SkillOutcome): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) {
    console.log('[SkillLearner] Skipping recording - no database connection');
    return null;
  }
  
  try {
    // Call the database function to record and check health
    const { data, error } = await supabase.rpc('record_skill_usage', {
      p_skill_id: outcome.skillId,
      p_skill_version: outcome.skillVersion,
      p_command: outcome.command,
      p_command_embedding: outcome.commandEmbedding || null,
      p_success: outcome.success,
      p_error_message: outcome.errorMessage || null,
      p_user_edited: outcome.userEdited || false,
      p_execution_time_ms: outcome.executionTimeMs || null,
      p_data_context: outcome.dataContext || null,
      p_ai_response: outcome.aiResponse || null,
    });
    
    if (error) {
      console.error('[SkillLearner] Error recording usage:', error.message);
      return null;
    }
    
    console.log(`[SkillLearner] Recorded ${outcome.success ? 'success' : 'failure'} for ${outcome.skillId}`);
    return data;
  } catch (err) {
    console.error('[SkillLearner] Exception recording usage:', err);
    return null;
  }
}

/**
 * Record that a user edited the AI's output
 * This indicates the AI result was suboptimal
 */
export async function recordUserEdit(usageId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  
  try {
    const { error } = await supabase
      .from('skill_usage')
      .update({ user_edited: true })
      .eq('id', usageId);
    
    if (error) {
      console.error('[SkillLearner] Error recording user edit:', error.message);
    }
  } catch (err) {
    console.error('[SkillLearner] Exception recording user edit:', err);
  }
}

// ============================================
// GET SKILL STATS
// ============================================

/**
 * Get performance stats for a specific skill
 */
export async function getSkillPerformance(skillId?: string): Promise<SkillPerformance[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  
  try {
    const { data, error } = await supabase.rpc('get_skill_stats', {
      p_skill_id: skillId || null,
    });
    
    if (error) {
      console.error('[SkillLearner] Error getting skill stats:', error.message);
      return [];
    }
    
    return (data || []).map((row: Record<string, unknown>) => ({
      skillId: row.skill_id as string,
      skillVersion: row.skill_version as string,
      totalUses: Number(row.total_uses),
      successes: 0, // Not returned by function, computed from rate
      failures: 0,
      avgExecutionTimeMs: Number(row.avg_execution_time_ms) || 0,
      successRate: Number(row.success_rate) || 0,
      lastUsed: row.last_used_at ? new Date(row.last_used_at as string) : undefined,
    }));
  } catch (err) {
    console.error('[SkillLearner] Exception getting skill stats:', err);
    return [];
  }
}

/**
 * Update in-memory skill success rates from database
 * Call this periodically to keep skills up to date
 */
export async function refreshSkillStats(): Promise<void> {
  const stats = await getSkillPerformance();
  
  for (const stat of stats) {
    const skill = getSkillById(stat.skillId);
    if (skill) {
      skill.successRate = stat.successRate;
      skill.usageCount = stat.totalUses;
      skill.lastUpdated = stat.lastUsed;
    }
  }
  
  console.log(`[SkillLearner] Refreshed stats for ${stats.length} skills`);
}

// ============================================
// FAILURE ANALYSIS
// ============================================

/**
 * Find similar failed commands using vector similarity
 * Useful for detecting patterns of failure
 */
export async function findSimilarFailures(
  embedding: number[],
  skillId?: string,
  limit: number = 10,
  threshold: number = 0.8
): Promise<Array<{
  id: string;
  skillId: string;
  command: string;
  errorMessage?: string;
  similarity: number;
  createdAt: Date;
}>> {
  const supabase = getSupabase();
  if (!supabase) return [];
  
  try {
    const { data, error } = await supabase.rpc('find_similar_failures', {
      p_embedding: embedding,
      p_skill_id: skillId || null,
      p_limit: limit,
      p_threshold: threshold,
    });
    
    if (error) {
      console.error('[SkillLearner] Error finding similar failures:', error.message);
      return [];
    }
    
    return (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      skillId: row.skill_id as string,
      command: row.command as string,
      errorMessage: row.error_message as string | undefined,
      similarity: Number(row.similarity),
      createdAt: new Date(row.created_at as string),
    }));
  } catch (err) {
    console.error('[SkillLearner] Exception finding similar failures:', err);
    return [];
  }
}

// ============================================
// REVIEW FLAGS
// ============================================

/**
 * Get skills that need review
 */
export async function getSkillsNeedingReview(): Promise<SkillReviewFlag[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  
  try {
    const { data, error } = await supabase
      .from('skill_review_flags')
      .select('*')
      .eq('reviewed', false)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[SkillLearner] Error getting review flags:', error.message);
      return [];
    }
    
    return (data || []).map((row: Record<string, unknown>) => ({
      skillId: row.skill_id as string,
      skillVersion: row.skill_version as string,
      pattern: row.flag_type as 'repeated_failure' | 'low_success_rate' | 'high_edit_rate',
      examples: [], // Would need to fetch usage records
      suggestedFix: row.suggested_fix as string | undefined,
      createdAt: new Date(row.created_at as string),
      reviewed: row.reviewed as boolean,
    }));
  } catch (err) {
    console.error('[SkillLearner] Exception getting review flags:', err);
    return [];
  }
}

/**
 * Mark a review flag as reviewed
 */
export async function markReviewed(
  flagId: string, 
  resolution: string,
  reviewedBy?: string
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  
  try {
    const { error } = await supabase
      .from('skill_review_flags')
      .update({
        reviewed: true,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy || 'system',
        resolution,
      })
      .eq('id', flagId);
    
    if (error) {
      console.error('[SkillLearner] Error marking reviewed:', error.message);
    }
  } catch (err) {
    console.error('[SkillLearner] Exception marking reviewed:', err);
  }
}

// ============================================
// HELPER: CREATE OUTCOME FROM EXECUTION
// ============================================

/**
 * Helper to create a SkillOutcome from execution results
 */
export function createOutcome(params: {
  skillId: string;
  skillVersion: string;
  command: string;
  success: boolean;
  errorMessage?: string;
  executionTimeMs?: number;
  dataContext?: DataContext;
  aiResponse?: Record<string, unknown>;
  commandEmbedding?: number[];
}): SkillOutcome {
  return {
    skillId: params.skillId,
    skillVersion: params.skillVersion,
    command: params.command,
    success: params.success,
    errorMessage: params.errorMessage,
    executionTimeMs: params.executionTimeMs,
    dataContext: params.dataContext,
    aiResponse: params.aiResponse,
    commandEmbedding: params.commandEmbedding,
    createdAt: new Date(),
  };
}

// ============================================
// EXPORTS
// ============================================

export default {
  recordSkillOutcome,
  recordUserEdit,
  getSkillPerformance,
  refreshSkillStats,
  findSimilarFailures,
  getSkillsNeedingReview,
  markReviewed,
  createOutcome,
};
