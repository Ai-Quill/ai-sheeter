/**
 * Filter Skill
 * 
 * Handles filtering requests:
 * - Show/hide rows based on criteria
 * - Filter by value, condition, or text
 * 
 * @version 1.0.0
 */

import { GoogleSheetSkill, SkillExample, DataContext } from '../types';

const FILTER_PATTERNS: RegExp[] = [
  /\b(filter|filtering)\b/i,
  /\bshow\s+(only|just)\b/i,
  /\bhide\s+(rows?|data)\b/i,
  /\b(where|with)\s+\w+\s*(=|is|equals|contains)/i,
  /\bonly\s+(show|display)\b/i,
];

function calculateIntentScore(command: string, context?: DataContext): number {
  const cmdLower = command.toLowerCase();
  let score = 0;
  
  if (/\bfilter\b/i.test(cmdLower)) score += 0.6;
  if (/\bshow\s+(only|just)\b/i.test(cmdLower)) score += 0.5;
  if (/\bhide\s+(rows?|data)\b/i.test(cmdLower)) score += 0.5;
  if (/\bwhere\s+\w+\s*(=|is|equals)/i.test(cmdLower)) score += 0.4;
  
  return Math.min(score, 1.0);
}

const FILTER_INSTRUCTIONS = `
## FILTER Skill

For filtering requests, return outputMode: "sheet" with sheetAction: "filter".

### Schema
{
  "outputMode": "sheet",
  "sheetAction": "filter",
  "sheetConfig": {
    "dataRange": "A1:E100",
    "criteria": [
      {
        "column": "B",
        "condition": "equals|contains|greaterThan|lessThan|between|isEmpty|isNotEmpty",
        "value": "Active",
        "min": 50,   // For 'between'
        "max": 100   // For 'between'
      }
    ]
  },
  "summary": "Filter to show [criteria]",
  "clarification": "Applying filter to show only [description]."
}

### Supported Conditions
- equals, eq: Exact match
- notEquals, neq: Not equal
- contains: Text contains
- notContains: Text doesn't contain
- startsWith, endsWith: Text patterns
- greaterThan, gt: Value > threshold
- lessThan, lt: Value < threshold
- between: Value in range
- isEmpty, isNotEmpty: Cell state

### Notes
- Filter replaces any existing filter on the sheet
- Multiple criteria are AND-ed together
- Column can be letter ("B") or index (2)
`;

const FILTER_EXAMPLES: SkillExample[] = [
  {
    command: "Filter to show only Active items",
    response: {
      outputMode: "sheet",
      sheetAction: "filter",
      sheetConfig: {
        dataRange: "A1:E100",
        criteria: [
          { column: "B", condition: "equals", value: "Active" }
        ]
      },
      summary: "Filter active items",
      clarification: "Applying filter to show only Active items."
    }
  },
  {
    command: "Show rows where revenue is greater than 10000",
    response: {
      outputMode: "sheet",
      sheetAction: "filter",
      sheetConfig: {
        dataRange: "A1:E100",
        criteria: [
          { column: "C", condition: "greaterThan", value: 10000 }
        ]
      },
      summary: "Filter high revenue",
      clarification: "Filtering to show rows with revenue > 10000."
    }
  }
];

export const filterSkill: GoogleSheetSkill = {
  id: 'filter',
  name: 'Data Filtering',
  version: '1.0.0',
  description: 'Filter data to show/hide rows based on criteria',
  
  triggerPatterns: FILTER_PATTERNS,
  intentScore: calculateIntentScore,
  
  instructions: FILTER_INSTRUCTIONS,
  examples: FILTER_EXAMPLES,
  
  schema: {
    outputMode: 'sheet',
    sheetAction: 'filter',
    requiredFields: ['dataRange', 'criteria'],
    optionalFields: []
  },
  
  tokenCost: 250,
  outputMode: 'sheet',
  sheetAction: 'filter',
  priority: 7,
  composable: false,
};

export default filterSkill;
