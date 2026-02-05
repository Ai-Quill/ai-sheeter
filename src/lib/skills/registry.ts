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
  
  // CRITICAL: Route based on request specificity
  // - VAGUE requests → chat skill only (show suggestions)
  // - SPECIFIC requests → action skills only (execute directly)
  // - Don't mix chat + action skills or AI gets confused
  let usedFallback = false;
  let forcedChatMode = false;
  let excludeChatSkill = false;
  
  // Determine routing
  const isVagueEnoughForChat = requestAnalysis.type === 'vague' || 
    (requestAnalysis.type === 'composite' && requestAnalysis.specificity < 0.5);
  const isSpecificEnough = requestAnalysis.specificity >= 0.7 && requestAnalysis.type !== 'question';
  
  if (needsSuggestions && isVagueEnoughForChat && requestAnalysis.type !== 'question' && forceSkills.length === 0) {
    // VAGUE: Only use chat skill
    const chatSkill = getSkillById('chat');
    if (chatSkill) {
      selectedSkills.push(chatSkill);
      forcedChatMode = true;
      console.log(`[SkillRegistry] Vague request (type=${requestAnalysis.type}, specificity=${requestAnalysis.specificity.toFixed(2)}) - using ONLY chat skill`);
    }
  } else if (isSpecificEnough) {
    // SPECIFIC: Don't include chat skill - let action skills handle it directly
    excludeChatSkill = true;
    console.log(`[SkillRegistry] Specific request (type=${requestAnalysis.type}, specificity=${requestAnalysis.specificity.toFixed(2)}) - using action skills ONLY (excluding chat)`);
  }
  
  // Only add other skills if NOT forced to chat mode
  if (!forcedChatMode) {
    // Add matched skills up to max
    for (const match of allMatches) {
      if (selectedSkills.length >= maxSkills) break;
      if (match.confidence < minConfidence) break;
      
      // Skip if already added (forced)
      if (selectedSkills.some(s => s.id === match.skillId)) continue;
      
      // Skip chat skill if we're handling a specific request
      if (excludeChatSkill && match.skillId === 'chat') {
        console.log(`[SkillRegistry] Excluding chat skill for specific request`);
        continue;
      }
      
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
  
  // FALLBACK: If no skills matched
  if (selectedSkills.length === 0) {
    // If we explicitly excluded chat for a specific request, 
    // try to load the appropriate action skill directly based on detected categories
    if (excludeChatSkill && requestAnalysis.detectedCategories.length > 0) {
      const category = requestAnalysis.detectedCategories[0];
      const categoryToSkill: Record<string, string> = {
        'format': 'format',
        'conditionalFormat': 'conditionalFormat',
        'chart': 'chart',
        'filter': 'filter',
        'dataValidation': 'dataValidation',
        'sheetOps': 'sheetOps',
        'writeData': 'writeData',
      };
      const skillId = categoryToSkill[category];
      if (skillId) {
        const skill = getSkillById(skillId);
        if (skill) {
          selectedSkills.push(skill);
          console.log(`[SkillRegistry] No skills matched threshold, but loading ${skillId} skill based on detected category: ${category}`);
        }
      }
    }
    
    // If still no skills, fall back to chat (but not if we explicitly excluded it)
    if (selectedSkills.length === 0 && !excludeChatSkill) {
      const chatSkill = getSkillById('chat');
      if (chatSkill) {
        selectedSkills.push(chatSkill);
        usedFallback = true;
        console.log('[SkillRegistry] No skills matched - falling back to chat skill');
      }
    } else if (selectedSkills.length === 0) {
      // Last resort: load format skill for any sheet-related request
      const formatSkill = getSkillById('format');
      if (formatSkill) {
        selectedSkills.push(formatSkill);
        console.log('[SkillRegistry] No skills matched and chat excluded - defaulting to format skill');
      }
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
 * SIMPLIFIED: Returns empty array - AI handles it from skill instructions alone.
 * Modern LLMs (GPT-4, Claude, Gemini) understand schemas well without examples.
 * 
 * @param skills Selected skills
 * @param command User command (unused)
 * @param maxExamples Maximum examples (unused)
 */
export async function loadSkillExamples(
  skills: GoogleSheetSkill[],
  command: string,
  maxExamples: number = 2
): Promise<SkillExample[]> {
  // SIMPLIFIED: No examples needed - AI uses skill instructions
  // This reduces token usage and avoids stale examples
  return [];
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
