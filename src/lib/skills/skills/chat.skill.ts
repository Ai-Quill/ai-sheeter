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
4. "Highlight [condition] in [color]"

⚠️ CRITICAL: Generate ONLY 4 suggestions, NOT 5!
⚠️ NEVER add a 5th "complete package" or combined suggestion!
⚠️ Each suggestion must be ONE action only!

### Key Rules
- Use context for all ranges/columns (see GOLDEN RULE 1)
- ATOMIC only - NEVER combine actions with "and" or commas
- Maximum 4 suggestions (not 5)
- Labels: 3-5 words, Commands: single action sentences
`;

const CHAT_EXAMPLES: SkillExample[] = [
  {
    command: "What are the top 3 products by revenue?",
    response: {
      outputMode: "chat",
      isMultiStep: false,
      isCommand: true,
      steps: [],
      summary: "Identifying top products",
      clarification: "Analyzing revenue data to find top performers",
      chatResponse: "## Top 3 Products by Revenue\n\n1. **Product A** - $50,000 (40% of total)\n2. **Product B** - $35,000 (28% of total)\n3. **Product C** - $28,000 (22% of total)\n\n### Key Insight\nThe top 3 products account for 90% of total revenue."
    }
  },
  {
    command: "Help me format the table to look professional",
    context: "Columns: A=Salesperson, B=Q1 Sales, C=Q2 Sales, D=Target, E=Achievement, Range=A1:E9",
    response: {
      outputMode: "chat",
      isMultiStep: false,
      isCommand: true,
      steps: [],
      summary: "Suggest professional formatting options",
      clarification: "Based on your sales data, here are formatting options",
      chatResponse: "I can help format your sales data professionally! Here are some options:",
      suggestedActions: [
        { label: "Bold headers with blue background", command: "Make row 1 bold with dark blue background and white text" },
        { label: "Format sales as currency", command: "Format columns B, C, D as currency" },
        { label: "Add borders", command: "Add borders to A1:E9" },
        { label: "Highlight top performers", command: "Highlight values above 100% in column E with green" }
      ]
    },
    relevanceHints: ["professional", "format", "look nice", "style"]
  },
  {
    command: "Make it look nice",
    response: {
      outputMode: "chat",
      isMultiStep: false,
      isCommand: true,
      steps: [],
      summary: "Suggest formatting options",
      clarification: "Here are some formatting options for your data",
      chatResponse: "I'd be happy to help make your data look great! Here are options:",
      suggestedActions: [
        { label: "Style headers", command: "Make row 1 bold with dark blue background and white text" },
        { label: "Add borders", command: "Add borders to the data range" },
        { label: "Format as currency", command: "Format number columns as currency" },
        { label: "Highlight values", command: "Highlight values above average in green" }
      ]
    },
    relevanceHints: ["nice", "look good", "pretty", "style"]
  }
];

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
