/**
 * Formula Skill
 * 
 * Handles requests that can be solved with native formulas:
 * - Translation (GOOGLETRANSLATE)
 * - Text extraction (REGEXEXTRACT)
 * - Case conversion (UPPER, LOWER, PROPER)
 * - Basic math operations
 * 
 * @version 1.1.0 - Unified Intent
 */

import { GoogleSheetSkill, SkillExample } from '../types';

/**
 * Capabilities for unified intent classifier
 */
const FORMULA_CAPABILITIES = [
  'translate', 'translation', 'googletranslate',
  'extract', 'regex', 'pattern', 'regexextract',
  'uppercase', 'lowercase', 'proper-case', 'capitalize',
  'sum', 'average', 'count', 'max', 'min', 'aggregation',
  'concatenate', 'concat', 'join', 'combine-text',
  'trim', 'split', 'text-operation'
];

const FORMULA_INSTRUCTIONS = `
## FORMULA Skill

For mechanical transformations, return outputMode: "formula" with a native Google Sheets formula.

### Schema
{
  "outputMode": "formula",
  "isMultiStep": false,
  "isCommand": true,
  "steps": [{
    "action": "formula",
    "description": "Apply native formula",
    "prompt": "=FORMULA([column from context]{{ROW}})",
    "outputFormat": "formula"
  }],
  "summary": "Apply [formula type]",
  "clarification": "Using native formula.\\n✅ FREE ✅ Instant ✅ Auto-updates"
}

### Key Rules
- Use {{ROW}} placeholder for row number
- Derive source column from context (e.g., if user says "translate column B" → use B{{ROW}})
- Use user's target language for translation

### Common Formulas
- GOOGLETRANSLATE([col]{{ROW}}, "auto", "[target lang]")
- UPPER/LOWER/PROPER([col]{{ROW}})
- REGEXEXTRACT([col]{{ROW}}, "[pattern]")
- TRIM([col]{{ROW}})

### Benefits: FREE, Instant, Auto-updates
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
