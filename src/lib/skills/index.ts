/**
 * Google Sheet Skills Module
 * 
 * SIMPLIFIED: Trusts AI with skill instructions alone.
 * 
 * Core features:
 * - Loads skills dynamically based on detected intent
 * - Composes minimal prompts for token efficiency
 * - Uses generic request analysis to handle vague/composite requests
 * 
 * REMOVED (trusting AI instead):
 * - Dynamic examples from database
 * - Skill learning/outcome tracking
 * - Embedding-based similarity search
 * 
 * @version 2.0.0 - Simplified
 */

// Types
export * from './types';

// Request Analysis (generic vagueness/complexity detection)
export {
  analyzeRequest,
  isSpecificEnough,
  shouldShowSuggestions,
  getVaguenessReason,
  type RequestType,
  type RequestAnalysis,
} from './request-analyzer';

// Intent Detection
export { 
  detectIntent, 
  quickSkillCheck, 
  isMultiSkillRequest,
  getBestSkill,
  getBestSkillWithFallback,
  getSkillById,
  analyzeIntent,
  ALL_SKILLS,
} from './intent-detector';

// Skill Registry
export {
  selectSkills,
  loadSkillInstructions,
  loadSkillExamples,
  formatExamplesForPrompt,
  getAllSkills,
  getSkillStats,
} from './registry';

// Individual Skills (for direct access if needed)
export { chartSkill } from './skills/chart.skill';
export { formatSkill } from './skills/format.skill';
export { conditionalFormatSkill } from './skills/conditional-format.skill';
export { dataValidationSkill } from './skills/data-validation.skill';
export { filterSkill } from './skills/filter.skill';
export { writeDataSkill } from './skills/write-data.skill';
export { chatSkill } from './skills/chat.skill';
export { formulaSkill } from './skills/formula.skill';
export { tableSkill } from './skills/table.skill';
export { sheetOpsSkill } from './skills/sheet-ops.skill';

// ============================================
// DEPRECATED - Kept for reference only
// ============================================
// These modules are disabled but kept for potential future use:
// - ./skill-learner.ts: Tracks skill usage patterns
// - ./dynamic-examples.ts: Loads examples from database