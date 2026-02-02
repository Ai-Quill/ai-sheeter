/**
 * Request Analyzer
 * 
 * Generic analysis of user requests to determine:
 * - Specificity: Is the request specific enough for direct execution?
 * - Complexity: Does it require multiple actions?
 * - Clarity: Is the intent clear?
 * 
 * This enables skills to handle appropriate requests without
 * hardcoding specific phrases like "professional" or "nice".
 * 
 * @version 1.0.0
 */

import { DataContext } from './types';

// ============================================
// REQUEST CLASSIFICATION TYPES
// ============================================

export type RequestType = 'specific' | 'composite' | 'vague' | 'question';

export interface RequestAnalysis {
  /** Overall classification */
  type: RequestType;
  
  /** Specificity score 0-1 (1 = very specific) */
  specificity: number;
  
  /** Number of implied actions (1 = single action) */
  impliedActionCount: number;
  
  /** Has a clear target (column, range, specific data) */
  hasTarget: boolean;
  
  /** Has a clear action verb */
  hasActionVerb: boolean;
  
  /** Uses vague/subjective adjectives */
  hasVagueAdjectives: boolean;
  
  /** Is a question (should go to chat) */
  isQuestion: boolean;
  
  /** Detected action categories */
  detectedCategories: string[];
  
  /** Recommendation for handling */
  recommendation: 'execute' | 'suggest_options' | 'clarify';
}

// ============================================
// PATTERN DEFINITIONS (Generic)
// ============================================

/** Action verbs that indicate clear intent */
const ACTION_VERBS = [
  /\b(format|highlight|color|style|bold|italic|underline)\b/i,
  /\b(add|create|insert|remove|delete|clear)\b/i,
  /\b(filter|sort|group|hide|show)\b/i,
  /\b(chart|graph|plot|visualize)\b/i,
  /\b(validate|restrict|dropdown|checkbox)\b/i,
  /\b(translate|convert|extract|calculate)\b/i,
];

/** Specific targets that indicate clear scope */
const TARGET_PATTERNS = [
  /\bcolumn\s*[A-Z]\b/i,                    // "column A", "column B"
  /\b[A-Z]\d+(?::[A-Z]\d+)?\b/,             // "A1", "B2:C10"
  /\brow\s*\d+\b/i,                          // "row 1", "row 5"
  /\bheader(s)?\b/i,                         // "headers"
  /\b(the\s+)?(first|last|all)\s+(row|column|cell)/i,
  /\b(selected|this)\s+(range|cell|column|row)/i,
];

