/**
 * Format Skill - COMPREHENSIVE EXPERT MODE
 * 
 * Complete Google Sheets formatting capabilities covering:
 * - Number/date/time formatting (20+ format types)
 * - Font styling (bold, italic, underline, strikethrough, size, family, color)
 * - Cell appearance (background, alignment, wrap, rotation, direction)
 * - Borders (all sides, individual sides, colors, styles)
 * - Cell merging (merge, merge across, merge vertically, unmerge)
 * - Row banding (12 themes with header/footer control)
 * - Notes (add, clear)
 * - Column/row sizing (auto-fit, fixed width/height)
 * - Clear formatting
 * - Multi-operation batches
 * - Multi-currency support (12+ currencies)
 * 
 * @version 3.0.0 - Comprehensive Expert Mode
 */

import { GoogleSheetSkill, SkillExample } from '../types';

/**
 * Capabilities for unified intent classifier
 * These describe what this skill can do semantically
 */
const FORMAT_CAPABILITIES = [
  // General format triggers
  'format-cells', 'formatting', 'professionally', 'style', 'beautify',
  'make-pretty', 'clean-up', 'professional-look', 'make-table',

  // Number formats
  'currency', 'percent', 'number-format', 'date-format', 'datetime',
  'accounting', 'scientific', 'fraction', 'decimal-places',
  'phone-format', 'zip-format', 'plain-number',

  // Convert-to-format triggers (data already exists, needs reformatting)
  'convert-to-year', 'convert-to-currency', 'convert-to-percent',
  'convert-to-integer', 'convert-to-number', 'convert-to-date',
  'convert-to-text', 'convert-to-plain',
  'remove-commas', 'fix-format', 'reformat', 'change-format',

  // Font styles
  'bold', 'italic', 'underline', 'strikethrough',
  'font-size', 'font-family', 'font-color',
  'make-bold', 'unbold', 'remove-bold',

  // Colors
  'text-color', 'background-color', 'blue-header', 'white-text',
  'header-color', 'color-cells', 'highlight',

  // Alignment
  'alignment', 'center', 'left', 'right', 'middle',
  'align-center', 'align-right', 'vertical-align',

  // Text display
  'wrap-text', 'text-rotation', 'rotate-text', 'angled-headers',
  'text-direction', 'rtl', 'clip-text',

  // Borders
  'borders', 'border-style', 'add-borders', 'grid-lines',
  'outline', 'remove-borders', 'thick-border',

  // Merging
  'merge-cells', 'unmerge', 'merge-across', 'combine-cells',

  // Banding
  'banding', 'alternating-colors', 'row-banding', 'zebra-stripes',
  'alternating-rows', 'remove-banding',

  // Notes
  'notes', 'comments', 'add-note', 'cell-note',

  // Sizing
  'column-width', 'row-height', 'auto-fit', 'auto-resize',
  'resize-columns', 'fit-content',

  // Clear/Reset
  'clear-formatting', 'reset-format', 'remove-formatting',

  // Multi-currency
  'dollar', 'euro', 'pound', 'yen', 'won', 'rupee'
];

