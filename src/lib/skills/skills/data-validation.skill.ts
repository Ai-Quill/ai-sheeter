/**
 * Data Validation Skill
 * 
 * Handles data validation requests:
 * - Dropdown lists
 * - Checkboxes
 * - Number/date constraints
 * 
 * @version 1.0.0
 */

import { GoogleSheetSkill, SkillExample, DataContext } from '../types';

const DATA_VALIDATION_PATTERNS: RegExp[] = [
  /\b(dropdown|drop-down|drop\s*down)\b/i,
  /\b(checkbox|check\s*box)\b/i,
  /\b(validation|validate|restrict)\b/i,
  /\b(list\s+of\s+options?|select\s+from)\b/i,
  /\b(only\s+allow|must\s+be|should\s+be)\b/i,
  /\badd\s+(a\s+)?(dropdown|checkbox|validation)\b/i,
];

function calculateIntentScore(command: string, context?: DataContext): number {
  const cmdLower = command.toLowerCase();
  let score = 0;
  
  if (/\bdropdown\b/i.test(cmdLower)) score += 0.6;
  if (/\bcheckbox\b/i.test(cmdLower)) score += 0.6;
  if (/\bvalidation\b/i.test(cmdLower)) score += 0.5;
  if (/\b(list|options|select)\b/i.test(cmdLower)) score += 0.3;
  if (/\b(restrict|only\s+allow)\b/i.test(cmdLower)) score += 0.4;
  
  return Math.min(score, 1.0);
}

const DATA_VALIDATION_INSTRUCTIONS = `
## DATA VALIDATION Skill

For validation/dropdown/checkbox requests, return outputMode: "sheet" with sheetAction: "dataValidation".

### Schema
{
  "outputMode": "sheet",
  "sheetAction": "dataValidation",
  "sheetConfig": {
    "validationType": "dropdown|checkbox|number|date|email|url",
    "range": "[column][dataStartRow]:[column][dataEndRow]",  // From context!
    "values": ["...user's options..."],  // For dropdown
    "min": <user's min>,     // For number
    "max": <user's max>      // For number
  }
}

### Validation Types
- **dropdown**: range + values (user's exact options)
- **checkbox**: range only
- **number**: range + min + max (user's exact numbers)

### Key Rules
1. Use sheetAction: "dataValidation" (NOT "validation")
2. Put min, max, values DIRECTLY in sheetConfig (NOT nested in options/criteria)
3. Derive range from explicitRowInfo in context (see GOLDEN RULE 1)
`;

// Minimal seed examples - database will provide better examples over time
const DATA_VALIDATION_EXAMPLES: SkillExample[] = [];

export const dataValidationSkill: GoogleSheetSkill = {
  id: 'dataValidation',
  name: 'Data Validation',
  version: '1.0.0',
  description: 'Add dropdowns, checkboxes, and input validation',
  
  triggerPatterns: DATA_VALIDATION_PATTERNS,
  intentScore: calculateIntentScore,
  
  instructions: DATA_VALIDATION_INSTRUCTIONS,
  examples: DATA_VALIDATION_EXAMPLES,
  
  schema: {
    outputMode: 'sheet',
    sheetAction: 'dataValidation',
    requiredFields: ['validationType', 'range'],
    optionalFields: ['values', 'options']
  },
  
  tokenCost: 300,
  outputMode: 'sheet',
  sheetAction: 'dataValidation',
  priority: 7,
  composable: true,
};

export default dataValidationSkill;
