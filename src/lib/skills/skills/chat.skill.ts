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
  /\b(what|which|who|how\s+many|how\s+much|where|when)\b.*\?/i,
  /\b(summarize|summary|overview|analyze|analysis)\b/i,
  /\b(tell\s+me|explain|describe)\b/i,
  /\b(list|show\s+me|give\s+me)\s+(the\s+)?(top|bottom|highest|lowest)/i,
  /\bwhat\s+(are|is|were|was)\b/i,
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
  
  // Penalize if it looks like an action request
  if (/\b(create|make|add|format|chart|filter)\b/i.test(cmdLower)) score -= 0.3;
  
  return Math.max(0, Math.min(score, 1.0));
}

const CHAT_INSTRUCTIONS = `
## CHAT Skill

For questions, ambiguous requests, or when no specific action is clear, return outputMode: "chat".

### Schema
{
  "outputMode": "chat",
  "isMultiStep": false,
  "isCommand": true,
  "steps": [],
  "summary": "Analyzing data to answer your question",
  "clarification": "Brief description of what you're doing",
  "chatResponse": "Your detailed answer in MARKDOWN format"
}

### Response Formatting
Use proper Markdown in chatResponse:
- ## for main sections
- ### for subsections  
- **bold** for emphasis
- Bullet lists (- or 1.)
- Tables for structured data
- Add spacing between sections

### Example Response Format
"## Top 3 Products by Revenue\\n\\n1. **Product A** - $50,000\\n2. **Product B** - $35,000\\n3. **Product C** - $28,000\\n\\n### Key Insight\\nProduct A accounts for 40% of total revenue."

### For Ambiguous/Unclear Requests
If you can't determine what specific action the user wants, provide helpful guidance:

"I'd be happy to help! Here are some things I can do with your data:\\n\\n**Visualize:**\\n- 'Create a pie chart of sales by region'\\n- 'Show a line chart of revenue over time'\\n\\n**Format:**\\n- 'Format column C as currency'\\n- 'Make headers bold with blue background'\\n\\n**Highlight:**\\n- 'Highlight negative values in red'\\n- 'Color code status column'\\n\\n**Analyze:**\\n- 'What are the top 5 products?'\\n- 'Summarize the sales data'\\n\\nWhat would you like me to do?"

### Important
- ALWAYS return valid JSON with outputMode: "chat"
- If analyzing data, use the ACTUAL data in the context
- Provide specific insights, not generic answers
- If unsure what user wants, ASK for clarification in a helpful way
- NEVER return an empty response or undefined sheetAction
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
    command: "Summarize the sales data",
    response: {
      outputMode: "chat",
      isMultiStep: false,
      isCommand: true,
      steps: [],
      summary: "Summarizing sales data",
      clarification: "Creating overview of sales performance",
      chatResponse: "## Sales Summary\n\n**Total Revenue:** $125,000\n**Total Orders:** 450\n**Average Order Value:** $278\n\n### By Region\n- North: $45,000 (36%)\n- South: $40,000 (32%)\n- West: $40,000 (32%)\n\n### Trend\nSales increased 15% compared to last period."
    }
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
