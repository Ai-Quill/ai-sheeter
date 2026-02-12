/**
 * AI SDK Tools - Google Sheets Agent
 * 
 * Converts existing skills to AI SDK tool() definitions.
 * These tools are declarative - they define what the AI can do,
 * not how it's executed (execution happens in the frontend).
 * 
 * @version 1.0.0
 * @created 2026-02-05
 */

import { tool } from 'ai';
import { z } from 'zod';

// ============================================
// FORMAT TOOL
// ============================================

export const formatTool = tool({
  description: `Format cells with number formats, styles, borders, alignment, and more.
  
Capabilities:
- Number formats: currency, percent, integer, date, datetime, time, scientific, accounting, year, phone, zip, text, custom patterns
- Font: bold, italic, underline, strikethrough, fontSize, fontFamily, textColor (set true/false to add/remove)
- Cell: backgroundColor, alignment (horizontal + vertical), wrap, wrapStrategy, textRotation, textDirection
- Borders: all sides, individual sides (top/left/bottom/right), inner (vertical/horizontal), color, style
- Banding: 12 alternating color themes, with showHeader/showFooter control
- Merge: merge cells (true/across/vertical), unmerge
- Notes: add or clear cell notes
- Sizing: autoFitColumns, columnWidth, rowHeight
- Clear: clearFormatting to reset all formatting
- Multi-currency: USD, EUR, GBP, JPY, CNY, KRW, INR, VND, BRL, CAD, AUD, CHF, RUB`,

  inputSchema: z.object({
    description: z.string().optional().describe('Brief description of this step for UI, e.g., "Bold blue headers", "Add borders"'),
    range: z.string().describe('Cell range in A1 notation, e.g., "A1:B10" or "A:A"'),
    formatType: z.enum([
      'currency', 'accounting', 'percent', 'number', 'integer', 'decimal',
      'plain_number', 'year', 'scientific',
      'date', 'datetime', 'time', 'duration', 'date_short', 'date_long', 'date_iso',
      'time_12h', 'time_24h',
      'text', 'plain',
      'phone', 'zip', 'fraction',
      'custom'
    ]).optional(),
    options: z.object({
      // Font
      bold: z.boolean().optional().describe('true to bold, false to unbold'),
      italic: z.boolean().optional().describe('true to italicize, false to remove'),
      underline: z.boolean().optional(),
      strikethrough: z.boolean().optional(),
      fontSize: z.number().optional().describe('Font size 8-36'),
      fontFamily: z.string().optional(),
      textColor: z.string().optional().describe('Hex color "#RRGGBB"'),
      // Cell
      backgroundColor: z.string().optional().describe('Hex color'),
      horizontalAlignment: z.enum(['left', 'center', 'right']).optional(),
      verticalAlignment: z.enum(['top', 'middle', 'bottom']).optional(),
      wrap: z.boolean().optional(),
      wrapStrategy: z.enum(['overflow', 'wrap', 'clip']).optional(),
      textRotation: z.number().optional().describe('0-90 degrees'),
      textDirection: z.enum(['LTR', 'RTL']).optional(),
      // Borders
      borders: z.boolean().optional(),
      borderColor: z.string().optional().describe('Hex color for borders'),
      borderStyle: z.enum(['solid', 'solid_medium', 'solid_thick', 'dashed', 'dotted', 'double']).optional(),
      borderTop: z.boolean().optional(),
      borderBottom: z.boolean().optional(),
      borderLeft: z.boolean().optional(),
      borderRight: z.boolean().optional(),
      borderVertical: z.boolean().optional(),
      borderHorizontal: z.boolean().optional(),
      // Merge
      merge: z.union([z.boolean(), z.enum(['across', 'vertical'])]).optional(),
      unmerge: z.boolean().optional(),
      // Banding
      banding: z.boolean().optional(),
      bandingTheme: z.enum([
        'LIGHT_GREY', 'CYAN', 'GREEN', 'YELLOW', 'ORANGE', 'BLUE',
        'TEAL', 'GREY', 'BROWN', 'LIGHT_GREEN', 'INDIGO', 'PINK'
      ]).optional(),
      showHeader: z.boolean().optional(),
      showFooter: z.boolean().optional(),
      removeBanding: z.boolean().optional(),
      // Notes
      note: z.string().optional(),
      clearNote: z.boolean().optional(),
      // Sizing
      autoFitColumns: z.boolean().optional(),
      columnWidth: z.number().optional().describe('Column width in pixels'),
      rowHeight: z.number().optional().describe('Row height in pixels'),
      // Number format
      numberFormat: z.string().optional().describe('Custom format pattern like "$#,##0.00" or "0000"'),
      decimals: z.number().optional().describe('Number of decimal places (0-10)'),
      locale: z.string().optional().describe('Currency locale: USD, EUR, GBP, JPY, etc.'),
      pattern: z.string().optional().describe('Custom date/number pattern'),
      // Clear
      clearFormatting: z.boolean().optional().describe('Remove all formatting from range'),
    }).optional(),
    operations: z.array(z.object({
      range: z.string(),
      formatType: z.string().optional(),
      formatting: z.record(z.string(), z.any()),
    })).optional().describe('Multiple formatting operations for complex multi-range formatting'),
  }),
});

