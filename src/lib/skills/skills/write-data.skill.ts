/**
 * Write Data Skill
 * 
 * Handles requests to write/paste table data:
 * - Parse pasted markdown tables
 * - Parse CSV/TSV data
 * - Write structured data to sheet
 * 
 * @version 1.1.0 - Unified Intent
 */

import { GoogleSheetSkill, SkillExample } from '../types';

/**
 * Capabilities for unified intent classifier
 */
const WRITE_DATA_CAPABILITIES = [
  'write-data', 'paste-data', 'insert-data', 'put-data',
  'markdown-table', 'csv-data', 'tsv-data',
  'create-table-from-data', 'help-paste', 'structured-data'
];

const WRITE_DATA_INSTRUCTIONS = `
## WRITE DATA Skill

When user pastes table data in their command, parse it and write to sheet.

### CRITICAL: Parse User's Pasted Data
If the user's command contains data (CSV, comma-separated, pipe-separated, or plain text rows),
you MUST parse that data into a 2D array. Do NOT reference existing sheet data ranges.

Example user command: "create table for this data: Name,Age,City\\nJohn,30,NYC\\nJane,25,LA"
Correct response: Parse "Name,Age,City\\nJohn,30,NYC\\nJane,25,LA" into the data array.

### Schema for NEW Data (Parse from User's Command)
{
  "outputMode": "sheet",
  "sheetAction": "writeData",
  "sheetConfig": {
    "data": [["Header1", "Header2"], ["Value1", "Value2"]],
    "startCell": "[user's location or 'A1']"
  }
}

### Schema for Copying Existing Data to New Sheet
Only use this when user explicitly asks to COPY/MOVE existing sheet data to a new sheet:
{
  "outputMode": "sheet",
  "sheetAction": "writeData",
  "sheetConfig": {
    "dataRange": "A1:G51",
    "newSheet": "New Sheet Name",
    "includeHeaders": true
  }
}

### Key Rules
- Parse the ACTUAL data from user's command into 2D array
- First row = headers
- startCell: Use user's specified location, or "A1" if not specified
- Handle empty cells as ""
- NEVER confuse user's pasted data with existing sheet context
- If user pastes data in their message, ALWAYS parse it into the "data" array
`;

// Minimal seed examples - database will provide better examples over time
const WRITE_DATA_EXAMPLES: SkillExample[] = [];

export const writeDataSkill: GoogleSheetSkill = {
  id: 'writeData',
  name: 'Write Table Data',
  version: '1.1.0',
  description: 'Parse and write pasted table data to the sheet',
  
  // Semantic capabilities for unified intent classifier
  capabilities: WRITE_DATA_CAPABILITIES,
  
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
