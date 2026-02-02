/**
 * Chat Skill
 * 
 * Handles question/answer requests:
 * - Summarize data
 * - Answer questions about data
 * - Provide insights
 * 
 * @version 1.1.0 - Unified Intent
 */

import { GoogleSheetSkill, SkillExample } from '../types';

/**
 * Capabilities for unified intent classifier
 */
const CHAT_CAPABILITIES = [
  'question', 'what', 'which', 'who', 'how-many', 'how-much', 'where', 'when',
  'summarize', 'summary', 'overview', 'analyze', 'analysis',
  'tell-me', 'explain', 'describe',
  'top-n', 'bottom-n', 'highest', 'lowest',
  'insights', 'compare', 'vague-request'
];

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

### 🚫 FORBIDDEN - NEVER Suggest Destructive Actions
NEVER generate suggested actions that could delete or overwrite user data:
- NO "Clear", "Delete", "Remove", "Replace current data", "Overwrite"
- NO "Import [imagined dataset]" - only use data the user actually provided
- NO actions that modify data the user didn't explicitly ask to change
- If user asks about importing data, guide them to paste/type the data - don't offer to replace existing data
- Suggested actions should ONLY ADD or FORMAT - never DELETE or REPLACE

### Key Rules
- Use context for all ranges/columns (see GOLDEN RULE 1)
- ATOMIC only - NEVER combine actions with "and" or commas
- Maximum 4 suggestions (not 5)
- Labels: 3-5 words, Commands: single action sentences
- SAFE actions only - no data loss risk
`;

// Minimal seed examples - database will provide better examples over time
const CHAT_EXAMPLES: SkillExample[] = [];

export const chatSkill: GoogleSheetSkill = {
  id: 'chat',
  name: 'Data Q&A',
  version: '1.1.0',
  description: 'Answer questions and provide insights about data',
  
  // Semantic capabilities for unified intent classifier
  capabilities: CHAT_CAPABILITIES,
  
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