// ============================================
// FORMULA TOOL
// ============================================

export const formulaTool = tool({
  description: `Apply native Google Sheets formulas. Use {{ROW}} placeholder for row numbers.
  
FORMULA FIRST: Prefer formulas because they are FREE, instant, and auto-update.

Common patterns:
- GOOGLETRANSLATE(A{{ROW}}, "auto", "es") - translate
- UPPER/LOWER/PROPER - case conversion
- =C{{ROW}}*0.1 - calculate 10%
- =IF(A{{ROW}}>100, "High", "Low") - conditional
- =(B{{ROW}}-A{{ROW}})/A{{ROW}} - growth %`,

  inputSchema: z.object({
    formula: z.string().describe('Formula with {{ROW}} placeholder, e.g., "=A{{ROW}}*0.1"'),
    description: z.string().describe('Column header name for the new formula column'),
    outputColumn: z.string().describe('Column letter to write formula, e.g., "D"'),
    startRow: z.number().optional().describe('First data row (default 2)'),
    endRow: z.number().optional().describe('Last data row'),
  }),
});

// ============================================
// CHART TOOL
// ============================================

export const chartTool = tool({
  description: `Create charts and visualizations with 70+ options.
  
Chart types: line, bar, column, pie, area, scatter, combo, histogram
Expert decisions:
- Time series → line chart with smooth curves
- Comparison → column/bar chart  
- Part-to-whole → pie chart (single series only)
- Correlation → scatter with trendline
- Mixed units → combo chart with dual Y-axis
- Volume over time → area chart`,

  inputSchema: z.object({
    description: z.string().optional().describe('Brief description for UI, e.g., "Sales by region chart"'),
    chartType: z.enum(['line', 'bar', 'column', 'pie', 'area', 'scatter', 'combo', 'histogram']),
    domainColumn: z.string().describe('Category/X-axis column letter'),
    dataColumns: z.array(z.string()).describe('Numeric columns to chart'),
    title: z.string().optional(),
    titleColor: z.string().optional().describe('Title text color hex'),
    seriesNames: z.array(z.string()).optional().describe('Legend labels'),
    legendPosition: z.enum(['top', 'bottom', 'right', 'left', 'in', 'none']).optional(),
    colors: z.array(z.string()).optional().describe('Hex colors per series'),
    // Dimensions & positioning
    width: z.number().optional().describe('Chart width in pixels (default 600)'),
    height: z.number().optional().describe('Chart height in pixels (default 400)'),
    backgroundColor: z.string().optional().describe('Chart background color'),
    fontName: z.string().optional().describe('Font family for all text'),
    positionRow: z.number().optional().describe('Row to place chart'),
    positionColumn: z.number().optional().describe('Column to place chart'),
    // Bar/Column options
    stacked: z.boolean().optional(),
    stackedPercent: z.boolean().optional().describe('Stack as 100%'),
    showDataLabels: z.boolean().optional().describe('Show values on bars'),
    barGroupWidth: z.string().optional().describe('Bar width e.g. "75%"'),
    // Line options
    curveType: z.enum(['none', 'function', 'smooth', 'spline']).optional(),
    lineWidth: z.number().optional().describe('Line thickness 1-5'),
    pointSize: z.number().optional().describe('Data point size 0-10'),
    pointShape: z.enum(['circle', 'triangle', 'square', 'diamond', 'star', 'polygon']).optional(),
    interpolateNulls: z.boolean().optional().describe('Connect through missing values'),
    lineDashStyle: z.array(z.number()).optional().describe('Dash pattern e.g. [4, 4]'),
    crosshair: z.boolean().optional().describe('Show crosshairs on hover'),
    // Area options
    areaOpacity: z.number().optional().describe('Fill opacity 0-1 (default 0.3)'),
    // Pie/Donut options
    pieHole: z.number().optional().describe('0 for pie, 0.4 for donut'),
    pieSliceText: z.enum(['percentage', 'value', 'label', 'none']).optional(),
    pieStartAngle: z.number().optional().describe('Starting angle 0-360'),
    is3D: z.boolean().optional().describe('3D pie chart'),
    sliceVisibilityThreshold: z.number().optional().describe('Hide slices below this fraction'),
    // Scatter options
    trendlines: z.union([
      z.boolean(),
      z.array(z.object({
        type: z.enum(['linear', 'exponential', 'polynomial']).optional(),
        series: z.number().optional(),
        showR2: z.boolean().optional(),
        labelInLegend: z.string().optional(),
        color: z.string().optional(),
        opacity: z.number().optional(),
      })),
    ]).optional(),
    trendlineType: z.enum(['linear', 'exponential', 'polynomial']).optional(),
    // Data point labels
    annotationColumn: z.string().optional().describe('Column with text labels for data points (e.g., company names on scatter points)'),
    // Combo chart
    seriesTypes: z.array(z.enum(['bars', 'line', 'area'])).optional().describe('Type per series for combo charts'),
    // Dual Y-axis
    secondaryAxis: z.array(z.number()).optional().describe('Series indices for secondary Y-axis'),
    secondaryAxisTitle: z.string().optional(),
    // Axis options
    xAxisTitle: z.string().optional(),
    yAxisTitle: z.string().optional(),
    xAxisFormat: z.string().optional(),
    yAxisFormat: z.enum(['currency', 'percent', 'decimal', 'short']).optional(),
    xAxisMin: z.number().optional(),
    xAxisMax: z.number().optional(),
    yAxisMin: z.number().optional(),
    yAxisMax: z.number().optional(),
    gridlines: z.boolean().optional(),
    gridlineColor: z.string().optional(),
    logScale: z.boolean().optional().describe('Logarithmic Y-axis'),
    xAxisLogScale: z.boolean().optional().describe('Logarithmic X-axis'),
    slantedTextAngle: z.number().optional().describe('Rotate X labels (degrees)'),
  }),
});

