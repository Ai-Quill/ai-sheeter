/**
 * Formula Skill
 * 
 * Handles requests that can be solved with native formulas:
 * - Translation (GOOGLETRANSLATE)
 * - Text extraction (REGEXEXTRACT)
 * - Case conversion (UPPER, LOWER, PROPER)
 * - Basic math operations
 * 
 * @version 1.0.0
 */

import { GoogleSheetSkill, SkillExample, DataContext } from '../types';

const FORMULA_PATTERNS: RegExp[] = [
  /\b(translate|translation)\b/i,
  /\b(extract|regex|pattern)\b/i,
  /\b(uppercase|lowercase|proper\s*case|capitalize)\b/i,
  /\b(sum|average|count|max|min)\s+(of|the|column)/i,
  /\b(concatenate|concat|join|combine)\s+(text|columns?|cells?)/i,
  /\btrim\b/i,
  /\bsplit\b/i,
];

function calculateIntentScore(command: string, context?: DataContext): number {
  const cmdLower = command.toLowerCase();
  let score = 0;
  
  // Translation (perfect formula use case)
  if (/\btranslate\b/i.test(cmdLower)) score += 0.7;
  
  // Text extraction
  if (/\b(extract|regex)\b/i.test(cmdLower)) score += 0.5;
  
  // Case conversion
  if (/\b(uppercase|lowercase|proper\s*case|capitalize)\b/i.test(cmdLower)) score += 0.6;
  
  // Basic aggregations
  if (/\b(sum|average|count|max|min)\s+(of|the)/i.test(cmdLower)) score += 0.4;
  
  // Text operations
  if (/\b(trim|concat|split)\b/i.test(cmdLower)) score += 0.5;
  
  return Math.min(score, 1.0);
}

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

const FORMULA_EXAMPLES: SkillExample[] = [
  {
    command: "Translate column B to Spanish",
    response: {
      outputMode: "formula",
      isMultiStep: false,
      isCommand: true,
      steps: [{
        action: "formula",
        description: "Translate to Spanish",
        prompt: "=GOOGLETRANSLATE(B{{ROW}}, \"auto\", \"es\")",
        outputFormat: "formula"
      }],
      summary: "Translate using GOOGLETRANSLATE",
      clarification: "Using native GOOGLETRANSLATE formula.\n\n✅ FREE - no AI cost\n✅ Instant\n✅ Auto-updates",
      estimatedTime: "Instant"
    }
  },
  {
    command: "Convert names to uppercase",
    response: {
      outputMode: "formula",
      isMultiStep: false,
      isCommand: true,
      steps: [{
        action: "formula",
        description: "Convert to uppercase",
        prompt: "=UPPER(B{{ROW}})",
        outputFormat: "formula"
      }],
      summary: "Convert to uppercase",
      clarification: "Using native UPPER formula.\n\n✅ FREE - no AI cost\n✅ Instant",
      estimatedTime: "Instant"
    }
  },
  {
    command: "Extract email domains from column C",
    response: {
      outputMode: "formula",
      isMultiStep: false,
      isCommand: true,
      steps: [{
        action: "formula",
        description: "Extract email domain",
        prompt: "=REGEXEXTRACT(C{{ROW}}, \"@(.*)\")",
        outputFormat: "formula"
      }],
      summary: "Extract domains with REGEXEXTRACT",
      clarification: "Using REGEXEXTRACT to get the part after @.\n\n✅ FREE - no AI cost",
      estimatedTime: "Instant"
    }
  }
];

export const formulaSkill: GoogleSheetSkill = {
  id: 'formula',
  name: 'Native Formulas',
  version: '1.0.0',
  description: 'Apply native Google Sheets formulas for text/math operations',
  
  triggerPatterns: FORMULA_PATTERNS,
  intentScore: calculateIntentScore,
  
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
