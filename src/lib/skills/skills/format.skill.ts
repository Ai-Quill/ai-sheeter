/**
 * Format Skill
 * 
 * Handles formatting requests:
 * - Number formatting (currency, percent, date)
 * - Text styling (bold, italic, colors)
 * - Borders and alignment
 * 
 * @version 1.0.0
 */

import { GoogleSheetSkill, SkillExample, DataContext } from '../types';

const FORMAT_PATTERNS: RegExp[] = [
  /\b(format|formatting)\b/i,
  /\b(currency|percent|percentage|decimal|number\s*format)\b/i,
  /\b(bold|italic|underline|font)\b/i,
  /\b(border|borders|alignment|align)\b/i,
  /\b(background|bgcolor|color|colour)\b/i,
  /\b(date\s*format|time\s*format)\b/i,
  /\b(style|styling)\s+(the\s+)?(header|cell|row|column)/i,
];

function calculateIntentScore(command: string, context?: DataContext): number {
  const cmdLower = command.toLowerCase();
  let score = 0;
  
  // NOTE: Vague request handling (professional, nice, etc.) is now done
  // generically by the Request Analyzer in intent-detector.ts
  // This skill only scores based on specific formatting keywords
  
  // SPECIFIC formatting requests
  if (/\bformat\b/i.test(cmdLower)) score += 0.4;
  if (/\b(currency|percent|decimal)\b/i.test(cmdLower)) score += 0.5;
  if (/\b(bold|italic|underline)\b/i.test(cmdLower)) score += 0.4;
  if (/\b(border|alignment|align)\b/i.test(cmdLower)) score += 0.4;
  if (/\b(background|bgcolor|color)\b/i.test(cmdLower)) score += 0.3;
  if (/\bheader/i.test(cmdLower) && /\b(style|format|bold)/i.test(cmdLower)) score += 0.3;
  
  return Math.min(score, 1.0);
}

const FORMAT_INSTRUCTIONS = `
## FORMAT Skill

For formatting requests, return outputMode: "sheet" with sheetAction: "format".

### Schema
{
  "outputMode": "sheet",
  "sheetAction": "format",
  "sheetConfig": {
    "formatType": "currency|percent|number|date|text",
    "range": "[derive from context - see GOLDEN RULE 1]",
    "options": {
      "decimals": 2, "locale": "USD|EUR|GBP", "pattern": "yyyy-mm-dd",
      "bold": true, "italic": true, "backgroundColor": "#003366", "textColor": "#FFFFFF",
      "alignment": "left|center|right", "borders": true
    }
  }
}

### Range Targeting (from context)
- "format headers" → use explicitRowInfo.headerRange
- "format data" / "format column X" → derive from explicitRowInfo.dataStartRow to dataEndRow
- "format entire table" → use explicitRowInfo.fullRangeIncludingHeader

### Vague Requests ("professional", "nice")
→ Return outputMode: "chat" with suggestedActions instead
→ Professional formatting needs multiple separate steps

### Key Rules
1. Header styling (dark background) → ONLY headerRange, never entire table
2. Data formatting (currency, etc.) → ONLY dataRange rows
3. Combine multiple options in one request: { borders: true, alignment: "right" }
`;

const FORMAT_EXAMPLES: SkillExample[] = [
  {
    command: "Format column C as currency",
    response: {
      outputMode: "sheet",
      sheetAction: "format",
      sheetConfig: {
        formatType: "currency",
        range: "C4:C11",
        options: { decimals: 2 }
      },
      summary: "Format as currency",
      clarification: "Applying currency format to column C."
    }
  },
  {
    command: "Make headers bold with dark blue background",
    response: {
      outputMode: "sheet",
      sheetAction: "format",
      sheetConfig: {
        formatType: "text",
        range: "B3:H3",
        options: { bold: true, backgroundColor: "#003366", textColor: "#FFFFFF", alignment: "center" }
      },
      summary: "Style headers",
      clarification: "Applying bold, blue background, white text to header row."
    }
  },
  {
    command: "Add borders and right-align numbers",
    response: {
      outputMode: "sheet",
      sheetAction: "format",
      sheetConfig: {
        formatType: "text",
        range: "B3:H11",
        options: { borders: true, alignment: "right" }
      },
      summary: "Add borders and alignment",
      clarification: "Adding borders and right alignment to the data range."
    }
  }
];

export const formatSkill: GoogleSheetSkill = {
  id: 'format',
  name: 'Data Formatting',
  version: '1.0.0',
  description: 'Format numbers, dates, and apply text styling',
  
  triggerPatterns: FORMAT_PATTERNS,
  intentScore: calculateIntentScore,
  
  instructions: FORMAT_INSTRUCTIONS,
  examples: FORMAT_EXAMPLES,
  
  schema: {
    outputMode: 'sheet',
    sheetAction: 'format',
    requiredFields: ['formatType', 'range'],
    optionalFields: ['options']
  },
  
  tokenCost: 500,
  outputMode: 'sheet',
  sheetAction: 'format',
  priority: 8,
  composable: true,
};

export default formatSkill;
