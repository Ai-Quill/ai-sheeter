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
    "range": "[derive from context - data rows only]",
    "rules": [
      {
        "condition": "greaterThan|lessThan|equals|contains|between|negative|positive|max|min",
        "value": <user's threshold>,
        "format": { "backgroundColor": "#90EE90", "bold": true }
      }
    ]
  }
}

### Conditions
- greaterThan, lessThan, equals, contains, between (use min/max)
- negative (< 0), positive (> 0)
- max/highest, min/lowest (column max/min)
- isEmpty, isNotEmpty

### Colors (use user's color or these defaults)
- Red: #FFB6C1 (light), #FF0000 (bold)
- Green: #90EE90 (light)
- Yellow: #FFFF00

### Range from Context
- "highlight column C" → derive C[dataStartRow]:C[dataEndRow] from context
- Multiple rules can be applied to same range
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
  },
  {
    command: "Highlight the highest value in each column with light green",
    response: {
      outputMode: "sheet",
      sheetAction: "conditionalFormat",
      sheetConfig: {
        range: "B3:D14",
        rules: [
          { condition: "max", format: { backgroundColor: "#90EE90" } }
        ]
      },
      summary: "Highlight maximum values",
      clarification: "Adding light green highlighting to the highest value in each column."
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
