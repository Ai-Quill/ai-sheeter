/**
 * Data Validation Skill - EXPERT MODE
 * 
 * You are a Google Sheets data validation expert. This skill provides ALL
 * 20 validation types - analyze the data context and apply appropriate
 * validation rules to ensure data integrity.
 * 
 * @version 2.0.0 - Expert Mode
 */

import { GoogleSheetSkill, SkillExample, DataContext } from '../types';

const DATA_VALIDATION_PATTERNS: RegExp[] = [
  /\b(dropdown|drop-down|drop\s*down)\b/i,
  /\b(checkbox|check\s*box)\b/i,
  /\b(validation|validate|restrict)\b/i,
  /\b(list\s+of\s+options?|select\s+from)\b/i,
  /\b(only\s+allow|must\s+be|should\s+be)\b/i,
  /\badd\s+(a\s+)?(dropdown|checkbox|validation)\b/i,
  /\b(email|url|link)\s*(validation|only|format)?\b/i,
  /\b(between|greater|less|equal)\s+than\b/i,
];

function calculateIntentScore(command: string, context?: DataContext): number {
  const cmdLower = command.toLowerCase();
  let score = 0;
  
  if (/\bdropdown\b/i.test(cmdLower)) score += 0.6;
  if (/\bcheckbox\b/i.test(cmdLower)) score += 0.6;
  if (/\bvalidation\b/i.test(cmdLower)) score += 0.5;
  if (/\b(list|options|select)\b/i.test(cmdLower)) score += 0.3;
  if (/\b(restrict|only\s+allow)\b/i.test(cmdLower)) score += 0.4;
  if (/\b(email|url)\b/i.test(cmdLower)) score += 0.4;
  if (/\b(between|greater|less)\s+than\b/i.test(cmdLower)) score += 0.3;
  
  return Math.min(score, 1.0);
}

const DATA_VALIDATION_INSTRUCTIONS = `
## DATA VALIDATION Skill - EXPERT MODE

You are a Google Sheets data validation expert. Apply appropriate validation
to ensure data integrity using ANY of the 20 validation types below.

### YOUR FULL CAPABILITIES

**Dropdown/List Validations:**
- dropdown / list: Values from array
  → { validationType: "dropdown", values: ["Option1", "Option2", "Option3"] }
- rangeDropdown / listFromRange (NEW): Values from sheet range
  → { validationType: "rangeDropdown", sourceRange: "Sheet1!A1:A10" }

**Checkbox:**
- checkbox: Standard TRUE/FALSE checkbox
  → { validationType: "checkbox" }
- checkbox with custom values:
  → { validationType: "checkbox", checkedValue: "Yes", uncheckedValue: "No" }

**Number Validations (NEW types):**
- number: Between min and max
  → { validationType: "number", min: 0, max: 100 }
- numberEqual: Must equal specific value
  → { validationType: "numberEqual", value: 42 }
- numberNotEqual (NEW): Must NOT equal value
  → { validationType: "numberNotEqual", value: 0 }
- numberGreaterThan (NEW): Strict greater than
  → { validationType: "numberGreaterThan", value: 0 }
- numberGreaterThanOrEqual: Greater than or equal
  → { validationType: "numberGTE", value: 1 }
- numberLessThan (NEW): Strict less than
  → { validationType: "numberLessThan", value: 100 }
- numberLessThanOrEqual: Less than or equal
  → { validationType: "numberLTE", value: 99 }
- numberNotBetween (NEW): Outside a range
  → { validationType: "numberNotBetween", min: 10, max: 20 }

**Date Validations (NEW types):**
- date: Any valid date
  → { validationType: "date" }
- date with range:
  → { validationType: "date", after: "2024-01-01", before: "2024-12-31" }
- dateEqual (NEW): Specific date
  → { validationType: "dateEqual", date: "2024-06-15" }
- dateOnOrAfter (NEW): On or after (inclusive)
  → { validationType: "dateOnOrAfter", date: "2024-01-01" }
- dateOnOrBefore (NEW): On or before (inclusive)
  → { validationType: "dateOnOrBefore", date: "2024-12-31" }
- dateNotBetween (NEW): Outside date range
  → { validationType: "dateNotBetween", start: "2024-06-01", end: "2024-06-30" }

**Text Validations (NEW):**
- textContains: Must contain substring
  → { validationType: "textContains", text: "@" }
- textNotContains (NEW): Must NOT contain
  → { validationType: "textNotContains", text: "spam" }
- textEqual (NEW): Exact text match
  → { validationType: "textEqual", text: "APPROVED" }

**Special Validations:**
- email: Valid email format
  → { validationType: "email" }
- url / link: Valid URL format
  → { validationType: "url" }
- custom / formula: Custom formula validation
  → { validationType: "custom", formula: "=LEN(A1)>5" }

**Help Text (NEW):**
- helpText: Add instructional text shown on hover
  → { validationType: "dropdown", values: [...], helpText: "Select your department" }

### Schema
{
  "outputMode": "sheet",
  "sheetAction": "dataValidation",
  "sheetConfig": {
    "validationType": "[type from above]",
    "range": "[from context]",
    // Type-specific fields directly in sheetConfig:
    "values": [...],      // for dropdown
    "min": 0, "max": 100, // for number range
    "value": 42,          // for equals comparisons
    "helpText": "..."     // optional help text
  }
}

### EXPERT DECISIONS (analyze the data):
1. **Status/Category columns** → Dropdown with detected values
2. **Yes/No columns** → Checkbox
3. **Age/Quantity columns** → Number validation (0-reasonable max)
4. **Email columns** → Email validation
5. **Website columns** → URL validation
6. **Date columns** → Date validation with reasonable range

### Key Rules
1. Use sheetAction: "dataValidation" (NOT "validation")
2. Put all options DIRECTLY in sheetConfig (NOT nested)
3. Derive range from explicitRowInfo in context
`;

const DATA_VALIDATION_EXAMPLES: SkillExample[] = [];

export const dataValidationSkill: GoogleSheetSkill = {
  id: 'dataValidation',
  name: 'Data Validation',
  version: '2.0.0',
  description: 'Expert validation: 20 types including dropdown, checkbox, number, date, text, email, URL',
  
  triggerPatterns: DATA_VALIDATION_PATTERNS,
  intentScore: calculateIntentScore,
  
  instructions: DATA_VALIDATION_INSTRUCTIONS,
  examples: DATA_VALIDATION_EXAMPLES,
  
  schema: {
    outputMode: 'sheet',
    sheetAction: 'dataValidation',
    requiredFields: ['validationType', 'range'],
    optionalFields: ['values', 'min', 'max', 'value', 'sourceRange', 'helpText', 'formula']
  },
  
  tokenCost: 400,
  outputMode: 'sheet',
  sheetAction: 'dataValidation',
  priority: 7,
  composable: true,
};

export default dataValidationSkill;
