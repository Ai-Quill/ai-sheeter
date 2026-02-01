/**
 * Google Sheet Skills Type Definitions
 * 
 * This module defines the core types for the skill-based prompt system.
 * Skills are modular, adaptive prompt components that:
 * - Load dynamically based on user intent
 * - Compose together for complex tasks
 * - Learn from success and failure patterns
 * 
 * @version 1.0.0
 * @created 2026-01-30
 */

// ============================================
// CORE TYPES (imported from prompt-builder)
// ============================================

export interface DataContext {
  dataColumns: string[];
  emptyColumns: string[];
  headers: Record<string, string>;
  sampleData: Record<string, string[]>;
  rowCount: number;
  dataRange?: string;
  startRow?: number;
  endRow?: number;
  explicitRowInfo?: {
    headerRowNumber: number | null;
    headerRange: string | null;
    dataStartRow: number;
    dataEndRow: number;
    dataRange: string;
    fullRangeIncludingHeader: string | null;
    headerNames?: Array<{ column: string; name: string }>;
  };
}

// ============================================
// SKILL TYPES
// ============================================

/**
 * Output mode determines how the AI response will be processed
 */
export type OutputMode = 'sheet' | 'formula' | 'chat' | 'columns';

/**
 * Sheet action types supported by the system
 */
export type SheetActionType = 
  | 'chart' 
  | 'format' 
  | 'conditionalFormat' 
  | 'dataValidation' 
  | 'filter' 
  | 'writeData'
  | 'createTable';

/**
 * Suggested action that can be executed by the user
 */
export interface SuggestedAction {
  /** Display label for the action button */
  label: string;
  /** Command to execute when clicked */
  command: string;
}

/**
 * Example for few-shot learning within a skill
 */
export interface SkillExample {
  /** User command that triggers this example */
  command: string;
  /** Optional context description */
  context?: string;
  /** Expected AI response (JSON structure) */
  response: Record<string, unknown>;
  /** When this example is most relevant */
  relevanceHints?: string[];
}

/**
 * Chat response structure with optional actionable suggestions
 */
export interface ChatResponse {
  outputMode: 'chat';
  isMultiStep: boolean;
  isCommand: boolean;
  steps: unknown[];
  summary: string;
  clarification: string;
  chatResponse: string;
  /** Actionable suggestions the user can click to execute */
  suggestedActions?: SuggestedAction[];
}

/**
 * JSON Schema for validating skill output
 */
export interface SkillSchema {
  outputMode: OutputMode;
  sheetAction?: SheetActionType;
  requiredFields: string[];
  optionalFields: string[];
}

/**
 * Core skill definition
 */
export interface GoogleSheetSkill {
  /** Unique identifier: 'chart', 'format', 'conditionalFormat', etc. */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Semantic version for A/B testing */
  version: string;
  
  /** Brief description of what this skill does */
  description: string;
  
  // ========== Intent Detection ==========
  
  /** Keywords/phrases that suggest this skill (regex patterns) */
  triggerPatterns: RegExp[];
  
  /** 
   * Calculate confidence score that this skill should handle the command
   * @param command User's command
   * @param context Data context
   * @returns Confidence score 0-1
   */
  intentScore: (command: string, context?: DataContext) => number;
  
  // ========== Prompt Content ==========
  
  /** Core instructions for this skill (included in prompt) */
  instructions: string;
  
  /** Few-shot examples specific to this skill (optional - can be loaded from DB) */
  examples?: SkillExample[];
  
  /** Expected output schema */
  schema: SkillSchema;
  
  // ========== Metadata ==========
  
  /** Estimated token cost when this skill is included */
  tokenCost: number;
  
  /** Output mode this skill produces */
  outputMode: OutputMode;
  
  /** Sheet action type (if outputMode is 'sheet') */
  sheetAction?: SheetActionType;
  
  /** Priority for selection when multiple skills match (higher = preferred) */
  priority: number;
  
  // ========== Learning Metadata (updated at runtime) ==========
  
  /** Success rate from tracked usage (0-1) */
  successRate?: number;
  
  /** Total number of times this skill was used */
  usageCount?: number;
  
  /** Last time this skill was updated */
  lastUpdated?: Date;
  
  // ========== Composition ==========
  
  /** Other skill IDs this skill depends on */
  requires?: string[];
  
  /** Skill IDs that should not be combined with this one */
  conflicts?: string[];
  
  /** Can this skill be combined with others? */
  composable: boolean;
}

// ============================================
// SKILL MATCHING & SELECTION
// ============================================

/**
 * Result of matching a skill to a command
 */
export interface SkillMatch {
  /** Skill that matched */
  skillId: string;
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Which patterns triggered the match */
  matchedPatterns?: string[];
  
  /** Skill version selected */
  version?: string;
}

/**
 * Options for skill selection
 */
export interface SkillSelectionOptions {
  /** Maximum number of skills to include */
  maxSkills?: number;
  
  /** Minimum confidence threshold */
  minConfidence?: number;
  
  /** Prefer specific skill versions (for A/B testing) */
  preferredVersions?: Record<string, string>;
  
