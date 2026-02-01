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
Generate 4-5 atomic suggestions using context:
1. "Convert [fullRange from context] to a table"
2. "Make row [headerRowNumber] bold with dark blue background"
3. "Format columns [numeric columns from context] as currency"
4. "Add borders to [fullRange]"
5. "Highlight highest values in green"

### Key Rules
- Use context for all ranges/columns (see GOLDEN RULE 1)
- Keep suggestions ATOMIC - no combined actions
- Labels: 3-5 words, Commands: complete sentences
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
    context: "Columns: A=Salesperson, B=Q1 Sales, C=Q2 Sales, D=Target, E=Achievement",
    response: {
      outputMode: "chat",
      isMultiStep: false,
      isCommand: true,
      steps: [],
      summary: "Suggest professional formatting options",
      clarification: "Based on your sales data, here are formatting options",
      chatResponse: "I can help format your sales data professionally! Here are some options based on your data:",
      suggestedActions: [
        { label: "Bold headers with blue background", command: "Make headers bold with dark blue background and white text" },
        { label: "Format sales as currency", command: "Format columns B, C, D as currency" },
        { label: "Highlight top performers", command: "Highlight Achievement values above 100% in green" },
        { label: "Add borders and alignment", command: "Add borders to all cells and right-align number columns" },
        { label: "Complete professional look", command: "Format headers bold with blue background, format B C D as currency, add borders, right-align numbers" }
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
      chatResponse: "I'd be happy to help make your data look great! What would you like to do?",
      suggestedActions: [
        { label: "Style headers", command: "Make headers bold with dark blue background" },
        { label: "Add borders", command: "Add borders to all cells" },
        { label: "Format numbers", command: "Format number columns as currency with 2 decimals" },
        { label: "Highlight important values", command: "Highlight cells with values above average in green" }
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
