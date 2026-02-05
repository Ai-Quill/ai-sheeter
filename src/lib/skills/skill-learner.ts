/**
 * Skill Learner
 * 
 * DEPRECATED: This module is disabled.
 * Modern LLMs handle intent from skill instructions alone.
 * 
 * Kept for potential future use if skill learning is needed.
 * 
 * @version 2.0.0 - Disabled
 * @deprecated 2026-02-05
 */

import { DataContext } from './types';

// ============================================
// TYPES (kept for compatibility)
// ============================================

export interface SkillOutcome {
  skillId: string;
  skillVersion: string;
  command: string;
  success: boolean;
  errorMessage?: string;
  executionTimeMs?: number;
  dataContext?: DataContext;
  aiResponse?: Record<string, unknown>;
  commandEmbedding?: number[];
  userEdited?: boolean;
  createdAt: Date;
}

export interface SkillPerformance {
  skillId: string;
  skillVersion: string;
  totalUses: number;
  successes: number;
  failures: number;
  avgExecutionTimeMs: number;
  successRate: number;
  lastUsed?: Date;
}

export interface SkillReviewFlag {
  skillId: string;
  skillVersion: string;
  pattern: 'repeated_failure' | 'low_success_rate' | 'high_edit_rate';
  examples: string[];
  suggestedFix?: string;
  createdAt: Date;
  reviewed: boolean;
}

// ============================================
// STUB FUNCTIONS (all disabled)
// ============================================

export async function recordSkillOutcome(outcome: SkillOutcome): Promise<string | null> {
  return null; // Disabled
}

export async function recordUserEdit(usageId: string): Promise<void> {
  // Disabled
}

export async function getSkillPerformance(skillId?: string): Promise<SkillPerformance[]> {
  return []; // Disabled
}

export async function refreshSkillStats(): Promise<void> {
  // Disabled
}

export async function findSimilarFailures(
  embedding: number[],
  skillId?: string,
  limit?: number,
  threshold?: number
): Promise<Array<{
  id: string;
  skillId: string;
  command: string;
  errorMessage?: string;
  similarity: number;
  createdAt: Date;
}>> {
  return []; // Disabled
}

export async function getSkillsNeedingReview(): Promise<SkillReviewFlag[]> {
  return []; // Disabled
}

export async function markReviewed(
  flagId: string,
  resolution: string,
  reviewedBy?: string
): Promise<void> {
  // Disabled
}

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
    ...params,
    createdAt: new Date(),
  };
}

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
