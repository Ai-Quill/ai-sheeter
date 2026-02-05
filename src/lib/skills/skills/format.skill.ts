/**
 * Format Skill - EXPERT MODE
 * 
 * You are a Google Sheets formatting expert. This skill provides ALL
 * available formatting capabilities - analyze the data context and
 * apply professional formatting based on your expertise.
 * 
 * @version 2.1.0 - Expert Mode with Unified Intent
 */

import { GoogleSheetSkill, SkillExample } from '../types';

/**
 * Capabilities for unified intent classifier
 * These describe what this skill can do semantically
 */
const FORMAT_CAPABILITIES = [
  // Format triggers (specific to cell/number formatting, NOT formula)
  'format-cells', 'formatting', 'professionally', 'style', 'beautify',
  // Number formats
  'currency', 'percent', 'number-format', 'date-format', 'datetime',
  // Text styles
  'bold', 'italic', 'underline', 'strikethrough', 'font-size', 'font-family',
  // Colors
  'text-color', 'background-color', 'blue-header', 'white-text', 'header-color',
  // Alignment
  'alignment', 'center', 'left', 'right',
  // Borders and effects
  'borders', 'border-style', 'wrap-text', 'text-rotation', 'merge-cells',
  'banding', 'alternating-colors', 'row-banding', 'notes', 'comments'
];

const FORMAT_INSTRUCTIONS = `
## FORMAT Skill - EXPERT MODE

You are a Google Sheets formatting expert. Analyze the data and apply
professional formatting using ANY of the capabilities below.

### YOUR FULL CAPABILITIES

**Number Formatting (formatType):**
- currency: "$#,##0.00" (locales: USD, EUR, GBP, JPY, CNY, KRW, INR, VND, etc.)
- percent: "0.00%"
- number: "#,##0.00" (with decimals option)
- integer: "#,##0" (no decimals)
- date: "yyyy-mm-dd", "mm/dd/yyyy", "dd-mmm-yyyy", or custom pattern
- datetime: "yyyy-mm-dd hh:mm:ss"
- time: "hh:mm:ss"
- text: "@" (plain text)

**Font Styling (in options):**
- bold: true/false
- italic: true/false
- underline: true/false
- strikethrough: true/false (NEW)
- fontSize: 8-24 (larger for headers)
- fontFamily: "Arial", "Roboto", "Georgia", "Courier New", etc.
- textColor / fontColor: any hex color "#RRGGBB"

**Cell Appearance:**
- backgroundColor / background: any hex color
- horizontalAlignment / alignment: "left" | "center" | "right"
- verticalAlignment: "top" | "middle" | "bottom"
- wrap: true/false (enable text wrapping)
- wrapStrategy: "overflow" | "wrap" | "clip" (NEW - advanced control)
- textRotation: 0-90 degrees (NEW - for angled headers)
- textDirection: "LTR" | "RTL" (NEW)

**Cell Merging (NEW):**
- merge: true | "across" | "vertical"
- unmerge: true (to break apart merged cells)

**Borders (basic and advanced):**
- borders: true (all sides, default style)
- borderColor: "#000000" (NEW)
- borderStyle: "solid" | "solid_medium" | "solid_thick" | "dashed" | "dotted" | "double" (NEW)
- borderTop/borderLeft/borderBottom/borderRight: true/false (individual control, NEW)
- borderVertical/borderHorizontal: true/false (inner borders, NEW)

**Row Banding / Alternating Colors (NEW):**
- banding: true (apply alternating row colors)
- bandingTheme: "LIGHT_GREY" | "CYAN" | "GREEN" | "YELLOW" | "ORANGE" | "BLUE" | "TEAL" | "GREY" | "BROWN" | "LIGHT_GREEN" | "INDIGO" | "PINK"
- showHeader: true/false (include header in banding)
- showFooter: true/false

**Notes/Comments (NEW):**
- note: "text" (add cell note)
- clearNote: true (remove note)

### Schema
{
  "outputMode": "sheet",
  "sheetAction": "format",
  "sheetConfig": {
    "formatType": "[optional - for number/date formatting]",
    "range": "[from context]",
    "options": {
      // Include ANY relevant options based on your analysis
    }
  }
}

### OR Multiple Operations:
{
  "outputMode": "sheet",
  "sheetAction": "format",
  "sheetConfig": {
    "operations": [
      { "range": "A1:G1", "formatting": { "bold": true, "backgroundColor": "#4285F4", "textColor": "#FFFFFF" } },
      { "range": "A2:G10", "formatting": { "banding": true, "bandingTheme": "LIGHT_GREY" } }
    ]
  }
}

### EXPERT DECISIONS (analyze the data context):
1. **Numbers with $ or currency symbols** → Apply currency format with appropriate locale
2. **Numbers with %** → Apply percent format
3. **Date-like values** → Apply date format
4. **Header row** → Bold, contrasting colors, centered
5. **Data tables** → Consider banding for readability
6. **Narrow columns with long headers** → Consider textRotation: 45
7. **Long text content** → Enable wrap: true

### Range Targeting (from context)
- "format headers" → use explicitRowInfo.headerRange
- "format data" → use explicitRowInfo.dataStartRow to dataEndRow
- "format table" → use explicitRowInfo.fullRangeIncludingHeader
`;

const FORMAT_EXAMPLES: SkillExample[] = [];

export const formatSkill: GoogleSheetSkill = {
  id: 'format',
  name: 'Data Formatting',
  version: '2.1.0',
  description: 'Expert formatting: numbers, dates, styles, borders, banding, merging, rotation',
  
  // Semantic capabilities for unified intent classifier
  capabilities: FORMAT_CAPABILITIES,
  
  instructions: FORMAT_INSTRUCTIONS,
  examples: FORMAT_EXAMPLES,
  
  schema: {
    outputMode: 'sheet',
    sheetAction: 'format',
    requiredFields: ['range'],
    optionalFields: ['formatType', 'options', 'operations']
  },
  
  tokenCost: 600,
  outputMode: 'sheet',
  sheetAction: 'format',
  priority: 8,
  composable: true,
};

export default formatSkill;
