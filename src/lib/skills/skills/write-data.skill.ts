/**
 * Write Data Skill
 * 
 * Handles requests to write/paste table data:
 * - Parse pasted markdown tables
 * - Parse CSV/TSV data
 * - Write structured data to sheet
 * 
 * @version 1.0.0
 */

import { GoogleSheetSkill, SkillExample, DataContext } from '../types';

const WRITE_DATA_PATTERNS: RegExp[] = [
  /\b(write|paste|insert|put|add)\s+(this\s+)?(data|table|into)\b/i,
  /\bcreate\s+(a\s+)?table\s+(from|based|with)\b/i,
  /\|.*\|.*\|/,  // Markdown table pattern
  /\bhelp\s+(me\s+)?(paste|create|write|insert)\b/i,
  /\bhere\s*(is|are)\s+(the\s+)?(data|table)\b/i,
  /\b(insert|paste|write)\s+.*\s*(data|table|:)\s*\|/i,  // "insert this data: |..."
  /\bput\s+(this|the)\s+(data|table|into)\b/i,
];

function calculateIntentScore(command: string, context?: DataContext): number {
  const cmdLower = command.toLowerCase();
  let score = 0;
  
  // Check for markdown table pattern (pipes)
  if (/\|.*\|.*\|/.test(command)) score += 0.7;
  
  // Check for write/paste keywords with data
  if (/\b(write|paste|insert)\s+(this\s+)?(data|table)/i.test(cmdLower)) score += 0.6;
  
  // Create table from data
  if (/\bcreate\s+(a\s+)?table\s+(from|based|with)/i.test(cmdLower)) score += 0.5;
  
  // Help me paste/create
  if (/\bhelp\s+me\s+(paste|create|write)/i.test(cmdLower)) score += 0.4;
  
  // Contains structured data indicators
  if (/\bhere\s*(is|are)\s+(the\s+)?(data|table)/i.test(cmdLower)) score += 0.3;
  
  return Math.min(score, 1.0);
}

const WRITE_DATA_INSTRUCTIONS = `
## WRITE DATA Skill

When user pastes table data in their command, parse it and write to sheet.

### Schema
{
  "outputMode": "sheet",
  "sheetAction": "writeData",
  "sheetConfig": {
    "data": [["Header1", "Header2"], ["Value1", "Value2"]],
    "startCell": "[user's location or 'A1']"
  }
}

### Key Rules
- Parse the ACTUAL data from user's command into 2D array
- First row = headers
- startCell: Use user's specified location, or "A1" if not specified
- Handle empty cells as ""
`;

const WRITE_DATA_EXAMPLES: SkillExample[] = [
  {
    command: "Create a table from this: | Task | Assignee | Status |\n| Design | Alice | Done |\n| Review | Bob | Pending |",
    response: {
      outputMode: "sheet",
      sheetAction: "writeData",
      sheetConfig: {
        data: [
          ["Task", "Assignee", "Status"],
          ["Design", "Alice", "Done"],
          ["Review", "Bob", "Pending"]
        ],
        startCell: "A1"
      },
      summary: "Write task table to sheet",
      clarification: "Parsed your table and writing 3 columns x 3 rows starting at A1."
    }
  },
  {
    command: "Paste this in B5: Name, Age, City\nJohn, 30, NYC\nJane, 25, LA",
    response: {
      outputMode: "sheet",
      sheetAction: "writeData",
      sheetConfig: {
        data: [
          ["Name", "Age", "City"],
          ["John", "30", "NYC"],
          ["Jane", "25", "LA"]
        ],
        startCell: "B5"
      },
      summary: "Write data starting at B5",
      clarification: "Parsed your data and writing 3 columns x 3 rows starting at B5."
    }
  }
];

export const writeDataSkill: GoogleSheetSkill = {
  id: 'writeData',
  name: 'Write Table Data',
  version: '1.0.0',
  description: 'Parse and write pasted table data to the sheet',
  
  triggerPatterns: WRITE_DATA_PATTERNS,
  intentScore: calculateIntentScore,
  
  instructions: WRITE_DATA_INSTRUCTIONS,
  examples: WRITE_DATA_EXAMPLES,
  
  schema: {
    outputMode: 'sheet',
    sheetAction: 'writeData',
    requiredFields: ['data'],
    optionalFields: ['startCell', 'range']
  },
  
  tokenCost: 300,
  outputMode: 'sheet',
  sheetAction: 'writeData',
  priority: 9,  // High priority when table data detected
  composable: false,
  conflicts: ['chart'],  // Can't write and chart at same time
};

export default writeDataSkill;