// ============================================
// CONDITIONAL FORMAT TOOL
// ============================================

export const conditionalFormatTool = tool({
  description: `Apply conditional formatting rules to highlight cells based on values.
  
Rule types:
- Number: greaterThan, lessThan, greaterThanOrEqual, lessThanOrEqual, equals, notEquals, between, notBetween, negative, positive
- Text: equals, contains, notContains, startsWith, endsWith
- Date: dateAfter, dateBefore, dateEqual, today, yesterday, tomorrow, pastWeek, pastMonth, pastYear
- Cell state: isEmpty, isNotEmpty
- Special: max, min, customFormula
- Gradient/Color scale: two-color or three-color scales`,

  inputSchema: z.object({
    description: z.string().optional().describe('Brief description for UI, e.g., "Highlight low values red"'),
    range: z.string().describe('Range to apply rules to'),
    rules: z.array(z.object({
      // Condition type
      type: z.enum([
        'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual',
        'equals', 'notEquals', 'between', 'notBetween',
        'negative', 'positive',
        'contains', 'textContains', 'notContains', 'startsWith', 'endsWith',
        'dateAfter', 'dateBefore', 'dateEqual',
        'today', 'yesterday', 'tomorrow', 'pastWeek', 'pastMonth', 'pastYear',
        'isEmpty', 'isNotEmpty',
        'max', 'min',
        'customFormula',
        'gradient', 'colorScale',
      ]),
      // Condition values
      value: z.union([z.number(), z.string()]).optional(),
      min: z.number().optional().describe('For between conditions'),
      max: z.number().optional().describe('For between conditions'),
      formula: z.string().optional().describe('Custom formula string'),
      // Format options (standard rules)
      backgroundColor: z.string().optional(),
      textColor: z.string().optional(),
      bold: z.boolean().optional(),
      italic: z.boolean().optional(),
      strikethrough: z.boolean().optional(),
      underline: z.boolean().optional(),
      // Gradient/Color scale options
      minColor: z.string().optional().describe('Color for minimum value'),
      midColor: z.string().optional().describe('Color for midpoint (three-color scale)'),
      maxColor: z.string().optional().describe('Color for maximum value'),
      minType: z.enum(['MIN', 'NUMBER', 'PERCENT', 'PERCENTILE']).optional(),
      midType: z.enum(['MIN', 'MAX', 'NUMBER', 'PERCENT', 'PERCENTILE']).optional(),
      maxType: z.enum(['MAX', 'NUMBER', 'PERCENT', 'PERCENTILE']).optional(),
      midValue: z.string().optional().describe('Midpoint value (e.g., "50")'),
    })),
  }),
});

