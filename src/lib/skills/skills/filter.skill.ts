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
    "dataRange": "[use explicitRowInfo.fullRangeIncludingHeader from context]",
    "criteria": [
      {
        "column": "[column letter from context]",
        "condition": "equals|contains|greaterThan|lessThan|between",
        "value": <user's filter value>
      }
    ]
  }
}

### Conditions
- equals, notEquals, contains, notContains
- greaterThan, lessThan, between (use min/max)
- isEmpty, isNotEmpty

### Key Rules
- dataRange should include headers (for filter dropdowns)
- Use column letter from context headers
- Multiple criteria are AND-ed together
`;

// Minimal seed examples - database will provide better examples over time
const FILTER_EXAMPLES: SkillExample[] = [];

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
