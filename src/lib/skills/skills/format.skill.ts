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
    "range": "B3:H3",  // Use explicitRowInfo for headers!
    "options": {
      // Number options
      "decimals": 2,
      "locale": "USD|EUR|GBP",
      "pattern": "yyyy-mm-dd",
      
      // Style options
      "bold": true,
      "italic": true,
      "underline": true,
      "backgroundColor": "#003366",
      "textColor": "#FFFFFF",
      "fontSize": 12,
      "fontFamily": "Arial",
      "alignment": "left|center|right",
      "verticalAlign": "top|middle|bottom",
      "borders": true,
      "wrap": true
    }
  },
  "summary": "Format [range] as [type]",
  "clarification": "Applying [format] to [range]."
}

### Critical Rules
⚠️ Use explicitRowInfo for accurate range targeting:
- "format headers" → Use explicitRowInfo.headerRange (e.g., "B3:H3")
- "format data" → Use explicitRowInfo.dataRange (e.g., "B4:H11")
- Headers and data ranges are different!

### Format Types
- currency: $#,##0.00 (supports USD, EUR, GBP, JPY, etc.)
- percent: 0.00%
- number: #,##0.00
- date: yyyy-mm-dd (or custom pattern)
- text: Plain text with style options

### Combining Multiple Options
You can combine formatting in one request:
- "Add borders and right-align" → { borders: true, alignment: "right" }
- "Bold headers with blue background" → { bold: true, backgroundColor: "#003366" }
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
