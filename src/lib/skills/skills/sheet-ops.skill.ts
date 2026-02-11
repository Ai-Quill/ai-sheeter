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
  // Freeze operations
  'freeze', 'unfreeze', 'freeze-rows', 'freeze-columns', 'freeze-header',
  'header-row', 'lock-header', 'freeze-top',
  // Hide/show
  'hide-rows', 'hide-columns', 'show-rows', 'show-columns', 'unhide',
  // Insert/delete
  'insert-rows', 'insert-columns', 'delete-rows', 'delete-columns', 'add-rows',
  // Sort operations
  'sort', 'sort-by', 'ascending', 'descending', 'a-z', 'z-a',
  'order-by', 'arrange', 'sort-data',
  // Clear operations
  'clear', 'clear-content', 'clear-format', 'clear-validation',
  // Resize
  'resize', 'auto-fit', 'column-width', 'row-height', 'auto-resize',
  // Sheet properties
  'rename-sheet', 'tab-color', 'sheet-color',
  // Grouping
  'group-rows', 'group-columns', 'ungroup',
  // Protection
  'protect', 'unprotect', 'lock-range'
];

const SHEET_OPS_INSTRUCTIONS = `
## SHEET OPERATIONS Skill - EXPERT MODE

You are a Google Sheets operations expert. Use sheetAction: "sheetOps" with an operations array.
Each operation specifies its type and relevant parameters.

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
  → { operation: "clear", range: "[from context]" }
- clearContent: Clear values only, keep formatting
  → { operation: "clearContent", range: "[from context]" }
- clearFormat: Clear formatting only, keep values
  → { operation: "clearFormat", range: "[from context]" }
- clearValidation: Clear data validation rules
  → { operation: "clearValidation", range: "[from context]" }
- clearNotes: Clear cell notes
  → { operation: "clearNotes", range: "[from context]" }

**Sort Data:**
- sort: Sort range by columns
  → { operation: "sort", range: "[from context]", sortBy: [{ column: "B", ascending: false }] }
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
  → { operation: "protectRange", range: "[from context]", description: "Header rows", warningOnly: true }
- protectSheet: Protect entire sheet
  → { operation: "protectSheet", description: "Master data" }
- unprotect: Remove all range protections
  → { operation: "unprotect" }

### Schema
{
  "outputMode": "sheet",
  "sheetAction": "sheetOps",
  "sheetConfig": {
    "operations": [
      { "operation": "[type]", ...params }
    ]
  }
}

### Key Rules
1. sheetAction is always "sheetOps"
2. Operations go in sheetConfig.operations array
3. Column references: letters ("A") or numbers (1)
4. Row references: always numbers
5. Multiple operations: put all in the same operations array
6. ⚠️ NEVER hardcode ranges — ALWAYS derive from data context (explicitRowInfo, headers, etc.)
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
