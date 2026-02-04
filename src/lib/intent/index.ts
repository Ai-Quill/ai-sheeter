/**
 * Intent Classification Module
 * 
 * SIMPLIFIED: Learning system disabled.
 * Modern LLMs handle intent from skill instructions alone.
 * 
 * Only types are exported for backwards compatibility.
 * 
 * @version 2.0.0 - Simplified
 * @created 2026-02-02
 * @updated 2026-02-04
 */

// Types only - functions disabled
export type {
  IntentClassification,
  IntentOutputMode,
  SkillId,
  DataContext,
} from './types';

export {
  SKILL_METADATA,
  ALL_SKILL_IDS,
} from './types';

// DEPRECATED: These functions are no longer used
// The learning system has been simplified - AI handles intent from instructions
// 
// export { classifyIntent, learnFromOutcome } from './classifier';
// export { findSimilarIntent, promoteToCache, initializeSeedEmbeddings } from './cache';
