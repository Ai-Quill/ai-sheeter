/**
 * Sheet Operations Skill
 * 
 * You are a Google Sheets operations expert. This skill provides 20+
 * sheet-level operations including freeze panes, hide/show, insert/delete,
 * sort, clear, resize, and more.
 * 
 * @version 1.1.0 - Expert Mode with Unified Intent
 */

import { GoogleSheetSkill, SkillExample } from '../types';

/**
 * Capabilities for unified intent classifier
 */
const SHEET_OPS_CAPABILITIES = [
  'freeze', 'unfreeze', 'freeze-rows', 'freeze-columns', 'freeze-header',
  'hide-rows', 'hide-columns', 'show-rows', 'show-columns', 'unhide',
  'insert-rows', 'insert-columns', 'delete-rows', 'delete-columns', 'add-rows',
  'sort', 'sort-by', 'ascending', 'descending', 'a-z', 'z-a',
  'clear', 'clear-content', 'clear-format', 'clear-validation',
  'resize', 'auto-fit', 'column-width', 'row-height', 'auto-resize',
  'rename-sheet', 'tab-color', 'sheet-color',
  'group-rows', 'group-columns', 'ungroup',
  'protect', 'unprotect', 'lock-range'
];

const SHEET_OPS_INSTRUCTIONS = `
## SHEET OPERATIONS Skill - EXPERT MODE

You are a Google Sheets operations expert. Perform sheet-level operations
using ANY of the 20+ operations below.

### YOUR FULL CAPABILITIES

**Freeze Panes:**
- freezeRows: Freeze N rows from top
  → { operation: "freezeRows", rows: 1 }
- freezeColumns: Freeze N columns from left
  → { operation: "freezeColumns", columns: 1 }
- freeze: Freeze both rows and columns
  → { operation: "freeze", rows: 1, columns: 2 }
- unfreeze: Unfreeze all
  → { operation: "unfreeze" }

**Hide/Show Rows:**
- hideRows: Hide specific rows
  → { operation: "hideRows", startRow: 5, numRows: 3 }
- showRows: Show hidden rows
  → { operation: "showRows", startRow: 5, numRows: 3 }

**Hide/Show Columns:**
- hideColumns: Hide specific columns
  → { operation: "hideColumns", startColumn: "C", numColumns: 2 }
- showColumns: Show hidden columns
  → { operation: "showColumns", startColumn: "C", numColumns: 2 }

**Insert Rows/Columns:**
- insertRows: Insert new rows
  → { operation: "insertRows", after: 5, count: 3 }
  → { operation: "insertRows", before: 5, count: 3 }
- insertColumns: Insert new columns
  → { operation: "insertColumns", after: "C", count: 2 }
  → { operation: "insertColumns", before: "C", count: 2 }

**Delete Rows/Columns:**
- deleteRows: Delete rows
  → { operation: "deleteRows", startRow: 5, count: 3 }
- deleteColumns: Delete columns
  → { operation: "deleteColumns", startColumn: "C", count: 2 }

**Clear Operations:**
- clear: Clear everything (content, format, validation)
  → { operation: "clear", range: "A1:D10" }
- clearContent: Clear values only, keep formatting
  → { operation: "clearContent", range: "A1:D10" }
- clearFormat: Clear formatting only, keep values
  → { operation: "clearFormat", range: "A1:D10" }
- clearValidation: Clear data validation rules
  → { operation: "clearValidation", range: "A1:D10" }
- clearNotes: Clear cell notes
  → { operation: "clearNotes", range: "A1:D10" }

**Sort Data:**
- sort: Sort range by columns
  → { operation: "sort", range: "A1:D20", sortBy: [{ column: "B", ascending: false }] }
  → { operation: "sort", sortBy: [{ column: 2, ascending: true }, { column: 3, ascending: false }] }

**Row/Column Dimensions:**
- setRowHeight: Set specific row height
  → { operation: "setRowHeight", row: 1, height: 40 }
- setRowHeights: Set height for multiple rows
  → { operation: "setRowHeights", startRow: 1, endRow: 5, height: 30 }
- setColumnWidth: Set specific column width
  → { operation: "setColumnWidth", column: "A", width: 150 }
- setColumnWidths: Set width for multiple columns
  → { operation: "setColumnWidths", startColumn: "A", endColumn: "D", width: 100 }
- autoResizeColumn: Auto-fit column to content
  → { operation: "autoResizeColumn", column: "B" }
- autoResizeColumns: Auto-fit multiple columns
  → { operation: "autoResizeColumns", startColumn: "A", endColumn: "G" }
- autoResizeRows: Auto-fit row heights
  → { operation: "autoResizeRows", startRow: 1, numRows: 10 }

**Sheet Properties:**
- renameSheet: Rename current sheet
  → { operation: "renameSheet", name: "Q1 Sales" }
- setTabColor: Set sheet tab color
  → { operation: "setTabColor", color: "#4285F4" }
- clearTabColor: Remove tab color
  → { operation: "clearTabColor" }

**Grouping:**
- groupRows: Create collapsible row group
  → { operation: "groupRows", startRow: 5, endRow: 10, collapse: true }
- groupColumns: Create collapsible column group
  → { operation: "groupColumns", startColumn: "C", endColumn: "F" }
- ungroupRows: Remove row grouping
  → { operation: "ungroupRows", startRow: 5, endRow: 10 }
- ungroupColumns: Remove column grouping
  → { operation: "ungroupColumns", startColumn: "C", endColumn: "F" }

**Protection (basic):**
- protectRange: Protect a range from editing
  → { operation: "protectRange", range: "A1:D10", description: "Header rows" }
- protectSheet: Protect entire sheet
  → { operation: "protectSheet", description: "Master data" }

### Schema (IMPORTANT: Use operations ARRAY for multiple operations!)
{
  "outputMode": "sheet",
  "sheetAction": "sheetOps",
  "sheetConfig": {
    "operations": [
      { "operation": "[type]", ...params },
      { "operation": "[type]", ...params }
    ]
  }
}

### Example: Freeze header and sort
{
  "outputMode": "sheet",
  "sheetAction": "sheetOps",
  "sheetConfig": {
    "operations": [
      { "operation": "freezeRows", "rows": 1 },
      { "operation": "sort", "range": "A1:G31", "sortBy": [{ "column": "D", "ascending": false }] }
    ]
  }
}

### EXPERT DECISIONS (analyze the request):
1. **"Freeze the header"** → freezeRows: 1
2. **"Lock first column"** → freezeColumns: 1
3. **"Sort by date"** → sort with date column
4. **"Add 3 rows after row 10"** → insertRows with after: 10
5. **"Auto-fit all columns"** → autoResizeColumns
6. **"Clear formatting but keep data"** → clearFormat
7. **"Organize into sections"** → groupRows for each section
8. **"Make tab blue"** → setTabColor with blue hex

### Key Rules
1. Use sheetAction: "sheetOps" (not "operations")
2. Operation name goes in config.operation
3. Column references can be letters ("A") or numbers (1)
4. Row references are always numbers
`;

const SHEET_OPS_EXAMPLES: SkillExample[] = [];

export const sheetOpsSkill: GoogleSheetSkill = {
  id: 'sheetOps',
  name: 'Sheet Operations',
  version: '1.1.0',
  description: 'Expert operations: freeze, hide/show, insert/delete, sort, clear, resize, group, protect',
  
  // Semantic capabilities for unified intent classifier
  capabilities: SHEET_OPS_CAPABILITIES,
  
  instructions: SHEET_OPS_INSTRUCTIONS,
  examples: SHEET_OPS_EXAMPLES,
  
  schema: {
    outputMode: 'sheet',
    sheetAction: 'sheetOps',
    requiredFields: ['operation'],
    optionalFields: ['rows', 'columns', 'range', 'startRow', 'endRow', 'startColumn', 'endColumn', 'count', 'sortBy', 'name', 'color', 'height', 'width']
  },
  
  tokenCost: 500,
  outputMode: 'sheet',
  sheetAction: 'sheetOps',
  priority: 7,
  composable: true,
};

export default sheetOpsSkill;