  /** Force specific skills regardless of confidence */
  forceSkills?: string[];
}

/**
 * Result of skill selection process
 */
export interface SkillSelectionResult {
  /** Selected skills in priority order */
  selectedSkills: GoogleSheetSkill[];
  
  /** All matches considered (for debugging) */
  allMatches: SkillMatch[];
  
  /** Total estimated token cost */
  estimatedTokens: number;
  
  /** Whether fallback was used */
  usedFallback: boolean;
  
  /** Request analysis metadata (for logging/debugging) */
  requestAnalysis?: {
    type: string;
    specificity: number;
    forcedChatMode: boolean;
  };
}

// ============================================
// SKILL USAGE TRACKING
// ============================================

/**
 * Outcome of using a skill
 */
export interface SkillOutcome {
  /** Skill that was used */
  skillId: string;
  
  /** Version of the skill */
  skillVersion: string;
  
  /** Original user command */
  command: string;
  
  /** Command embedding for similarity search */
  commandEmbedding?: number[];
  
  /** Whether the skill succeeded */
  success: boolean;
  
  /** Error message if failed */
  errorMessage?: string;
  
  /** Whether user edited the result */
  userEdited?: boolean;
  
  /** Execution time in milliseconds */
  executionTimeMs?: number;
  
  /** Data context at time of execution */
  dataContext?: DataContext;
  
  /** AI response received */
  aiResponse?: Record<string, unknown>;
  
  /** Timestamp */
  createdAt: Date;
}

/**
 * Aggregated skill performance stats
 */
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

/**
 * Flag for skill review (when patterns detected)
 */
export interface SkillReviewFlag {
  skillId: string;
  skillVersion: string;
  pattern: 'repeated_failure' | 'low_success_rate' | 'high_edit_rate';
  examples: SkillOutcome[];
  suggestedFix?: string;
  createdAt: Date;
  reviewed: boolean;
}

// ============================================
// PROMPT COMPOSITION
// ============================================

/**
 * Components for building the final prompt
 */
export interface PromptComponents {
  /** Core instructions (always included) */
  coreInstructions: string;
  
  /** Skill-specific instructions */
  skillInstructions: string[];
  
  /** Few-shot examples */
  examples: SkillExample[];
  
  /** Formatted data context */
  dataContext: string;
  
  /** User's original command */
  command: string;
}

/**
 * Result of prompt building
 */
export interface BuiltPrompt {
  /** The complete prompt string */
  prompt: string;
  
  /** Skills that were included */
  includedSkills: string[];
  
  /** Estimated token count */
  estimatedTokens: number;
  
  /** Metadata for tracking */
  metadata: {
    skillSelectionTime: number;
    promptBuildTime: number;
    usedFallback: boolean;
  };
}

// ============================================
// CONSTANTS
// ============================================

/**
 * Default confidence thresholds
 */
export const SKILL_THRESHOLDS = {
  /** Minimum confidence to include a skill */
  MIN_CONFIDENCE: 0.6,
  
  /** High confidence - skill is very likely correct */
  HIGH_CONFIDENCE: 0.85,
  
  /** Maximum skills to include in one prompt */
  MAX_SKILLS: 2,
  
  /** Minimum uses before trusting success rate */
  MIN_USES_FOR_LEARNING: 10,
  
  /** Success rate threshold for flagging review */
  REVIEW_SUCCESS_THRESHOLD: 0.7,
} as const;

/**
 * Core instructions included in every prompt
 */
export const CORE_INSTRUCTIONS = `You are a Google Sheets workflow designer.

TASK: Accomplish the user's request using the appropriate outputMode.

OUTPUT MODES:
- "sheet": Direct sheet actions (chart, format, validation, filter, writeData)
- "formula": Native Google Sheets formulas (FREE, instant)
- "chat": Answer questions about the data
- "columns": AI-powered row-by-row transformation

⭐ GOLDEN RULE 1 - USE THE CONTEXT:
The DATA CONTEXT provides exact row/column information. ALWAYS use it:
- explicitRowInfo.headerRange → exact header row (e.g., "A1:G1")
- explicitRowInfo.dataStartRow / dataEndRow → data rows (e.g., 2 to 7)
- explicitRowInfo.dataRange → exact data range (e.g., "A2:G7")

When user says "column G", derive the range from context:
- If dataStartRow=2, dataEndRow=7 → use "G2:G7" (NOT "G:G" or "G1:G100")

⭐ GOLDEN RULE 2 - RESPECT USER VALUES:
Include EVERY value the user explicitly mentions:
- Numbers: "between 1000 and 100000" → min: 1000, max: 100000
- Options: "High, Medium, Low" → values: ["High", "Medium", "Low"]
- Colors: "dark blue" → backgroundColor: "#003366"

CRITICAL RULES:
1. Return ONLY valid JSON - no markdown, no explanation
2. ALWAYS derive ranges from explicitRowInfo in context (never guess)
3. Include ALL user-specified values directly in config
4. Data actions should target DATA rows, not headers

`;
