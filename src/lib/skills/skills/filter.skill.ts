/**
 * Filter Skill - EXPERT MODE
 * 
 * You are a Google Sheets filtering expert. This skill provides ALL 24
 * filter criteria types including date filters, array filters, and
 * custom formula filters.
 * 
 * @version 2.0.0 - Expert Mode
 */

import { GoogleSheetSkill, SkillExample, DataContext } from '../types';

const FILTER_PATTERNS: RegExp[] = [
  /\b(filter|filtering)\b/i,
  /\bshow\s+(only|just)\b/i,
  /\bhide\s+(rows?|data|values?)\b/i,
  /\b(where|with)\s+\w+\s*(=|is|equals|contains)/i,
  /\bonly\s+(show|display)\b/i,
  /\b(before|after|between)\s+\d{4}/i,
  /\b(exclude|include)\s+(only)?\b/i,
];

function calculateIntentScore(command: string, context?: DataContext): number {
  const cmdLower = command.toLowerCase();
  let score = 0;
  
  if (/\bfilter\b/i.test(cmdLower)) score += 0.6;
  if (/\bshow\s+(only|just)\b/i.test(cmdLower)) score += 0.5;
  if (/\bhide\s+(rows?|data)\b/i.test(cmdLower)) score += 0.5;
  if (/\bwhere\s+\w+\s*(=|is|equals)/i.test(cmdLower)) score += 0.4;
  if (/\b(before|after)\s+\d{4}/i.test(cmdLower)) score += 0.4;
  if (/\b(exclude|include)\b/i.test(cmdLower)) score += 0.3;
  
  return Math.min(score, 1.0);
}

const FILTER_INSTRUCTIONS = `
## FILTER Skill - EXPERT MODE

You are a Google Sheets filtering expert. Apply precise data filtering
using ANY of the 24 filter criteria types below.

### YOUR FULL CAPABILITIES

**Text Conditions:**
- equals / eq: Exact text match
- notEquals / neq: Does not match
- contains: Contains substring
- notContains / doesNotContain: Does not contain
- startsWith: Text starts with
- endsWith: Text ends with

**Number Conditions:**
- greaterThan / gt: Value > threshold
- greaterThanOrEqual / gte: Value >= threshold
- lessThan / lt: Value < threshold
- lessThanOrEqual / lte: Value <= threshold
- between: Value in range (use min/max)

**Cell State:**
- isEmpty / empty / blank: Cell is empty
- isNotEmpty / notEmpty / notBlank: Cell has content

**Date Conditions (NEW):**
- dateAfter: After specific date
  → { column: "D", condition: "dateAfter", value: "2024-01-01" }
- dateBefore: Before specific date
  → { column: "D", condition: "dateBefore", value: "2024-12-31" }
- dateEqual: On specific date
  → { column: "D", condition: "dateEqual", value: "2024-06-15" }
- dateNotEqual (NEW): Not on specific date
  → { column: "D", condition: "dateNotEqual", value: "2024-01-01" }

**Array-Based Filters (NEW):**
- equalsAny / inList: Match any value in list
  → { column: "B", condition: "equalsAny", value: ["Active", "Pending"] }
- notEqualsAny / notInList (NEW): Exclude multiple values
  → { column: "B", condition: "notEqualsAny", value: ["Cancelled", "Deleted"] }

**Value Visibility Control (NEW):**
- hideValues / hide: Hide specific values
  → { column: "C", condition: "hideValues", value: ["N/A", "Unknown"] }
- showOnlyValues / showOnly: Show only specific values
  → { column: "C", condition: "showOnlyValues", value: ["Complete", "Approved"] }

**Custom Formula (NEW):**
- formula / customFormula: Custom filter formula
  → { column: "A", condition: "formula", value: "=LEN(A1)>10" }

### Schema
{
  "outputMode": "sheet",
  "sheetAction": "filter",
  "sheetConfig": {
    "dataRange": "[use fullRangeIncludingHeader from context]",
    "criteria": [
      {
        "column": "[column letter]",
        "condition": "[condition type]",
        "value": "[filter value or array]",
        "min": 0, "max": 100  // for between
      }
    ]
  }
}

### EXPERT DECISIONS (analyze the request):
1. **"Show only Active"** → equals condition
2. **"Hide completed items"** → notEquals or hideValues
3. **"Filter this year"** → dateAfter with Jan 1
4. **"Show orders over $100"** → greaterThan condition
5. **"Exclude cancelled and deleted"** → notEqualsAny with array
6. **"Last 30 days"** → dateAfter with calculated date

### Key Rules
1. dataRange MUST include headers (for filter dropdowns)
2. Use column letter from context headers
3. Multiple criteria are AND-ed together
4. Date values should be in "YYYY-MM-DD" format
`;

const FILTER_EXAMPLES: SkillExample[] = [];

export const filterSkill: GoogleSheetSkill = {
  id: 'filter',
  name: 'Data Filtering',
  version: '2.0.0',
  description: 'Expert filtering: 24 criteria types, date filters, array filters, formula filters',
  
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
  
  tokenCost: 300,
  outputMode: 'sheet',
  sheetAction: 'filter',
  priority: 7,
  composable: false,
};

export default filterSkill;
