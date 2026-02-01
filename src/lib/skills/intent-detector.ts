/**
 * Intent Detector
 * 
 * Lightweight keyword and pattern-based intent detection
 * to determine which skills should be loaded for a command.
 * 
 * This runs BEFORE the main AI call to reduce token usage
 * by loading only relevant skill instructions.
 * 
 * Uses the Request Analyzer for generic vagueness detection
 * instead of hardcoding specific patterns.
 * 
 * @version 1.1.0
 */

import { 
  DataContext, 
  SkillMatch, 
  GoogleSheetSkill,
  SKILL_THRESHOLDS 
} from './types';

import { analyzeRequest, shouldShowSuggestions } from './request-analyzer';

// Import all skills
import { chartSkill } from './skills/chart.skill';
import { formatSkill } from './skills/format.skill';
import { conditionalFormatSkill } from './skills/conditional-format.skill';
import { dataValidationSkill } from './skills/data-validation.skill';
import { filterSkill } from './skills/filter.skill';
import { writeDataSkill } from './skills/write-data.skill';
import { chatSkill } from './skills/chat.skill';
import { formulaSkill } from './skills/formula.skill';
import { tableSkill } from './skills/table.skill';
import { sheetOpsSkill } from './skills/sheet-ops.skill';

// ============================================
// ALL SKILLS (ordered by priority)
// ============================================

export const ALL_SKILLS: GoogleSheetSkill[] = [
  chartSkill,
  formatSkill,
  conditionalFormatSkill,
  dataValidationSkill,
  filterSkill,
  writeDataSkill,
  tableSkill,
  chatSkill,
  formulaSkill,
  sheetOpsSkill,
].sort((a, b) => b.priority - a.priority);

// ============================================
// INTENT DETECTION
// ============================================

/**
 * Detect which skills are relevant for a command
 * 
 * Uses the Request Analyzer to detect vague/composite requests
 * and route them appropriately to chat for suggestions.
 * 
 * @param command User's command text
 * @param context Optional data context for smarter matching
 * @returns Array of skill matches sorted by confidence
 */