// ============================================
// DATA VALIDATION TOOL
// ============================================

export const dataValidationTool = tool({
  description: `Add data validation: dropdowns, checkboxes, number/date/text validation, email, URL.
  
20 validation types:
- Dropdown: from values array or from sheet range
- Checkbox: standard or custom values
- Number: range, equals, notEquals, greaterThan, lessThan, notBetween
- Date: range, equals, onOrAfter, onOrBefore, notBetween
- Text: contains, notContains, equals, length
- Special: email, URL, custom formula
- Help text support on all types`,

  inputSchema: z.object({
    range: z.string().describe('Range to validate'),
    validationType: z.enum([
      'dropdown', 'list',
      'rangeDropdown', 'listFromRange', 'dropdownFromRange',
      'checkbox',
      'number', 'numberRange', 'numberEqual', 'numberNotEqual',
      'numberGreaterThan', 'numberGTE', 'numberLessThan', 'numberLTE', 'numberNotBetween',
      'date', 'dateRange', 'dateEqual', 'dateOnOrAfter', 'dateOnOrBefore', 'dateNotBetween',
      'textContains', 'textNotContains', 'textEqual', 'textLength',
      'email', 'url',
      'custom', 'customFormula',
    ]),
    // Dropdown options
    values: z.array(z.string()).optional().describe('Dropdown options array'),
    sourceRange: z.string().optional().describe('Range for rangeDropdown, e.g., "Sheet1!A1:A10"'),
    // Checkbox options
    checkedValue: z.string().optional().describe('Custom checked value (e.g., "Yes")'),
    uncheckedValue: z.string().optional().describe('Custom unchecked value (e.g., "No")'),
    // Number/Date range
    min: z.number().optional(),
    max: z.number().optional(),
    value: z.union([z.number(), z.string()]).optional().describe('For equals/comparison validations'),
    // Date-specific
    date: z.string().optional().describe('Date value for date validations (YYYY-MM-DD)'),
    start: z.string().optional().describe('Start date for dateNotBetween'),
    end: z.string().optional().describe('End date for dateNotBetween'),
    after: z.string().optional().describe('After date for date range'),
    before: z.string().optional().describe('Before date for date range'),
    // Text
    text: z.string().optional().describe('Text for text validations'),
    // Custom formula
    formula: z.string().optional(),
    // Options
    helpText: z.string().optional().describe('Instructional text shown on hover'),
    allowInvalid: z.boolean().optional().describe('Allow invalid input with warning (default true)'),
    showWarning: z.boolean().optional().describe('Show warning vs reject invalid'),
  }),
});

// ============================================
// FILTER TOOL
// ============================================

