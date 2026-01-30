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
    "validationType": "dropdown|checkbox|number|date|email|url|custom",
    "range": "D2:D100",
    "values": ["Option 1", "Option 2"],  // For dropdown
    "options": {
      // Number validation
      "min": 0,
      "max": 100,
      
      // Checkbox
      "checkedValue": "Yes",
      "uncheckedValue": "No",
      
      // Date validation
      "after": "2024-01-01",
      "before": "2024-12-31",
      
      // Custom formula
      "formula": "=A1>10"
    }
  },
  "summary": "Add [type] validation",
  "clarification": "Creating [type] validation for [range]."
}

### Validation Types
- dropdown/list: Select from predefined values
- checkbox: True/false with optional custom values
- number: Numeric constraints (min, max, between)
- date: Date constraints (after, before, between)
- email: Valid email format
- url: Valid URL format
- custom: Custom formula validation
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
        options: { min: 1, max: 100 }
      },
      summary: "Add number validation",
      clarification: "Restricting values to numbers between 1 and 100."
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
