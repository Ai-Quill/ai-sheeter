/**
 * Table Skill - Convert ranges to native Google Sheets Tables
 * Google Sheets Tables provide automatic formatting, filters, headers, and structured data management
 */

import { GoogleSheetSkill, SkillExample, DataContext } from '../types';

// Intent detection patterns
const TABLE_PATTERNS = [
  /\b(create|make|convert)\s+(a\s+)?table/i,
  /\b(table\s+format|format\s+as\s+table)/i,
  /\b(professional|structured)\s+table/i,
  /\bturn\s+(this\s+)?(into|to)\s+a?\s*table/i,
  /\b(data\s+)?table\s+with\s+(headers?|filters?)/i,
];

// Calculate confidence score for table skill
function calculateIntentScore(command: string, _context?: DataContext): number {
  const cmdLower = command.toLowerCase();
  let score = 0;
  
  // Direct table mentions
  if (/\b(create|make)\s+(a\s+)?table\b/i.test(cmdLower)) score += 0.8;
  if (/\bconvert\s+to\s+table\b/i.test(cmdLower)) score += 0.85;
  if (/\btable\s+format\b/i.test(cmdLower)) score += 0.75;
  if (/\bformat\s+as\s+table\b/i.test(cmdLower)) score += 0.8;
  
  // Structural hints
  if (/\bstructured\s+table\b/i.test(cmdLower)) score += 0.7;
  if (/\bdata\s+table\b/i.test(cmdLower)) score += 0.6;
  
  // Google Sheets Table specific features
  if (/\bwith\s+(headers?|filters?|dropdowns?)\b/i.test(cmdLower)) score += 0.3;
  if (/\bfrozen?\s+(row|header)/i.test(cmdLower)) score += 0.2;
  
  return Math.max(0, Math.min(score, 1.0));
}

const TABLE_INSTRUCTIONS = `
### Table Creation (sheetAction: "createTable")
Convert data ranges to native Google Sheets Tables. Tables provide:
- Automatic header styling with filters
- Structured data with column types
- Frozen header rows
- Professional appearance instantly

### Schema
{
  "outputMode": "sheet",
  "sheetAction": "createTable",
  "sheetConfig": {
    "range": "A1:D14",
    "tableName": "SalesData",
    "freezeHeader": true
  },
  "summary": "Convert data to table",
  "clarification": "Creating a native Google Sheets table with automatic formatting and filters."
}

### Config Options
- range: The data range to convert (required)
- tableName: Name for the table (optional, auto-generated if not provided)
- freezeHeader: Whether to freeze the header row (default: true)

### When to Use
Use createTable when user requests:
- "Create a table" / "Make this a table"
- "Convert to table" / "Table format"
- "Professional table with filters"
- "Structured data table"

### Example Commands
- "Create a table from A2:D14" → createTable
- "Convert this data to a table" → createTable
- "Make a table called SalesData" → createTable with tableName
`;

const TABLE_EXAMPLES: SkillExample[] = [
  {
    command: "Create a table from the data",
    response: {
      outputMode: "sheet",
      sheetAction: "createTable",
      sheetConfig: {
        range: "A2:D14",
        tableName: "DataTable",
        freezeHeader: true
      },
      summary: "Create native Google Sheets table",
      clarification: "Converting your data range to a native Google Sheets table with automatic formatting, filters, and frozen headers."
    }
  },
  {
    command: "Convert A1:E20 to a table called SalesReport",
    response: {
      outputMode: "sheet",
      sheetAction: "createTable",
      sheetConfig: {
        range: "A1:E20",
        tableName: "SalesReport",
        freezeHeader: true
      },
      summary: "Create SalesReport table",
      clarification: "Creating a table named 'SalesReport' from range A1:E20 with automatic formatting and filters."
    }
  },
  {
    command: "Make this data look like a professional table",
    response: {
      outputMode: "sheet",
      sheetAction: "createTable",
      sheetConfig: {
        range: "A2:D14",
        freezeHeader: true
      },
      summary: "Convert to professional table",
      clarification: "Converting your data to a native Google Sheets table for a professional, structured appearance."
    }
  }
];

export const tableSkill: GoogleSheetSkill = {
  id: 'table',
  name: 'Table Creation',
  version: '1.0.0',
  description: 'Convert data ranges to native Google Sheets Tables with automatic formatting and filters',
  
  // Intent detection
  triggerPatterns: TABLE_PATTERNS,
  intentScore: calculateIntentScore,
  
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