export function detectIntent(
  command: string, 
  context?: DataContext
): SkillMatch[] {
  const matches: SkillMatch[] = [];
  
  // Analyze request for vagueness/complexity
  const requestAnalysis = analyzeRequest(command, context);
  const needsSuggestions = shouldShowSuggestions(command);
  
  // Log analysis for debugging
  if (requestAnalysis.type !== 'specific') {
    console.log(`[IntentDetector] Request analysis: type=${requestAnalysis.type}, specificity=${requestAnalysis.specificity.toFixed(2)}, recommendation=${requestAnalysis.recommendation}`);
  }
  
  for (const skill of ALL_SKILLS) {
    // Calculate base confidence using skill's own scoring function
    let confidence = skill.intentScore(command, context);
    
    // Find which patterns matched (for debugging)
    const matchedPatterns: string[] = [];
    for (const pattern of skill.triggerPatterns) {
      if (pattern.test(command)) {
        matchedPatterns.push(pattern.source);
      }
    }
    
    // GENERIC VAGUENESS HANDLING:
    // If request is vague/composite and needs suggestions, boost chat skill
    // and reduce confidence of action skills
    if (needsSuggestions && requestAnalysis.type !== 'question') {
      if (skill.id === 'chat') {
        // Boost chat skill for vague requests
        confidence = Math.max(confidence, 0.75);
      } else if (skill.outputMode === 'sheet') {
        // Reduce action skill confidence for vague requests
        // They shouldn't execute directly without clarification
        confidence *= (requestAnalysis.specificity * 0.8);
      }
    }
    
    // Only include if above minimum threshold
    if (confidence >= SKILL_THRESHOLDS.MIN_CONFIDENCE) {
      matches.push({
        skillId: skill.id,
        confidence,
        matchedPatterns,
        version: skill.version,
      });
    }
  }
  
  // Sort by confidence (highest first)
  return matches.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Quick check if command likely needs a specific skill
 * Useful for fast pre-filtering before full detection
 */
export function quickSkillCheck(command: string): string | null {
  const cmdLower = command.toLowerCase();
  
  // Chart keywords
  if (/\b(chart|graph|plot|visualize|pie|bar|line|scatter)\b/i.test(cmdLower)) {
    return 'chart';
  }
  
  // Conditional format keywords
  if (/\b(highlight|color\s*code|red.*(negative|if)|green.*(positive|if))\b/i.test(cmdLower)) {
    return 'conditionalFormat';
  }
  
  // Data validation keywords
  if (/\b(dropdown|checkbox|validation)\b/i.test(cmdLower)) {
    return 'dataValidation';
  }
  
  // Filter keywords
  if (/\b(filter|show\s+only|hide\s+rows)\b/i.test(cmdLower)) {
    return 'filter';
  }
  
  // Write data - check for pasted table
  if (/\|.*\|.*\|/.test(command) || /\b(paste|write)\s+(this\s+)?(data|table)\b/i.test(cmdLower)) {
    return 'writeData';
  }
  
  // Formula keywords
  if (/\b(translate|uppercase|lowercase|extract|trim)\b/i.test(cmdLower)) {
    return 'formula';
  }
  
  // Format keywords (check after more specific skills)
  if (/\b(format|currency|percent|bold|border)\b/i.test(cmdLower)) {
    return 'format';
  }
  
  // Sheet operations keywords
  if (/\b(freeze|unfreeze|hide|unhide|insert|delete)\s*(row|column)/i.test(cmdLower)) {
    return 'sheetOps';
  }
  if (/\b(sort|clear|resize|auto\s*fit|rename\s*sheet|tab\s*color|group|protect)\b/i.test(cmdLower)) {
    return 'sheetOps';
  }
  
  // Question patterns -> chat
  if (/\b(what|which|who|how\s+many|summarize)\b.*\??/i.test(cmdLower)) {
    return 'chat';
  }
  
  return null;
}

/**
 * Check if multiple skills might be needed (complex request)
 */
export function isMultiSkillRequest(command: string): boolean {
  const cmdLower = command.toLowerCase();
  
  // Contains "and" connecting different actions
  const andPatterns = [
    /\bformat.*and.*highlight\b/i,
    /\bhighlight.*and.*format\b/i,
    /\bchart.*and.*format\b/i,
    /\b(add|create).*and.*(add|create)\b/i,
  ];
  
  for (const pattern of andPatterns) {
    if (pattern.test(cmdLower)) {
      return true;
    }
  }
  
  // Count distinct skill matches
  const matches = detectIntent(command);
  const highConfidenceMatches = matches.filter(
    m => m.confidence >= SKILL_THRESHOLDS.HIGH_CONFIDENCE
  );
  
  return highConfidenceMatches.length > 1;
}

/**
 * Get the best single skill for a command
 * Falls back to chat skill if no other skill matches
 */
export function getBestSkill(
  command: string, 
  context?: DataContext
): GoogleSheetSkill {
  const matches = detectIntent(command, context);
  
  if (matches.length === 0) {
    // No skill matched - fall back to chat
    console.log('[IntentDetector] No skill matched, falling back to chat');
    return chatSkill;
  }
  
  const bestMatch = matches[0];
  const skill = ALL_SKILLS.find(s => s.id === bestMatch.skillId);
  
  // Return matched skill or fall back to chat
  return skill || chatSkill;
}

/**
 * Get the best skill with fallback to chat
 * Always returns a valid skill (never null)
 */
export function getBestSkillWithFallback(
  command: string,
  context?: DataContext
): { skill: GoogleSheetSkill; confidence: number; isFallback: boolean } {
  const matches = detectIntent(command, context);
  
  if (matches.length === 0) {
    return {
      skill: chatSkill,
      confidence: 0.5,  // Default confidence for fallback
      isFallback: true,
    };
  }
  
  const bestMatch = matches[0];
  const skill = ALL_SKILLS.find(s => s.id === bestMatch.skillId);
  
  if (!skill) {
    return {
      skill: chatSkill,
      confidence: 0.5,
      isFallback: true,
    };
  }
  
  return {
    skill,
    confidence: bestMatch.confidence,
    isFallback: false,
  };
}

/**
 * Get skill by ID
 */
export function getSkillById(skillId: string): GoogleSheetSkill | undefined {
  return ALL_SKILLS.find(s => s.id === skillId);
}

// ============================================
// DEBUG HELPERS
// ============================================

/**
 * Get detailed analysis of intent detection (for debugging)
 */
export function analyzeIntent(command: string, context?: DataContext): {
  command: string;
  matches: SkillMatch[];
  quickCheck: string | null;
  isMultiSkill: boolean;
  recommendation: string;
} {
  const matches = detectIntent(command, context);
  const quickCheck = quickSkillCheck(command);
  const isMultiSkill = isMultiSkillRequest(command);
  
  let recommendation: string;
  if (matches.length === 0) {
    recommendation = 'No skill matched - use fallback/clarification';
  } else if (matches[0].confidence >= SKILL_THRESHOLDS.HIGH_CONFIDENCE) {
    recommendation = `High confidence: Load ${matches[0].skillId} skill only`;
  } else if (matches.length >= 2 && matches[1].confidence >= SKILL_THRESHOLDS.MIN_CONFIDENCE) {
    recommendation = `Medium confidence: Load ${matches[0].skillId} and ${matches[1].skillId} skills`;
  } else {
    recommendation = `Low confidence: Load ${matches[0].skillId} with fallback ready`;
  }
  
  return {
    command,
    matches,
    quickCheck,
    isMultiSkill,
    recommendation,
  };
}
