/**
 * Conditional Format Skill
 * 
 * Handles conditional formatting/highlighting requests:
 * - Color coding based on values
 * - Highlighting thresholds
 * - Rule-based formatting
 * 
 * @version 1.0.0
 */

import { GoogleSheetSkill, SkillExample, DataContext } from '../types';

const CONDITIONAL_FORMAT_PATTERNS: RegExp[] = [
  /\b(highlight|color\s*code|colour\s*code)\b/i,
  /\b(conditional|conditionally)\s*(format|formatting)?\b/i,
  /\b(red|green|yellow)\s+(if|when|for)\b/i,
  /\b(negative|positive)\s+(values?)?\s*(red|green)?\b/i,
  /\b(above|below|greater|less)\s+than?\s*\d+/i,
  /\bmark\s+(cells?|values?)\s+(that|where|if)/i,
];

function calculateIntentScore(command: string, context?: DataContext): number {
  const cmdLower = command.toLowerCase();
  let score = 0;
  
  if (/\bhighlight\b/i.test(cmdLower)) score += 0.5;
  if (/\bconditional/i.test(cmdLower)) score += 0.5;
  if (/\b(red|green|yellow)\s+(if|when|for)/i.test(cmdLower)) score += 0.5;
  if (/\b(negative|positive)\b/i.test(cmdLower)) score += 0.4;
  if (/\b(above|below|greater|less)\s+than/i.test(cmdLower)) score += 0.4;
  if (/\bcolor.*(based|depending)/i.test(cmdLower)) score += 0.4;
  
  return Math.min(score, 1.0);
}

const CONDITIONAL_FORMAT_INSTRUCTIONS = `
## CONDITIONAL FORMAT Skill

For highlighting/color-coding requests, return outputMode: "sheet" with sheetAction: "conditionalFormat".

### Schema
{
  "outputMode": "sheet",
  "sheetAction": "conditionalFormat",
  "sheetConfig": {
    "range": "C2:C100",
    "rules": [
      {
        "condition": "greaterThan|lessThan|equals|contains|between|negative|positive|isEmpty",
        "value": 100,
        "min": 50,  // For 'between'
        "max": 150, // For 'between'
        "format": {
          "backgroundColor": "#90EE90",
          "textColor": "#000000",
          "bold": true
        }
      }
    ]
  },
  "summary": "Highlight [condition] values",
  "clarification": "Adding conditional formatting to [describe]."
}

### Supported Conditions
- greaterThan, gt: Value > threshold
- lessThan, lt: Value < threshold
- greaterThanOrEqual, gte: Value >= threshold
- lessThanOrEqual, lte: Value <= threshold
- equals, eq: Exact match
- contains: Text contains substring
- between: Value in range (use min/max)
- negative: Value < 0
- positive: Value > 0
- isEmpty, isNotEmpty: Cell empty/not empty

### Common Color Codes
- Red (negative/bad): #FFB6C1 (light), #FF0000 (bold)
- Green (positive/good): #90EE90 (light), #00FF00 (bold)
- Yellow (warning): #FFFF00
- Blue (info): #ADD8E6

### Multiple Rules
You can apply multiple rules to the same range - they stack in order.
`;

const CONDITIONAL_FORMAT_EXAMPLES: SkillExample[] = [
  {
    command: "Highlight negative values in red",
    response: {
      outputMode: "sheet",
      sheetAction: "conditionalFormat",
      sheetConfig: {
        range: "C4:C11",
        rules: [
          { condition: "negative", format: { backgroundColor: "#FFB6C1", bold: true } }
        ]
      },
      summary: "Highlight negative values",
      clarification: "Adding red highlighting to negative values."
    }
  },
  {
    command: "Make values over 1000 green",
    response: {
      outputMode: "sheet",
      sheetAction: "conditionalFormat",
      sheetConfig: {
        range: "D4:D11",
        rules: [
          { condition: "greaterThan", value: 1000, format: { backgroundColor: "#90EE90" } }
        ]
      },
      summary: "Highlight high values",
      clarification: "Highlighting values greater than 1000 in green."
    }
  },
  {
    command: "Color code status - green for Complete, red for Pending",
    response: {
      outputMode: "sheet",
      sheetAction: "conditionalFormat",
      sheetConfig: {
        range: "E4:E11",
        rules: [
          { condition: "equals", value: "Complete", format: { backgroundColor: "#90EE90" } },
          { condition: "equals", value: "Pending", format: { backgroundColor: "#FFB6C1" } }
        ]
      },
      summary: "Color code status column",
      clarification: "Adding color coding based on status values."
    }
  }
];

export const conditionalFormatSkill: GoogleSheetSkill = {
  id: 'conditionalFormat',
  name: 'Conditional Formatting',
  version: '1.0.0',
  description: 'Highlight cells based on values or conditions',
  
  triggerPatterns: CONDITIONAL_FORMAT_PATTERNS,
  intentScore: calculateIntentScore,
  
  instructions: CONDITIONAL_FORMAT_INSTRUCTIONS,
  examples: CONDITIONAL_FORMAT_EXAMPLES,
  
  schema: {
    outputMode: 'sheet',
    sheetAction: 'conditionalFormat',
    requiredFields: ['range', 'rules'],
    optionalFields: []
  },
  
  tokenCost: 350,
  outputMode: 'sheet',
  sheetAction: 'conditionalFormat',
  priority: 8,
  composable: true,
};

export default conditionalFormatSkill;
