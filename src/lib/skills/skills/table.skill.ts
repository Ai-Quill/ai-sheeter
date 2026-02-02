/**
 * Table Skill - Convert ranges to native Google Sheets Tables
 * Google Sheets Tables provide automatic formatting, filters, headers, and structured data management
 * 
 * @version 1.1.0 - Unified Intent
 */

import { GoogleSheetSkill, SkillExample } from '../types';

/**
 * Capabilities for unified intent classifier
 */
const TABLE_CAPABILITIES = [
  'create-table', 'make-table', 'convert-to-table',
  'table-format', 'format-as-table',
  'professional-table', 'structured-table', 'data-table',
  'table-with-headers', 'table-with-filters', 'frozen-header'
];

const TABLE_INSTRUCTIONS = `
## TABLE Skill

Convert data to native Google Sheets Tables with auto-formatting and filters.

### Schema
{
  "outputMode": "sheet",
  "sheetAction": "createTable",
  "sheetConfig": {
    "range": "[use explicitRowInfo.fullRangeIncludingHeader from context]",
    "tableName": "[user's name or auto-generate]",
    "freezeHeader": true
  }
}

### Key Rules
- range: Derive from context (include headers)
- tableName: Use user's specified name, or omit for auto-generation
- freezeHeader: Default true

### Tables provide: Auto-formatting, filters, frozen headers, professional look
`;

// Minimal seed examples - database will provide better examples over time
const TABLE_EXAMPLES: SkillExample[] = [];

export const tableSkill: GoogleSheetSkill = {
  id: 'table',
  name: 'Table Creation',
  version: '1.1.0',
  description: 'Convert data ranges to native Google Sheets Tables with automatic formatting and filters',
  
  // Semantic capabilities for unified intent classifier
  capabilities: TABLE_CAPABILITIES,
  
  // Skill content
  instructions: TABLE_INSTRUCTIONS,
  examples: TABLE_EXAMPLES,
  
  // Schema
  schema: {
    outputMode: 'sheet',
    sheetAction: 'createTable',
    requiredFields: ['range'],
    optionalFields: ['tableName', 'freezeHeader']
  },
  
  // Metadata
  tokenCost: 250,
  outputMode: 'sheet',
  sheetAction: 'createTable',
  priority: 7,  // Lower than format but significant for explicit table requests
  composable: false,  // Table creation is a standalone action
};

export default tableSkill;
