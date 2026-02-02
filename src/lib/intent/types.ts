/**
 * Unified Intent Classification Types
 * 
 * This module defines types for the AI-driven intent classification system
 * that replaces hardcoded regex patterns across the codebase.
 * 
 * The system uses:
 * 1. Embedding similarity for fast path (cached intents)
 * 2. AI classification for ambiguous cases
 * 3. Learning loop to improve over time
 * 
 * @version 1.0.0
 * @created 2026-02-01
 */

import { DataContext, SheetActionType, OutputMode } from '../skills/types';

// ============================================
// CORE INTENT TYPES
// ============================================

/**
 * All possible skill IDs in the system
 */
export type SkillId = 
  | 'format'
  | 'chart'
  | 'conditionalFormat'
  | 'dataValidation'
  | 'filter'
  | 'writeData'
  | 'table'
  | 'sheetOps'
  | 'formula'
  | 'chat';

/**
 * Extended output mode including workflow for multi-step operations
 */
export type IntentOutputMode = OutputMode | 'workflow';

/**
 * Result of intent classification
 */
export interface IntentClassification {
  /** How the response should be processed */
  outputMode: IntentOutputMode;
  
  /** Which skill should handle this request (null for workflow/ambiguous) */
  skillId: SkillId | null;
  
  /** For sheet actions, the specific action type */
  sheetAction?: SheetActionType;
  
  /** Confidence score 0.0 - 1.0 */
  confidence: number;
  
  /** Optional reasoning for debugging */
  reasoning?: string;
  
  /** Source of classification: 'cache', 'ai', or 'fallback' */
  source: 'cache' | 'ai' | 'fallback';
  
  /** Time taken for classification in ms */
  classificationTimeMs?: number;
}

/**
 * Cached intent entry in the database
 */
export interface CachedIntent {
  /** Unique ID */
  id: string;
  
  /** Canonical command that this intent represents */
  canonicalCommand: string;
  
  /** Vector embedding of the canonical command */
  embedding: number[];
  
  /** The classification result */
  intent: IntentClassification;
  
  /** Number of times this cache entry was hit */
  hitCount: number;
  
  /** Success rate when this classification was used */
  successRate: number;
  
  /** Whether this is a seed example (manually created) */
  isSeed: boolean;
  
  /** Created timestamp */
  createdAt: string;
  
  /** Last used timestamp */
  lastUsedAt: string;
}

/**
 * Result of cache lookup
 */
export interface CacheLookupResult {
  /** Whether a match was found above threshold */
  hit: boolean;
  
  /** The cached intent if hit */
  cachedIntent?: CachedIntent;
  
  /** Similarity score if match found */
  similarity?: number;
  
  /** Time taken for lookup in ms */
  lookupTimeMs: number;
}

/**
 * Parameters for AI classification
 */
export interface AIClassificationParams {
  /** The user's command */
  command: string;
  
  /** Data context from the spreadsheet */
  context: DataContext;
  
  /** Maximum tokens for classification (default: 100) */
  maxTokens?: number;
  
  /** Model to use for classification (uses fast model by default) */
  model?: string;
}

/**
 * Result of AI classification call
 */
export interface AIClassificationResult extends IntentClassification {
  /** Raw response from AI */
  rawResponse?: string;
  
  /** Tokens used for classification */
  tokensUsed?: number;
}

// ============================================
// LEARNING LOOP TYPES
// ============================================

/**
 * Record of a classification outcome for learning
 */
export interface ClassificationOutcome {
  /** Unique ID */
  id: string;
  
  /** Original command */
  command: string;
  
  /** Command embedding */
  embedding: number[];
  
  /** The classification that was used */
  classification: IntentClassification;
  
  /** Whether the execution succeeded */
  success: boolean;
  
  /** Error message if failed */
  errorMessage?: string;
  
  /** Whether user edited the result */
  userEdited: boolean;
  
  /** Timestamp */
  createdAt: string;
}

/**
 * Metrics for classification quality
 */
export interface ClassificationMetrics {
  /** Total classifications */
  total: number;
  
  /** Cache hit rate */
  cacheHitRate: number;
  
  /** AI classification rate */
  aiClassificationRate: number;
  
  /** Fallback rate */
  fallbackRate: number;
  
