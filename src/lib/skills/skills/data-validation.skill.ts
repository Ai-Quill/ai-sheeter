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

⚠️ CRITICAL: Checkboxes are DATA VALIDATION, NOT formatting!
- "Add checkboxes" → sheetAction: "dataValidation", validationType: "checkbox"
- DO NOT use sheetAction: "format" for checkboxes!
- DO NOT nest validation inside options - use validationType directly in sheetConfig

### Schema
{
  "outputMode": "sheet",
  "sheetAction": "dataValidation",
  "sheetConfig": {
    "validationType": "dropdown|checkbox|number|date|email|url|custom",
    "range": "D2:D100",
    "values": ["Option 1", "Option 2"]  // For dropdown only
  },
  "summary": "Add [type] validation",
  "clarification": "Creating [type] validation for [range]."
}

### Validation Types
- **dropdown** or **list**: Select from predefined values → use "values" array
- **checkbox**: True/false checkboxes → validationType: "checkbox" (NO values needed)
- **number**: Numeric constraints → use "min" and "max" directly in sheetConfig
- **date**: Date constraints → use "after" and "before"  
- **email**: Valid email format
- **url**: Valid URL format

### CHECKBOX EXAMPLES - Use EXACTLY this format:
For "Add checkboxes to column F":
{
  "outputMode": "sheet",
  "sheetAction": "dataValidation",
  "sheetConfig": {
    "validationType": "checkbox",
    "range": "F2:F100"
  }
}

⚠️ WRONG (do NOT do this):
{
  "sheetAction": "format",
  "sheetConfig": { "options": { "validation": { "type": "checkbox" } } }
}

### IMPORTANT for Number Validation
When restricting to number ranges, use validationType: "number" (NOT "numberRange")
Put min/max directly in sheetConfig, not nested in options:

CORRECT:
{
  "sheetConfig": {
    "validationType": "number",
    "range": "G2:G100",
    "min": 1000,
    "max": 100000
  }
}
`;

const DATA_VALIDATION_EXAMPLES: SkillExample[] = [
  {
    command: "Add dropdown with High, Medium, Low options",
    response: {
      outputMode: "sheet",
      sheetAction: "dataValidation",
      sheetConfig: {
        validationType: "dropdown",
        range: "D2:D100",
        values: ["High", "Medium", "Low"]
      },
      summary: "Add priority dropdown",
      clarification: "Creating dropdown with High, Medium, Low options."
    }
  },
  {
    command: "Add checkboxes to column E",
    response: {
      outputMode: "sheet",
      sheetAction: "dataValidation",
      sheetConfig: {
        validationType: "checkbox",
        range: "E2:E100"
      },
      summary: "Add checkboxes",
      clarification: "Adding checkboxes to column E."
    }
  },
  {
    command: "Restrict column F to numbers between 1 and 100",
    response: {
      outputMode: "sheet",
      sheetAction: "dataValidation",
      sheetConfig: {
        validationType: "number",
        range: "F2:F100",
        min: 1,
        max: 100
      },
      summary: "Add number validation",
      clarification: "Restricting values to numbers between 1 and 100."
    }
  },
  {
    command: "Only allow numbers between 1000 and 100000 on column G",
    response: {
      outputMode: "sheet",
      sheetAction: "dataValidation",
      sheetConfig: {
        validationType: "number",
        range: "G2:G100",
        min: 1000,
        max: 100000
      },
      summary: "Add number range validation",
      clarification: "Restricting column G to numbers between 1000 and 100000."
    }
  }
];

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
