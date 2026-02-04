/**
 * Unified Intent Classification Module
 * 
 * This module provides AI-driven intent classification that replaces
 * hardcoded regex patterns across the codebase.
 * 
 * Usage:
 * ```typescript
 * import { classifyIntent, learnFromOutcome } from '@/lib/intent';
 * 
 * // Classify a command
 * const classification = await classifyIntent(command, context);
 * 
 * // After execution, record the outcome for learning
 * await learnFromOutcome({ command, classification, success: true });
 * ```
 * 
 * @version 1.0.0
 * @created 2026-02-02
 */

// Main classifier
export {
  classifyIntent,
  learnFromOutcome,
  fallbackClassify,
  CACHE_SIMILARITY_THRESHOLD,
  MIN_AI_CONFIDENCE,
} from './classifier';

// Cache operations
export {
  findSimilarIntent,
  promoteToCache,
  recordOutcome,
  initializeSeedEmbeddings,
  initializeSkillExampleEmbeddings,
  areSeedEmbeddingsInitialized,
  getMetrics,
  getCacheStats,
} from './cache';

// Types
export type {
  IntentClassification,
  IntentOutputMode,
  SkillId,
  CachedIntent,
  CacheLookupResult,
  AIClassificationParams,
  AIClassificationResult,
  ClassificationOutcome,
  ClassificationMetrics,
  SeedExample,
  DataContext,
} from './types';

export {
  SKILL_METADATA,
  ALL_SKILL_IDS,
} from './types';