const FORMAT_INSTRUCTIONS = `
## FORMAT Skill - COMPREHENSIVE EXPERT MODE (v3.0)

You are a Google Sheets formatting expert with FULL access to every formatting capability.
Analyze the data context and apply the most appropriate formatting.

=== NUMBER / DATE / TIME FORMATTING ===

**formatType values** (use in sheetConfig.formatType or operations[].formatType):

| formatType | Pattern | Example Output | Use When |
|---|---|---|---|
| currency | $#,##0.00 | $1,234.56 | Money values (default USD) |
| accounting | _($ #,##0.00_) | $ 1,234.56 | Financial reports (aligned decimals) |
| percent | 0.00% | 15.50% | Rates, ratios, growth |
| number | #,##0.00 | 1,234.56 | General numbers with commas |
| integer | #,##0 | 1,235 | Whole numbers with commas |
| plain_number | 0 | 1235 | Numbers WITHOUT commas (IDs, codes) |
| year | 0 | 2024 | Year values (no comma: 2024 not 2,024) |
| decimal | #,##0.00 | 1,234.56 | Alias for number |
| scientific | 0.00E+00 | 1.23E+03 | Very large/small numbers |
| fraction | # ?/? | 1 1/2 | Fractional values |
| date | yyyy-mm-dd | 2024-01-15 | Dates (ISO default, customizable) |
| date_short | mm/dd/yy | 01/15/24 | Short US dates |
| date_long | mmmm d, yyyy | January 15, 2024 | Verbose dates |
| date_iso | yyyy-mm-dd | 2024-01-15 | ISO 8601 dates |
| datetime | yyyy-mm-dd hh:mm:ss | 2024-01-15 14:30:00 | Timestamps |
| time | hh:mm:ss | 14:30:00 | Time only |
| time_12h | h:mm AM/PM | 2:30 PM | 12-hour format |
| time_24h | HH:mm | 14:30 | 24-hour format |
| duration | [h]:mm:ss | 125:30:00 | Elapsed time (>24h) |
| text | @ | (as-is) | Force plain text |
| phone | (###) ###-#### | (555) 123-4567 | Phone numbers |
| zip | 00000 | 07001 | ZIP codes (preserves leading zeros) |

**Custom patterns**: Use options.pattern or options.numberFormat for any custom Google Sheets format string:
- "#,##0.000" → 3 decimal places
- "0.00%" → percentage with 2 decimals
- "$#,##0;($#,##0)" → currency with negative in parens
- "#,##0.00;[Red]-#,##0.00" → negative numbers in red
- "yyyy/mm/dd" → custom date separator
- "ddd, mmm d" → "Mon, Jan 15"
- "0000" → pad with leading zeros

**Multi-currency** (use options.locale or options.currency):
USD ($), EUR (€), GBP (£), JPY (¥), CNY (¥), KRW (₩), INR (₹), 
RUB (₽), BRL (R$), CAD (CA$), AUD (A$), CHF (CHF), VND (₫)

**Decimal control**: Use options.decimals (0-10) to control decimal places.

=== FONT STYLING ===

| Property | Values | Notes |
|---|---|---|
| bold | true / false | true = bold, false = unbold (remove bold) |
| italic | true / false | true = italic, false = remove italic |
| underline | true / false | true = underline, false = remove |
| strikethrough | true / false | true = strikethrough, false = remove |
| fontSize | 8-36 | Pixels. Headers: 12-14, Body: 10-11 |
| fontFamily | string | "Arial", "Roboto", "Georgia", "Courier New", "Comic Sans MS", "Times New Roman", "Verdana", "Trebuchet MS", "Impact", etc. |
| textColor / fontColor | "#RRGGBB" | Any hex color. Use for emphasis or branding. |

=== CELL APPEARANCE ===

| Property | Values | Notes |
|---|---|---|
| backgroundColor / background | "#RRGGBB" | Any hex color |
| horizontalAlignment / alignment | "left" / "center" / "right" | Horizontal text alignment |
| verticalAlignment | "top" / "middle" / "bottom" | Vertical text alignment |
| wrap | true / false | Enable/disable text wrapping |
| wrapStrategy | "overflow" / "wrap" / "clip" | Advanced: overflow = spill into adjacent; clip = truncate |
| textRotation | 0-90 | Degrees. 45° = diagonal headers. 90° = vertical text |
| textDirection | "LTR" / "RTL" | For Hebrew, Arabic, etc. |

=== BORDERS ===

**Simple borders**: \`{ borders: true }\` → all sides, solid black

**Advanced borders**:
| Property | Values | Notes |
|---|---|---|
| borders | true | Apply borders |
| borderColor | "#RRGGBB" | Color for all borders (default "#000000") |
| borderStyle | "solid" / "solid_medium" / "solid_thick" / "dashed" / "dotted" / "double" | Line style |
| borderTop | true/false | Individual side control |
| borderBottom | true/false | Individual side control |
| borderLeft | true/false | Individual side control |
| borderRight | true/false | Individual side control |
| borderVertical | true/false | Inner vertical lines (between columns) |
| borderHorizontal | true/false | Inner horizontal lines (between rows) |

Common patterns:
- Outline only: \`{ borders: true, borderVertical: false, borderHorizontal: false }\`
- Horizontal lines only: \`{ borders: true, borderLeft: false, borderRight: false, borderVertical: false }\`
- Thick outline + thin inner: Use two operations with different styles

=== CELL MERGING ===

| Property | Values | Notes |
|---|---|---|
| merge | true | Merge all cells in range into one |
| merge | "across" | Merge cells across each row separately |
| merge | "vertical" | Merge cells down each column separately |
| unmerge | true | Break apart previously merged cells |

=== ROW BANDING (Alternating Colors) ===

| Property | Values | Notes |
|---|---|---|
| banding | true | Apply alternating row colors |
| bandingTheme | string | Theme name (see below) |
| showHeader | true/false | Include header row in banding (default: true) |
| showFooter | true/false | Include footer row (default: false) |
| removeBanding | true | Remove existing banding |

**Available themes**: LIGHT_GREY, CYAN, GREEN, YELLOW, ORANGE, BLUE, TEAL, GREY, BROWN, LIGHT_GREEN, INDIGO, PINK

=== NOTES ===

| Property | Values | Notes |
|---|---|---|
| note | string | Add a note to cells in range |
| clearNote | true | Remove notes from cells |

=== COLUMN & ROW SIZING ===

| Property | Values | Notes |
|---|---|---|
| autoFitColumns | true | Auto-resize columns to fit content |
| columnWidth | number | Set fixed column width in pixels (common: 80-200) |
| rowHeight | number | Set fixed row height in pixels (default: 21, header: 30-40) |

=== CLEAR FORMATTING ===

| Property | Values | Notes |
|---|---|---|
| clearFormatting | true | Remove ALL formatting from range (resets to default) |

=== SCHEMA ===

**Single operation** (most common):
\`\`\`json
{
  "outputMode": "sheet",
  "sheetAction": "format",
  "sheetConfig": {
    "formatType": "currency",
    "range": "[column range from context, e.g., C2:C16]",
    "options": {
      "locale": "USD",
      "decimals": 2
    }
  }
}
\`\`\`

**Multiple operations** (for complex formatting — headers + data + borders):
\`\`\`json
{
  "outputMode": "sheet",
  "sheetAction": "format",
  "sheetConfig": {
    "operations": [
      { 
        "range": "[headerRange from context]", 
        "formatting": { 
          "bold": true, "backgroundColor": "#4285F4", "textColor": "#FFFFFF",
          "fontSize": 11, "horizontalAlignment": "center" 
        } 
      },
      { 
        "range": "[fullRangeIncludingHeader from context]", 
        "formatting": { "borders": true, "borderStyle": "solid", "autoFitColumns": true } 
      },
      { 
        "range": "[dataRange from context]", 
        "formatting": { "banding": true, "bandingTheme": "LIGHT_GREY" } 
      },
      { 
        "range": "[specific column data range from context]", 
        "formatType": "currency",
        "formatting": { "locale": "USD" } 
      }
    ]
  }
}
\`\`\`

⚠️ CRITICAL: NEVER hardcode ranges. ALWAYS derive ranges from the DATA CONTEXT:
- Use explicitRowInfo.headerRange for headers
- Use explicitRowInfo.dataRange for data rows
- Use explicitRowInfo.fullRangeIncludingHeader for entire table
- Derive column ranges from headers + dataStartRow/dataEndRow

=== EXPERT DECISIONS (analyze the data context) ===

1. **Numbers with $ or currency symbols** → formatType: "currency" with appropriate locale
2. **Percentages or rates (0.15, 0.23)** → formatType: "percent"
3. **Year values with commas (2,014 → 2014)** → formatType: "year" or "plain_number" on EXISTING column
4. **Date-like values** → formatType: "date" (pick pattern from data)
5. **Phone numbers** → formatType: "phone"
6. **ZIP codes with leading zeros** → formatType: "zip"
7. **Header row** → Bold, contrasting background, white text, centered, slightly larger font
8. **Data tables** → Banding for readability, borders for structure
9. **Narrow columns with long headers** → textRotation: 45
10. **Long text content** → wrap: true or wrapStrategy: "wrap"
11. **Large numbers (millions+)** → number format with appropriate decimal places
12. **ID columns or codes** → formatType: "text" or "plain_number" (no commas)
13. **"Format professionally"** → Multi-operation: styled header + banding + borders + number formats + auto-fit

=== CONVERT-TO REQUESTS ===

When user says "convert column X to Y" and sampleData shows the column ALREADY contains the target data type (just displayed wrong due to formatting), use format action on the EXISTING column:

- "convert Founded to Year" (values: 2014, 2015) → formatType: "year", range: column range
- "convert Revenue to currency" (values: 50000) → formatType: "currency"
- "convert Rate to percentage" (values: 0.15, 0.23) → formatType: "percent"
- "convert to plain number" (remove commas from IDs) → formatType: "plain_number"
- "format dates properly" → formatType: "date" with appropriate pattern

=== RANGE TARGETING (ALWAYS derive from context — NEVER hardcode) ===

- "format headers" → use explicitRowInfo.headerRange
- "format data" → use data range from explicitRowInfo.dataStartRow to dataEndRow
- "format table" → use explicitRowInfo.fullRangeIncludingHeader
- "format column X" → find column letter from headers array, build range as "{col}{dataStartRow}:{col}{dataEndRow}"
- "format everything" → use multi-operations: header + data + borders
- "format specific cells" → derive from user description + context
`;

const FORMAT_EXAMPLES: SkillExample[] = [];

export const formatSkill: GoogleSheetSkill = {
  id: 'format',
  name: 'Data Formatting',
  version: '3.0.0',
  description: 'Comprehensive Google Sheets formatting: numbers, dates, currencies, fonts, colors, borders, banding, merging, notes, sizing, and professional table styling',
  
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
  
  tokenCost: 800,  // Slightly higher due to comprehensive instructions
  outputMode: 'sheet',
  sheetAction: 'format',
  priority: 8,
  composable: true,
};

export default formatSkill;
