/**
 * Chat Skill
 * 
 * Handles question/answer requests:
 * - Summarize data
 * - Answer questions about data
 * - Provide insights
 * 
 * @version 1.0.0
 */

import { GoogleSheetSkill, SkillExample, DataContext } from '../types';

const CHAT_PATTERNS: RegExp[] = [
  // Question patterns
  /\b(what|which|who|how\s+many|how\s+much|where|when)\b.*\?/i,
  /\b(summarize|summary|overview|analyze|analysis)\b/i,
  /\b(tell\s+me|explain|describe)\b/i,
  /\b(list|show\s+me|give\s+me)\s+(the\s+)?(top|bottom|highest|lowest)/i,
  /\bwhat\s+(are|is|were|was)\b/i,
  // NOTE: Vague request handling (professional, nice, etc.) is now done
  // generically by the Request Analyzer in intent-detector.ts
  // Chat skill gets boosted automatically for vague/composite requests
];

function calculateIntentScore(command: string, context?: DataContext): number {
  const cmdLower = command.toLowerCase();
  let score = 0;
  
  // Question words with question mark
  if (/\b(what|which|who|how\s+many|how\s+much)\b.*\?/i.test(cmdLower)) score += 0.6;
  
  // Summarize/analyze requests
  if (/\b(summarize|summary|overview)\b/i.test(cmdLower)) score += 0.5;
  if (/\b(analyze|analysis|insights?)\b/i.test(cmdLower)) score += 0.5;
  
  // Tell me / explain requests
  if (/\b(tell\s+me|explain|describe)\b/i.test(cmdLower)) score += 0.4;
  
  // List top/bottom requests
  if (/\b(list|show\s+me)\s+(the\s+)?(top|bottom)/i.test(cmdLower)) score += 0.4;
  
  // NOTE: Vague request handling (professional, nice, etc.) is now done
  // generically by the Request Analyzer in intent-detector.ts
  // Chat skill confidence gets boosted automatically for vague/composite requests
  
  // Penalize if it looks like a SPECIFIC action request (not vague)
  if (/\b(currency|percent|border|bold|highlight|dropdown|checkbox)\b/i.test(cmdLower)) score -= 0.4;
  if (/\b(chart|pie|bar|line|scatter)\b/i.test(cmdLower)) score -= 0.5;
  
  return Math.max(0, Math.min(score, 1.0));
}

const CHAT_INSTRUCTIONS = `
## CHAT Skill

Return outputMode: "chat" for questions, vague requests, or when clarification needed.

### Schema
{
  "outputMode": "chat",
  "steps": [],
  "chatResponse": "Your response in MARKDOWN",
  "suggestedActions": [
    { "label": "Short label", "command": "Executable command using context" }
  ]
}

### CRITICAL: Derive suggestions from DATA CONTEXT
- Use ACTUAL column letters/names from context headers
- Use ACTUAL ranges from explicitRowInfo
- Each suggestion must be ATOMIC (single action)

### For Vague Requests ("professional", "nice")
Generate 4 atomic suggestions using context (NOT 5 - avoid composite):
1. "Make row [headerRowNumber] bold with dark blue background and white text"
2. "Format columns [numeric columns] as currency"
3. "Add borders to [fullRange]"
4. "Conditional format: highlight cells where [column] equals [value] in green" (for status columns)

⚠️ CRITICAL: Generate ONLY 4 suggestions, NOT 5!
⚠️ NEVER add a 5th "complete package" or combined suggestion!
⚠️ Each suggestion must be ONE action only!
⚠️ For value-based highlighting, use "conditional format" or "where equals" language!

### Key Rules
- Use context for all ranges/columns (see GOLDEN RULE 1)
- ATOMIC only - NEVER combine actions with "and" or commas
- Maximum 4 suggestions (not 5)
- Labels: 3-5 words, Commands: single action sentences
`;

// Minimal seed examples - database will provide better examples over time
const CHAT_EXAMPLES: SkillExample[] = [];

export const chatSkill: GoogleSheetSkill = {
  id: 'chat',
  name: 'Data Q&A',
  version: '1.0.0',
  description: 'Answer questions and provide insights about data',
  
  triggerPatterns: CHAT_PATTERNS,
  intentScore: calculateIntentScore,
  
  instructions: CHAT_INSTRUCTIONS,
  examples: CHAT_EXAMPLES,
  
  schema: {
    outputMode: 'chat',
    requiredFields: ['chatResponse'],
    optionalFields: ['summary', 'clarification']
  },
  
  tokenCost: 200,
  outputMode: 'chat',
  priority: 5,  // Lower priority - prefer action skills
  composable: false,
};

export default chatSkill;
