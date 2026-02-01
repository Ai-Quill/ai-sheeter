/**
 * Skill Registry
 * 
 * Central registry for managing and loading skills dynamically.
 * Handles skill selection, composition, and version management.
 * 
 * @version 1.0.0
 */

import {
  GoogleSheetSkill,
  SkillMatch,
  SkillSelectionOptions,
  SkillSelectionResult,
  DataContext,
  SkillExample,
  SKILL_THRESHOLDS,
} from './types';

import { detectIntent, ALL_SKILLS, getSkillById } from './intent-detector';

// ============================================
// SKILL SELECTION
// ============================================

/**
 * Select the best skills for a command
 * Falls back to chat skill if no other skills match
 * 
 * IMPORTANT: For vague/composite requests, ONLY load chat skill
 * to avoid giving the AI mixed signals between action and chat modes.
 * 
 * @param command User's command
 * @param context Data context
 * @param options Selection options
 * @returns Selected skills and metadata (always includes at least one skill)
 */
export async function selectSkills(
  command: string,
  context?: DataContext,
  options: SkillSelectionOptions = {}
): Promise<SkillSelectionResult> {
  const {
    maxSkills = SKILL_THRESHOLDS.MAX_SKILLS,
    minConfidence = SKILL_THRESHOLDS.MIN_CONFIDENCE,
    forceSkills = [],
  } = options;
  
  // Import request analyzer dynamically
  const { analyzeRequest, shouldShowSuggestions } = await import('./request-analyzer');
  
  // Analyze request for vagueness/complexity
  const requestAnalysis = analyzeRequest(command, context);
  const needsSuggestions = shouldShowSuggestions(command);
  
  // Get all matches from intent detector
  const allMatches = detectIntent(command, context);
  
  // Start with forced skills
  const selectedSkills: GoogleSheetSkill[] = [];
  for (const skillId of forceSkills) {
    const skill = getSkillById(skillId);
    if (skill) {
      selectedSkills.push(skill);
    }
  }
  
  // CRITICAL: Only force chat mode for VAGUE requests, NOT for specific composite requests
  // Example: "Make row 2 bold with dark blue background" is composite but SPECIFIC
  //          "Make it look professional" is VAGUE and needs suggestions
  let usedFallback = false;
  let forcedChatMode = false;
  
  // Only force chat for truly VAGUE requests (low specificity)
  // Composite requests with high specificity should use their action skill
  const isVagueEnoughForChat = requestAnalysis.type === 'vague' || 
    (requestAnalysis.type === 'composite' && requestAnalysis.specificity < 0.5);
  
  if (needsSuggestions && isVagueEnoughForChat && requestAnalysis.type !== 'question' && forceSkills.length === 0) {
    const chatSkill = getSkillById('chat');
    if (chatSkill) {
      selectedSkills.push(chatSkill);
      forcedChatMode = true;
      console.log(`[SkillRegistry] Vague request detected (type=${requestAnalysis.type}, specificity=${requestAnalysis.specificity.toFixed(2)}) - using ONLY chat skill`);
    }
  } else if (requestAnalysis.type === 'composite' && requestAnalysis.specificity >= 0.5) {
    console.log(`[SkillRegistry] Specific composite request (type=${requestAnalysis.type}, specificity=${requestAnalysis.specificity.toFixed(2)}) - using action skills`);
  }
  
  // Only add other skills if NOT forced to chat mode
  if (!forcedChatMode) {
    // Add matched skills up to max
    for (const match of allMatches) {
      if (selectedSkills.length >= maxSkills) break;
      if (match.confidence < minConfidence) break;
      
      // Skip if already added (forced)
      if (selectedSkills.some(s => s.id === match.skillId)) continue;
      
      // Check conflicts
      const skill = getSkillById(match.skillId);
      if (!skill) continue;
      
      const hasConflict = selectedSkills.some(selected => 
        selected.conflicts?.includes(skill.id) || 
        skill.conflicts?.includes(selected.id)
      );
      
      if (!hasConflict) {
        selectedSkills.push(skill);
      }
    }
  }
  
  // FALLBACK: If no skills matched, use chat skill
  // This ensures we always have a valid response mode
  if (selectedSkills.length === 0) {
    const chatSkill = getSkillById('chat');
    if (chatSkill) {
      selectedSkills.push(chatSkill);
      usedFallback = true;
      console.log('[SkillRegistry] No skills matched - falling back to chat skill');
    }
  }
  
  // Calculate total token cost
  const estimatedTokens = selectedSkills.reduce(
    (sum, skill) => sum + skill.tokenCost, 
    200  // Base core instructions
  );
  
  // Also mark as fallback if confidence is low
  if (!usedFallback && allMatches.length > 0 && allMatches[0].confidence < SKILL_THRESHOLDS.HIGH_CONFIDENCE) {
    usedFallback = true;
  }
  
  return {
    selectedSkills,
    allMatches,
    estimatedTokens,
    usedFallback,
    // Include request analysis for logging/debugging
    requestAnalysis: {
      type: requestAnalysis.type,
      specificity: requestAnalysis.specificity,
      forcedChatMode,
    },
  };
}

