/**
 * Sheet Operations Skill - NEW
 * 
 * You are a Google Sheets operations expert. This skill provides 20+
 * sheet-level operations including freeze panes, hide/show, insert/delete,
 * sort, clear, resize, and more.
 * 
 * @version 1.0.0 - Expert Mode
 */

import { GoogleSheetSkill, SkillExample, DataContext } from '../types';

const SHEET_OPS_PATTERNS: RegExp[] = [
  /\b(freeze|unfreeze)\s*(row|column|pane|header)?\b/i,
  /\b(hide|show|unhide)\s*(row|column|rows|columns)\b/i,
  /\b(insert|add|delete|remove)\s*(row|column|rows|columns)\b/i,
  /\b(sort|order)\s*(by|ascending|descending|a-z|z-a)\b/i,
  /\b(clear|reset|remove)\s*(content|format|formatting|validation|all)\b/i,
  /\b(resize|width|height|auto\s*fit|auto\s*resize)\b/i,
  /\b(rename|name)\s*(sheet|tab)\b/i,
  /\b(tab\s*color|sheet\s*color)\b/i,
  /\b(group|ungroup)\s*(row|column|rows|columns)\b/i,
  /\b(protect|unprotect|lock)\b/i,
];

function calculateIntentScore(command: string, context?: DataContext): number {
  const cmdLower = command.toLowerCase();
  let score = 0;
  
  if (/\bfreeze\b/i.test(cmdLower)) score += 0.6;
  if (/\b(hide|show|unhide)\b/i.test(cmdLower)) score += 0.5;
  if (/\b(insert|delete)\s*(row|column)/i.test(cmdLower)) score += 0.6;
  if (/\bsort\b/i.test(cmdLower)) score += 0.5;
  if (/\bclear\b/i.test(cmdLower)) score += 0.5;
  if (/\b(resize|width|height|auto\s*fit)\b/i.test(cmdLower)) score += 0.5;
  if (/\brename\s*(sheet|tab)\b/i.test(cmdLower)) score += 0.6;
  if (/\btab\s*color\b/i.test(cmdLower)) score += 0.6;
  if (/\b(group|ungroup)\b/i.test(cmdLower)) score += 0.5;
  if (/\bprotect\b/i.test(cmdLower)) score += 0.5;
  
  return Math.min(score, 1.0);
}

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

### Schema
{
  "outputMode": "sheet",
  "sheetAction": "sheetOps",
  "sheetConfig": {
    "operation": "[operation type from above]",
    // Operation-specific parameters
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
  version: '1.0.0',
  description: 'Expert operations: freeze, hide/show, insert/delete, sort, clear, resize, group, protect',
  
  triggerPatterns: SHEET_OPS_PATTERNS,
  intentScore: calculateIntentScore,
  
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
