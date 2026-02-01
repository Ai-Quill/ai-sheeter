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
  // Pattern for "Highlight [specific value] with [color]" - this is conditional, not simple format
  /\bhighlight\s+['"]?[\w\s]+['"]?\s+(values?)?\s*(in|with)/i,
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
  
  // CRITICAL: "Highlight [value] values" patterns = conditional formatting (not simple format)
  // e.g., "Highlight 'Active' values", "Highlight Active in column F"
  if (/\bhighlight\s+['"]?[\w]+['"]?\s+(values?|in|with)/i.test(cmdLower)) score += 0.6;
  // Also boost for "cells containing" or "where value is"
  if (/\b(containing|equals?|where)\b/i.test(cmdLower)) score += 0.3;
  
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
- greaterThan, lessThan, between (use min/max)
- equals: exact match (e.g., "Active", "Complete", "Yes")
- contains: partial match (e.g., contains "error")
- negative (< 0), positive (> 0)
- max/highest, min/lowest (column max/min)
- isEmpty, isNotEmpty

### IMPORTANT: Highlight [value] = Conditional Format!
When user says "Highlight Active values" or "Highlight cells with Active":
- This is CONDITIONAL formatting (not simple format)
- Use condition: "equals", value: "Active"
- This highlights ONLY cells that match, not the entire range

### Colors (use user's color or these defaults)
- Red: #FFB6C1 (light), #FF0000 (bold)
- Green: #90EE90 (light)
- Yellow: #FFFF00

### Range from Context
- "highlight column C" → derive C[dataStartRow]:C[dataEndRow] from context
- Multiple rules can be applied to same range
`;

// Minimal seed examples - database will provide better examples over time
const CONDITIONAL_FORMAT_EXAMPLES: SkillExample[] = [];

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
