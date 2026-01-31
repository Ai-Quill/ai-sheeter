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

Return outputMode: "chat" for questions, ambiguous requests, or when no specific action is clear.

### Schema
{
  "outputMode": "chat",
  "isMultiStep": false,
  "isCommand": true,
  "steps": [],
  "summary": "Brief summary",
  "clarification": "Brief description",
  "chatResponse": "Your response in MARKDOWN format",
  "suggestedActions": [
    { "label": "Human-readable label", "command": "Exact command to execute" }
  ]
}

### CRITICAL: Use Data Context to Generate Suggestions
Study the DATA CONTEXT provided. It contains:
- **headers**: Column letters and their header names (e.g., "A: Salesperson", "B: Q1 Sales")
- **dataRange**: The actual data range (e.g., "A2:F9")
- **headerRange**: The header row range (e.g., "A1:F1")
- **Sample values**: Example data from each column

When generating suggestedActions, use the ACTUAL column letters and header names from the context:
- If context shows "B: Q1 Sales" → use "Format column B as currency"
- If context shows "E: Achievement" → use "Highlight column E values above 100% in green"

### For Vague Formatting Requests ("professional", "nice", "clean")
Generate 4-5 specific suggestions based on the data types you observe:

1. **Header styling**: "Make row 1 bold with dark blue background and white text"
2. **Number formatting**: If numeric columns exist → "Format columns [X, Y, Z] as currency"
3. **Conditional formatting**: If percentage/status columns exist → "Highlight [column] where..."
4. **Borders/alignment**: "Add borders to [range] and right-align number columns"
5. **Complete package**: Combine 2-3 actions into one command

### Example Response (using data context)
Given context with: A=Salesperson, B=Q1 Sales, C=Q2 Sales, D=Target, E=Achievement, F=Status

{
  "outputMode": "chat",
  "chatResponse": "I can help format your sales data professionally! Here are specific options:",
  "suggestedActions": [
    { "label": "Style headers", "command": "Make row 1 bold with dark blue background and white text" },
    { "label": "Format sales as currency", "command": "Format columns B, C, D as currency" },
    { "label": "Highlight top performers", "command": "Highlight column E cells above 100% in green" },
    { "label": "Add borders", "command": "Add borders to A1:F9 and right-align columns B, C, D, E" },
    { "label": "Apply all formatting", "command": "Make row 1 bold with blue background, format B C D as currency, add borders to all cells" }
  ]
}

### Rules
- ALWAYS return valid JSON with outputMode: "chat"
- ALWAYS include suggestedActions array (3-5 items) for formatting requests
- Use ACTUAL column letters from the data context (not generic examples)
- Each command must be directly executable
- Keep labels short (3-5 words), commands should be complete sentences
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