// ============================================
// SKILL CONTENT LOADING
// ============================================

/**
 * Load instructions from selected skills
 */
export function loadSkillInstructions(skills: GoogleSheetSkill[]): string {
  if (skills.length === 0) {
    return getDefaultInstructions();
  }
  
  const parts: string[] = [];
  
  for (const skill of skills) {
    parts.push(`\n${skill.instructions}\n`);
  }
  
  return parts.join('\n---\n');
}

/**
 * Load examples from selected skills
 * 
 * @param skills Selected skills
 * @param command User command (for relevance filtering)
 * @param maxExamples Maximum examples per skill
 */
export function loadSkillExamples(
  skills: GoogleSheetSkill[],
  command: string,
  maxExamples: number = 2
): SkillExample[] {
  const examples: SkillExample[] = [];
  const cmdLower = command.toLowerCase();
  
  for (const skill of skills) {
    // Score examples by relevance
    const scoredExamples = skill.examples.map(ex => {
      let score = 0;
      
      // Check relevance hints
      if (ex.relevanceHints) {
        for (const hint of ex.relevanceHints) {
          if (cmdLower.includes(hint.toLowerCase())) {
            score += 1;
          }
        }
      }
      
      // Check command similarity
      const exWords = ex.command.toLowerCase().split(/\s+/);
      const cmdWords = cmdLower.split(/\s+/);
      const commonWords = exWords.filter(w => cmdWords.includes(w));
      score += commonWords.length * 0.5;
      
      return { example: ex, score };
    });
    
    // Sort by relevance and take top examples
    scoredExamples.sort((a, b) => b.score - a.score);
    const topExamples = scoredExamples.slice(0, maxExamples).map(s => s.example);
    examples.push(...topExamples);
  }
  
  return examples;
}

/**
 * Format examples for prompt inclusion
 */
export function formatExamplesForPrompt(examples: SkillExample[]): string {
  if (examples.length === 0) {
    return '';
  }
  
  const parts: string[] = ['EXAMPLES:'];
  
  for (let i = 0; i < examples.length; i++) {
    const ex = examples[i];
    parts.push(`\n=== Example ${i + 1} ===`);
    parts.push(`User: "${ex.command}"`);
    if (ex.context) {
      parts.push(`Context: ${ex.context}`);
    }
    parts.push(`Response:\n${JSON.stringify(ex.response, null, 2)}`);
  }
  
  return parts.join('\n');
}

// ============================================
// DEFAULT / FALLBACK
// ============================================

/**
 * Get default instructions when no skill matches
 * Falls back to chat mode with helpful guidance
 */
function getDefaultInstructions(): string {
  return `
## Conversational Response Mode

When you can't determine a specific sheet action, respond in CHAT mode.

Return this structure:
{
  "outputMode": "chat",
  "isMultiStep": false,
  "isCommand": true,
  "steps": [],
  "summary": "Responding to your request",
  "clarification": "Brief description",
  "chatResponse": "Your helpful response in Markdown"
}

### For Ambiguous Requests
If the user's request could be interpreted multiple ways, ask for clarification:

"I'd be happy to help! To give you the best result, could you specify:

**For Data Visualization:**
- 'Create a [pie/bar/line] chart showing...'

**For Formatting:**
- 'Format column X as currency'
- 'Make headers bold with blue background'

**For Conditional Formatting:**
- 'Highlight cells where value > 1000 in red'

**For Data Validation:**
- 'Add dropdown with options High, Medium, Low'

**For Filtering:**
- 'Show only rows where status = Active'

What would you like me to do?"

### For General Questions
Answer questions about the data using the context provided.
Use Markdown formatting for clear, structured responses.
`;
}

/**
 * Get all registered skills (for admin/debugging)
 */
export function getAllSkills(): GoogleSheetSkill[] {
  return [...ALL_SKILLS];
}

/**
 * Get skill stats summary
 */
export function getSkillStats(): Array<{
  id: string;
  name: string;
  version: string;
  tokenCost: number;
  priority: number;
  successRate?: number;
}> {
  return ALL_SKILLS.map(skill => ({
    id: skill.id,
    name: skill.name,
    version: skill.version,
    tokenCost: skill.tokenCost,
    priority: skill.priority,
    successRate: skill.successRate,
  }));
}

// ============================================
// EXPORTS
// ============================================

export {
  ALL_SKILLS,
  getSkillById,
  detectIntent,
} from './intent-detector';