export const filterTool = tool({
  description: `Filter data to show/hide rows based on 24 criteria types.
  
Criteria types:
- Text: equals, notEquals, contains, notContains, startsWith, endsWith
- Number: greaterThan, greaterThanOrEqual, lessThan, lessThanOrEqual, between
- Date: dateAfter, dateBefore, dateEqual, dateNotEqual
- Array: equalsAny (match any in list), notEqualsAny (exclude multiple)
- Visibility: hideValues, showOnlyValues
- Cell state: isEmpty, isNotEmpty
- Custom: formula/customFormula`,

  inputSchema: z.object({
    description: z.string().optional().describe('Brief description for UI, e.g., "Add filter dropdowns", "Filter by status"'),
    range: z.string().describe('Data range including headers'),
    criteria: z.array(z.object({
      column: z.string().describe('Column letter'),
      operator: z.enum([
        // Text
        'equals', 'notEquals', 'contains', 'notContains', 'startsWith', 'endsWith',
        // Number
        'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual', 'between',
        // Date
        'dateAfter', 'dateBefore', 'dateEqual', 'dateNotEqual',
        // Array-based
        'equalsAny', 'notEqualsAny',
        // Visibility
        'hideValues', 'showOnlyValues',
        // Cell state
        'isEmpty', 'isNotEmpty',
        // Custom formula
        'formula', 'customFormula',
      ]),
      value: z.union([z.string(), z.number(), z.array(z.string())]).optional().describe('Filter value (or array for equalsAny/hideValues)'),
      minValue: z.union([z.string(), z.number()]).optional().describe('Min for between'),
      maxValue: z.union([z.string(), z.number()]).optional().describe('Max for between'),
    })),
  }),
});

// ============================================
// SHEET OPERATIONS TOOL
// ============================================

export const sheetOpsTool = tool({
  description: `Sheet operations: 30+ operations for freeze, sort, hide/show, insert/delete, clear, resize, group, protect, rename, tab color.`,

  inputSchema: z.object({
    description: z.string().optional().describe('Brief description for UI, e.g., "Freeze header row", "Sort by date"'),
    operations: z.array(z.object({
      operation: z.enum([
        // Freeze
        'freezeRows', 'freezeColumns', 'freeze', 'unfreeze', 'unfreezeRows', 'unfreezeColumns',
        // Sort
        'sort',
        // Hide/Show
        'hideRows', 'hideColumns', 'showRows', 'showColumns',
        // Insert/Delete
        'insertRows', 'insertColumns', 'deleteRows', 'deleteColumns',
        // Clear
        'clear', 'clearContent', 'clearFormat', 'clearValidation', 'clearNotes',
        // Resize
        'setRowHeight', 'setRowHeights', 'setColumnWidth', 'setColumnWidths',
        'autoResizeColumn', 'autoResizeColumns', 'autoResizeRows',
        'resizeRows', 'resizeColumns',
        // Sheet properties
        'renameSheet', 'setTabColor', 'clearTabColor',
        // Grouping
        'groupRows', 'groupColumns', 'ungroupRows', 'ungroupColumns',
        // Protection
        'protect', 'protectRange', 'protectSheet', 'unprotect',
      ]),
      // Freeze/Row params
      rows: z.number().optional().describe('Number of rows to freeze'),
      columns: z.number().optional().describe('Number of columns to freeze'),
      // Range param (for clear, sort, protect)
      range: z.string().optional(),
      // Sort
      sortBy: z.array(z.object({
        column: z.union([z.string(), z.number()]),
        ascending: z.boolean().optional(),
      })).optional(),
      // Hide/Show/Delete rows
      startRow: z.number().optional(),
      numRows: z.number().optional(),
      endRow: z.number().optional(),
      // Hide/Show/Delete columns
      startColumn: z.string().optional(),
      endColumn: z.string().optional(),
      numColumns: z.number().optional(),
      // Insert
      after: z.union([z.number(), z.string()]).optional().describe('Insert after this row/column'),
      before: z.union([z.number(), z.string()]).optional().describe('Insert before this row/column'),
      count: z.number().optional().describe('Number to insert/delete'),
      // Resize
      row: z.number().optional().describe('Row number for setRowHeight'),
      column: z.string().optional().describe('Column letter for setColumnWidth'),
      height: z.number().optional().describe('Row height in pixels'),
      width: z.number().optional().describe('Column width in pixels'),
      size: z.number().optional().describe('Pixel size for legacy resize'),
      // Sheet properties
      name: z.string().optional().describe('Sheet name for rename'),
      color: z.string().optional().describe('Tab color hex'),
      // Group
      collapse: z.boolean().optional().describe('Collapse group after creating'),
      // Protection
      description: z.string().optional().describe('Protection description'),
      warningOnly: z.boolean().optional().describe('Warning only vs block edits'),
    })),
  }),
});