/** Specific format/action types */
const SPECIFIC_TYPES = [
  /\b(currency|percent|percentage|decimal|number|date|time)\b/i,
  /\b(bold|italic|underline|strikethrough)\b/i,
  /\b(border|borders|outline)\b/i,
  /\b(left|right|center)\s*(align|alignment)?\b/i,
  /\b(pie|bar|line|column|scatter|area)\s*(chart|graph)?\b/i,
  /\b(dropdown|checkbox|list|validation)\b/i,
  /\b(red|green|blue|yellow|orange|purple|#[0-9a-f]{6})\b/i,
];

/** Vague/subjective adjectives that need clarification */
const VAGUE_ADJECTIVES = [
  /\b(professional|professionally)\b/i,
  /\b(nice|nicely|good|better|best)\b/i,
  /\b(pretty|beautiful|clean|neat)\b/i,
  /\b(proper|properly|correct|correctly)\b/i,
  /\b(appropriate|appropriately)\b/i,
  /\b(improved?|enhance|enhanced?)\b/i,
  /\b(fix|fixed|fixing)\b/i,                // "fix it" is vague
  /\b(optimize|optimized?)\b/i,
];

/** Composite action indicators (multiple actions implied) */
const COMPOSITE_INDICATORS = [
  /\b(and|also|plus)\b/i,                   // "format and add borders" (NOT "with" - too common)
  /\b(everything|all\s+of\s+it|the\s+whole)\b/i,
  /\b(complete|full|entire)\s+(format|style|look)/i,
];

/** Question patterns */
const QUESTION_PATTERNS = [
  /\b(what|which|who|where|when|why|how)\b.*\?/i,
  /\b(can\s+you|could\s+you|would\s+you)\s+(tell|show|explain)/i,
  /\b(summarize|summary|analyze|analysis|overview)\b/i,
];

// ============================================
// ANALYSIS FUNCTIONS
// ============================================

/**
 * Analyze a user request to determine how it should be handled
 * 
 * @param command User's command text
 * @param context Optional data context
 * @returns Analysis result with recommendations
 */
export function analyzeRequest(command: string, context?: DataContext): RequestAnalysis {
  const cmdLower = command.toLowerCase();
  
  // Detect components
  const hasActionVerb = ACTION_VERBS.some(p => p.test(command));
  const hasTarget = TARGET_PATTERNS.some(p => p.test(command));
  const hasSpecificType = SPECIFIC_TYPES.some(p => p.test(command));
  const hasVagueAdjectives = VAGUE_ADJECTIVES.some(p => p.test(command));
  const hasCompositeIndicator = COMPOSITE_INDICATORS.some(p => p.test(command));
  const isQuestion = QUESTION_PATTERNS.some(p => p.test(command));
  
  // Detect action categories
  const detectedCategories: string[] = [];
  if (/\b(format|style|bold|italic|color|background)\b/i.test(command)) detectedCategories.push('format');
  if (/\b(highlight|conditional)\b/i.test(command)) detectedCategories.push('conditionalFormat');
  if (/\b(chart|graph|plot|visualize)\b/i.test(command)) detectedCategories.push('chart');
  if (/\b(filter|sort|show\s+only|hide)\b/i.test(command)) detectedCategories.push('filter');
  if (/\b(dropdown|checkbox|validation|restrict)\b/i.test(command)) detectedCategories.push('dataValidation');
  if (/\b(border|align|currency|percent)\b/i.test(command)) detectedCategories.push('format');
  // Write data / table pasting - high specificity when markdown table is detected
  if (/\|.*\|.*\|/.test(command) || /\b(paste|write|create)\s+(this\s+)?(table|data)\b/i.test(command)) {
    detectedCategories.push('writeData');
  }
  // Sheet operations (freeze, hide, sort, etc.)
  if (/\b(freeze|unfreeze|hide|unhide|insert|delete)\s*(row|column)/i.test(command)) {
    detectedCategories.push('sheetOps');
  }
  
  // Count implied actions
  let impliedActionCount = Math.max(1, detectedCategories.length);
  if (hasCompositeIndicator) impliedActionCount = Math.max(2, impliedActionCount);
  if (hasVagueAdjectives && !hasSpecificType) impliedActionCount = Math.max(3, impliedActionCount); // Vague = multiple implied
  
  // Calculate specificity score
  let specificity = 0;
  if (hasActionVerb) specificity += 0.25;
  if (hasTarget) specificity += 0.25;
  if (hasSpecificType) specificity += 0.3;
  if (!hasVagueAdjectives) specificity += 0.2;
  
  // HIGH SPECIFICITY: Pasted table data is unambiguous
  // If command contains markdown table pattern, it's 100% clear what user wants
  const hasMarkdownTable = /\|.*\|.*\|/.test(command);
  if (hasMarkdownTable) {
    specificity = 0.95; // Very high - bypass vagueness checks
  }
  
  // Penalize vagueness (but not if we have a markdown table)
  if (!hasMarkdownTable) {
    if (hasVagueAdjectives && !hasSpecificType) specificity *= 0.5;
    if (hasCompositeIndicator && impliedActionCount > 2) specificity *= 0.7;
  }
  
  // Determine request type
  let type: RequestType;
  if (isQuestion) {
    type = 'question';
  } else if (hasMarkdownTable) {
    // Markdown table = unambiguously specific writeData request
    type = 'specific';
  } else if (hasVagueAdjectives && !hasSpecificType) {
    type = 'vague';
  } else if (impliedActionCount > 1 || hasCompositeIndicator) {
    type = 'composite';
  } else if (specificity >= 0.5) {
    type = 'specific';
  } else {
    type = 'vague';
  }
  
  // Determine recommendation
  let recommendation: 'execute' | 'suggest_options' | 'clarify';
  if (type === 'specific' && specificity >= 0.6) {
    recommendation = 'execute';
  } else if (type === 'composite' || (type === 'vague' && detectedCategories.length > 0)) {
    recommendation = 'suggest_options';
  } else {
    recommendation = 'clarify';
  }
  
  return {
    type,
    specificity,
    impliedActionCount,
    hasTarget,
    hasActionVerb,
    hasVagueAdjectives,
    isQuestion,
    detectedCategories,
    recommendation,
  };
}

/**
 * Check if a request is specific enough for a skill to handle directly
 * 
 * @param command User command
 * @param requiredSpecificity Minimum specificity score (0-1)
 * @returns true if request meets specificity threshold
 */
export function isSpecificEnough(command: string, requiredSpecificity: number = 0.5): boolean {
  const analysis = analyzeRequest(command);
  return analysis.specificity >= requiredSpecificity && analysis.type === 'specific';
}

/**
 * Check if a request should show suggestions instead of direct execution
 */
export function shouldShowSuggestions(command: string): boolean {
  const analysis = analyzeRequest(command);
  return analysis.recommendation === 'suggest_options' || analysis.recommendation === 'clarify';
}

/**
 * Get a description of why a request is vague (for debugging/logging)
 */
export function getVaguenessReason(command: string): string {
  const analysis = analyzeRequest(command);
  const reasons: string[] = [];
  
  if (analysis.hasVagueAdjectives) {
    reasons.push('uses subjective adjectives (professional, nice, good)');
  }
  if (!analysis.hasTarget) {
    reasons.push('no specific target (column, range, cells)');
  }
  if (!analysis.hasActionVerb) {
    reasons.push('no clear action verb');
  }
  if (analysis.impliedActionCount > 1) {
    reasons.push(`implies ${analysis.impliedActionCount} different actions`);
  }
  
  return reasons.length > 0 ? reasons.join('; ') : 'unknown';
}

// ============================================
// EXPORTS
// ============================================

export default {
  analyzeRequest,
  isSpecificEnough,
  shouldShowSuggestions,
  getVaguenessReason,
};
