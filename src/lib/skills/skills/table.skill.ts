/**
 * Table Skill - EXPERT MODE
 * 
 * Create, update, delete, and append to native Google Sheets Tables.
 * Tables provide automatic formatting, filters, headers, column types,
 * structured data management, and table references.
 * 
 * @version 2.0.0 - Full Sheets API Tables support
 * @see https://developers.google.com/workspace/sheets/api/guides/tables
 */

import { GoogleSheetSkill, SkillExample } from '../types';

/**
 * Capabilities for unified intent classifier
 */
const TABLE_CAPABILITIES = [
  'create-table', 'make-table', 'convert-to-table',
  'table-format', 'format-as-table',
  'professional-table', 'structured-table', 'data-table',
  'table-with-headers', 'table-with-filters', 'frozen-header',
  'update-table', 'modify-table', 'resize-table',
  'delete-table', 'remove-table',
  'append-to-table', 'add-rows-to-table',
  'column-type', 'dropdown-column', 'checkbox-column',
  'percent-column', 'rating-column', 'date-column'
];

const TABLE_INSTRUCTIONS = `
## TABLE Skill - EXPERT MODE

Create, update, delete, and append to native Google Sheets Tables.
Tables provide auto-formatting, filters, frozen headers, column types, and structured data management.

### YOUR FULL CAPABILITIES

**Create Table (createTable):**
Convert a data range into a native Google Sheets Table with:
- Automatic header row detection and formatting
- Filter dropdowns on all columns
- Alternating row colors (banding)
- Column types: PERCENT, DROPDOWN, NUMERIC, DATE, CHECKBOX, RATING, SMART_CHIP
- Custom dropdown values per column

**Update Table (updateTable):**
- Modify the table range to add/remove rows or columns
- Requires tableId of an existing table

**Delete Table (deleteTable):**
- Remove an entire table and its contents
- Requires tableId of an existing table

**Append to Table (appendToTable):**
- Smart-append rows to the end of a table
- Aware of full rows and footers — inserts before footer if needed
- Requires tableId and data array

### CREATE TABLE SCHEMA (most common)
{
  "outputMode": "sheet",
  "sheetAction": "createTable",
  "sheetConfig": {
    "range": "[use explicitRowInfo.fullRangeIncludingHeader from context]",
    "tableName": "[user's name or auto-generate]",
    "freezeHeader": true,
    "columnProperties": [
      {
        "columnIndex": 0,
        "columnName": "Status",
        "columnType": "DROPDOWN",
        "values": ["Not Started", "In Progress", "Complete"]
      },
      {
        "columnIndex": 2,
        "columnType": "PERCENT"
      },
      {
        "columnIndex": 3,
        "columnType": "CHECKBOX"
      }
    ]
  }
}

### COLUMN TYPES REFERENCE
| Type        | Description                                    | Notes                                  |
|-------------|------------------------------------------------|----------------------------------------|
| PERCENT     | Percentage format (0-100%)                     | Auto-formats as percentage             |
| DROPDOWN    | Chip dropdown selector                         | Requires "values" array                |
| NUMERIC     | Number column                                  | Standard number format                 |
| DATE        | Date column                                    | Date picker UI                         |
| CHECKBOX    | Checkbox (TRUE/FALSE)                          | Default value: FALSE                   |
| RATING      | Star rating (0-5)                              | Default value: 0                       |
| SMART_CHIP  | Smart chip (people, files, etc.)               | Rich data type                         |

### UPDATE TABLE SCHEMA
{
  "outputMode": "sheet",
  "sheetAction": "updateTable",
  "sheetConfig": {
    "tableId": "[existing table ID]",
    "range": "[new expanded/shrunk range]"
  }
}

### DELETE TABLE SCHEMA
{
  "outputMode": "sheet",
  "sheetAction": "deleteTable",
  "sheetConfig": {
    "tableId": "[existing table ID]"
  }
}

### APPEND TO TABLE SCHEMA
{
  "outputMode": "sheet",
  "sheetAction": "appendToTable",
  "sheetConfig": {
    "tableId": "[existing table ID]",
    "data": [["Value1", "Value2", 100], ["Value3", "Value4", 200]]
  }
}

### EXPERT DECISIONS (analyze the request):
1. **"Create a table"** → createTable with range from context
2. **"Make it a professional table"** → createTable with auto-detect column types
3. **"Add dropdown for status column"** → createTable with DROPDOWN columnProperty
4. **"Add checkbox column"** → createTable with CHECKBOX columnProperty
5. **"Add rows to existing table"** → appendToTable (needs tableId)
6. **"Remove the table"** → deleteTable (needs tableId)

### FALLBACK
If the Sheets API native table feature is unavailable, the system automatically falls back to:
- Bold header with blue background and white text
- Filter dropdowns on header row
- Alternating row colors (banding)
- Borders around all cells
- Auto-resized columns
- Frozen header row

### KEY RULES
1. For createTable: range MUST include headers
2. columnProperties is optional — omit if no specific column types needed
3. updateTable/deleteTable/appendToTable require a tableId from an existing table
4. ⚠️ NEVER hardcode ranges — ALWAYS derive from data context
`;

const TABLE_EXAMPLES: SkillExample[] = [];

export const tableSkill: GoogleSheetSkill = {
  id: 'table',
  name: 'Table Creation & Management',
  version: '2.0.0',
  description: 'Create, update, delete native Google Sheets Tables with column types, filters, and structured data',
  
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
    optionalFields: ['tableName', 'freezeHeader', 'tableId', 'columnProperties', 'data', 'action']
  },
  
  // Metadata
  tokenCost: 400,
  outputMode: 'sheet',
  sheetAction: 'createTable',
  priority: 7,
  composable: false,
};

export default tableSkill;
