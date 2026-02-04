/**
 * Formula Skill - FORMULA FIRST APPROACH
 * 
 * Handles ANY request that can be solved with native Google Sheets formulas:
 * - Translation (GOOGLETRANSLATE)
 * - Text extraction (REGEXEXTRACT)
 * - Case conversion (UPPER, LOWER, PROPER)
 * - Basic math operations (+, -, *, /)
 * - Calculated columns (IF, conditional logic)
 * - Aggregations (SUM, AVERAGE, COUNT, etc.)
 * 
 * FORMULA FIRST: Prefer native formulas over AI processing because:
 * - FREE (no AI cost)
 * - Instant (no processing time)
 * - Auto-updates when data changes
 * 
 * @version 1.2.0 - Formula First with Calculated Columns
 */

import { GoogleSheetSkill, SkillExample } from '../types';

/**
 * Capabilities for unified intent classifier
 */
const FORMULA_CAPABILITIES = [
  // Text transformations
  'translate', 'translation', 'googletranslate',
  'extract', 'regex', 'pattern', 'regexextract',
  'uppercase', 'lowercase', 'proper-case', 'capitalize',
  'concatenate', 'concat', 'join', 'combine-text',
  'trim', 'split', 'text-operation',
  
  // Calculated columns
  'add-column', 'new-column', 'calculate', 'calculated-column',
  'bonus', 'commission', 'percentage', 'percent',
  'if-then', 'conditional', 'based-on', 'when',
  
  // Math operations
  'sum', 'average', 'count', 'max', 'min', 'aggregation',
  'multiply', 'divide', 'subtract', 'difference',
  'variance', 'margin', 'profit', 'total'
];

const FORMULA_INSTRUCTIONS = `
## FORMULA Skill - FORMULA FIRST APPROACH

ALWAYS prefer native Google Sheets formulas over AI processing because they are:
- ✅ FREE (no AI cost)
- ✅ Instant (no processing time)  
- ✅ Auto-updates when data changes

### Schema
{
  "outputMode": "formula",
  "isMultiStep": false,
  "isCommand": true,
  "steps": [{
    "action": "formula",
    "description": "[What the formula calculates - used as column header]",
    "prompt": "=[FORMULA using {{ROW}} placeholder]",
    "outputFormat": "formula"
  }],
  "summary": "[Brief description]",
  "clarification": "Using native formula.\\n✅ FREE ✅ Instant ✅ Auto-updates"
}

### Key Rules
- Use {{ROW}} placeholder for row number (will be replaced: 2, 3, 4...)
- The "description" becomes the column header
- Derive column letters from data context
- Escape quotes in JSON: use \\" not "

### Common Formula Patterns

**Text Operations:**
- GOOGLETRANSLATE(B{{ROW}}, "auto", "es") - translate to Spanish
- UPPER(B{{ROW}}), LOWER(B{{ROW}}), PROPER(B{{ROW}}) - case conversion
- REGEXEXTRACT(B{{ROW}}, "@(.*)") - extract email domain
- TRIM(B{{ROW}}) - remove whitespace

**Calculated Columns (IMPORTANT!):**
- =IF(D{{ROW}}>E{{ROW}}, D{{ROW}}*0.05, 0) - Bonus: 5% if beat target
- =C{{ROW}}*0.1 - Commission: 10% of sales
- =C{{ROW}}-D{{ROW}} - Variance: actual minus budget
- =IF(C{{ROW}}>100000, "Good", "Needs Improvement") - Performance status
- =(D{{ROW}}-C{{ROW}})/C{{ROW}} - Growth percentage

**Aggregations:**
- =SUM(C:C) - sum entire column
- =AVERAGE(C2:C100) - average of range
- =COUNTIF(F:F, "Active") - count matching values

### Example: Add Bonus Column
User: "Add a column called Bonus that calculates 5% of Q2 if they beat target"
{
  "outputMode": "formula",
  "steps": [{
    "action": "formula",
    "description": "Bonus",
    "prompt": "=IF(D{{ROW}}>E{{ROW}}, D{{ROW}}*0.05, 0)",
    "outputFormat": "formula"
  }],
  "summary": "Add conditional bonus calculation",
  "clarification": "Adding Bonus column: 5% of Q2 if Q2 > Target, otherwise 0.\\n\\n✅ FREE ✅ Instant ✅ Auto-updates"
}
`;

// Minimal seed examples - database will provide better examples over time
const FORMULA_EXAMPLES: SkillExample[] = [];

export const formulaSkill: GoogleSheetSkill = {
  id: 'formula',
  name: 'Native Formulas',
  version: '1.1.0',
  description: 'Apply native Google Sheets formulas for text/math operations',
  
  // Semantic capabilities for unified intent classifier
  capabilities: FORMULA_CAPABILITIES,
  
  instructions: FORMULA_INSTRUCTIONS,
  examples: FORMULA_EXAMPLES,
  
  schema: {
    outputMode: 'formula',
    requiredFields: ['steps'],
    optionalFields: ['summary', 'clarification']
  },
  
  tokenCost: 250,
  outputMode: 'formula',
  priority: 9,  // High priority - prefer formulas when possible (FREE!)
  composable: false,
};

export default formulaSkill;