  /** Overall success rate */
  successRate: number;
  
  /** Average classification time in ms */
  avgClassificationTimeMs: number;
  
  /** By skill breakdown */
  bySkill: Record<SkillId, {
    count: number;
    successRate: number;
  }>;
}

// ============================================
// SEED DATA TYPES
// ============================================

/**
 * Seed example for pre-populating the cache
 */
export interface SeedExample {
  /** Representative command */
  command: string;
  
  /** Expected output mode */
  outputMode: IntentOutputMode;
  
  /** Expected skill ID */
  skillId: SkillId | null;
  
  /** For sheet actions, the action type */
  sheetAction?: SheetActionType;
  
  /** Optional category for organization */
  category?: string;
}

/**
 * All skill metadata for the classifier prompt
 */
export const SKILL_METADATA: Record<SkillId, {
  name: string;
  description: string;
  capabilities: string[];
}> = {
  format: {
    name: 'Data Formatting',
    description: 'Format numbers, dates, styles, borders, alignment, merging',
    capabilities: [
      'currency', 'percent', 'number', 'date', 'datetime',
      'bold', 'italic', 'underline', 'strikethrough',
      'borders', 'alignment', 'merging', 'banding', 'rotation', 'wrap'
    ]
  },
  chart: {
    name: 'Chart & Visualization',
    description: 'Create charts and visualizations from data',
    capabilities: [
      'pie', 'bar', 'column', 'line', 'area', 'scatter', 'combo',
      'histogram', 'trendlines', 'dual-axis', 'log-scale'
    ]
  },
  conditionalFormat: {
    name: 'Conditional Formatting',
    description: 'Highlight cells based on values or conditions',
    capabilities: [
      'highlight', 'color-code', 'gradient', 'color-scale', 'heat-map',
      'greater-than', 'less-than', 'between', 'equals', 'contains',
      'date-conditions', 'negative-positive'
    ]
  },
  dataValidation: {
    name: 'Data Validation',
    description: 'Add input restrictions and validation rules',
    capabilities: [
      'dropdown', 'checkbox', 'list', 'number-range', 'date-range',
      'text-validation', 'email', 'url', 'custom-formula'
    ]
  },
  filter: {
    name: 'Data Filtering',
    description: 'Filter data to show/hide rows based on criteria',
    capabilities: [
      'filter', 'show-only', 'hide-rows', 'equals', 'contains',
      'date-filter', 'number-filter', 'multiple-criteria'
    ]
  },
  writeData: {
    name: 'Write Table Data',
    description: 'Parse and write pasted table/CSV data to sheet',
    capabilities: [
      'paste-table', 'markdown-table', 'csv', 'create-table', 'write-data'
    ]
  },
  table: {
    name: 'Table Creation',
    description: 'Convert data range into formatted table',
    capabilities: [
      'create-table', 'table-format', 'professional-table', 'structured-table'
    ]
  },
  sheetOps: {
    name: 'Sheet Operations',
    description: 'Sheet-level operations like freeze, hide, sort, resize',
    capabilities: [
      'freeze', 'unfreeze', 'hide-rows', 'hide-columns', 'show',
      'insert', 'delete', 'sort', 'clear', 'resize', 'auto-fit',
      'rename-sheet', 'tab-color', 'group', 'protect'
    ]
  },
  formula: {
    name: 'Formula Operations',
    description: 'Native Google Sheets formula operations',
    capabilities: [
      'translate', 'googletranslate', 'uppercase', 'lowercase', 'trim',
      'extract', 'regex', 'concatenate', 'split', 'sum', 'average'
    ]
  },
  chat: {
    name: 'Chat & Questions',
    description: 'Answer questions and provide information about data',
    capabilities: [
      'what', 'which', 'how-many', 'summarize', 'analyze', 'explain',
      'top-n', 'bottom-n', 'compare', 'insights'
    ]
  }
};

/**
 * All valid skill IDs as array (for validation)
 */
export const ALL_SKILL_IDS: SkillId[] = [
  'format', 'chart', 'conditionalFormat', 'dataValidation',
  'filter', 'writeData', 'table', 'sheetOps', 'formula', 'chat'
];

// Re-export DataContext for convenience
export type { DataContext };