// ============================================
// WRITE DATA TOOL
// ============================================

export const writeDataTool = tool({
  description: `Write data to cells: paste tables, CSV, or structured data.`,

  inputSchema: z.object({
    startCell: z.string().describe('Top-left cell to start writing, e.g., "A1"'),
    data: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).describe('2D array of values'),
    hasHeaders: z.boolean().optional().describe('First row is headers'),
  }),
});

// ============================================
// ANALYZE/CHAT TOOL
// ============================================

export const analyzeTool = tool({
  description: `Analyze data and provide insights, summaries, or answer questions about the spreadsheet.
  
Use this for:
- Questions about the data
- Summaries and insights
- Recommendations
- Data quality observations`,

  inputSchema: z.object({
    question: z.string().describe('The question or analysis to perform'),
    focusColumns: z.array(z.string()).optional().describe('Columns to focus on'),
    outputType: z.enum(['summary', 'insights', 'recommendations', 'answer']).optional(),
  }),
});

// ============================================
// TABLE TOOL
// ============================================

export const tableTool = tool({
  description: `Create, update, or delete native Google Sheets Tables with auto-formatting, filters, frozen headers, column types, and professional styling.
  
Operations:
- createTable: Convert a range to a native table with column types (PERCENT, DROPDOWN, numeric, date, checkbox, rating)
- updateTable: Modify an existing table's range (add/remove rows/columns)
- deleteTable: Remove a table entirely
- appendToTable: Smart-append rows to the end of an existing table (aware of footers)

Falls back to table-like formatting (header styling, banding, borders, filters, auto-resize) if native API unavailable.`,

  inputSchema: z.object({
    action: z.enum(['createTable', 'updateTable', 'deleteTable', 'appendToTable']).optional()
      .describe('Table action (default: createTable)'),
    range: z.string().optional().describe('Table range including headers (for create/update)'),
    tableName: z.string().optional().describe('Name for the table'),
    tableId: z.string().optional().describe('Existing table ID (for update/delete/append)'),
    freezeHeader: z.boolean().optional().describe('Freeze header row (default true)'),
    // Column properties (for createTable)
    columnProperties: z.array(z.object({
      columnIndex: z.number().describe('0-based column index'),
      columnName: z.string().optional().describe('Column header name'),
      columnType: z.enum([
        'PERCENT', 'DROPDOWN', 'NUMERIC', 'DATE', 'CHECKBOX', 'RATING', 'SMART_CHIP',
      ]).optional(),
      values: z.array(z.string()).optional().describe('Dropdown values (only for DROPDOWN type)'),
    })).optional().describe('Column type definitions for native table'),
    // For appendToTable
    data: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])))
      .optional().describe('2D array of rows to append'),
    // Fallback formatting options
    hasHeaders: z.boolean().optional(),
    applyBanding: z.boolean().optional(),
    headerStyle: z.object({
      bold: z.boolean().optional(),
      backgroundColor: z.string().optional(),
      textColor: z.string().optional(),
    }).optional(),
    addBorders: z.boolean().optional(),
    autoFitColumns: z.boolean().optional(),
  }),
});

// ============================================
// EXPORT ALL TOOLS
// ============================================

export const allTools = {
  format: formatTool,
  formula: formulaTool,
  chart: chartTool,
  conditionalFormat: conditionalFormatTool,
  dataValidation: dataValidationTool,
  filter: filterTool,
  sheetOps: sheetOpsTool,
  writeData: writeDataTool,
  analyze: analyzeTool,
  table: tableTool,
};

export type ToolName = keyof typeof allTools;
