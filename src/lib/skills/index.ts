/**
 * Google Sheet Skills Module
 * 
 * Modular, adaptive prompt system that:
 * - Loads skills dynamically based on detected intent
 * - Composes minimal prompts for token efficiency
 * - Learns from success/failure patterns
 * 
 * @version 1.0.0
 */

// Types
export * from './types';

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

// Skill Learning
export {
  recordSkillOutcome,
  recordUserEdit,
  getSkillPerformance,
  refreshSkillStats,
  findSimilarFailures,
  getSkillsNeedingReview,
  markReviewed,
  createOutcome,
} from './skill-learner';

// Individual Skills (for direct access if needed)
export { chartSkill } from './skills/chart.skill';
export { formatSkill } from './skills/format.skill';
export { conditionalFormatSkill } from './skills/conditional-format.skill';
export { dataValidationSkill } from './skills/data-validation.skill';
export { filterSkill } from './skills/filter.skill';
export { writeDataSkill } from './skills/write-data.skill';
export { chatSkill } from './skills/chat.skill';
export { formulaSkill } from './skills/formula.skill';
