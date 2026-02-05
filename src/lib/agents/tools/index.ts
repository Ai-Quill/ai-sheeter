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
  description: `Format cells with number formats, styles, borders, and alignment.
  
Capabilities:
- Number formats: currency, percent, date, datetime, text
- Font: bold, italic, underline, fontSize, fontFamily, textColor
- Cell: backgroundColor, alignment, wrap, textRotation
- Borders: all sides, individual sides, styles
- Banding: alternating row colors`,

  inputSchema: z.object({
    range: z.string().describe('Cell range in A1 notation, e.g., "A1:B10" or "A:A"'),
    formatType: z.enum(['currency', 'percent', 'number', 'date', 'datetime', 'text', 'custom']).optional(),
    options: z.object({
      bold: z.boolean().optional(),
      italic: z.boolean().optional(),
      underline: z.boolean().optional(),
      fontSize: z.number().optional().describe('Font size between 8 and 36'),
      fontFamily: z.string().optional(),
      textColor: z.string().optional().describe('Hex color like "#FF0000"'),
      backgroundColor: z.string().optional().describe('Hex color'),
      horizontalAlignment: z.enum(['left', 'center', 'right']).optional(),
      verticalAlignment: z.enum(['top', 'middle', 'bottom']).optional(),
      wrap: z.boolean().optional(),
      textRotation: z.number().optional().describe('Text rotation angle between 0 and 90 degrees'),
      borders: z.boolean().optional(),
      borderStyle: z.enum(['solid', 'solid_medium', 'solid_thick', 'dashed', 'dotted', 'double']).optional(),
      banding: z.boolean().optional(),
      bandingTheme: z.enum(['LIGHT_GREY', 'CYAN', 'GREEN', 'YELLOW', 'ORANGE', 'BLUE']).optional(),
      numberFormat: z.string().optional().describe('Custom format like "$#,##0.00"'),
    }).optional(),
    operations: z.array(z.object({
      range: z.string(),
      formatting: z.record(z.string(), z.any()),
    })).optional().describe('Multiple formatting operations'),
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
  description: `Create charts and visualizations.
  
Chart types: line, bar, column, pie, area, scatter, combo, histogram
Expert decisions:
- Time series → line chart
- Comparison → column/bar chart  
- Part-to-whole → pie chart (single series only)
- Correlation → scatter with trendline`,

  inputSchema: z.object({
    chartType: z.enum(['line', 'bar', 'column', 'pie', 'area', 'scatter', 'combo', 'histogram']),
    domainColumn: z.string().describe('Category/X-axis column letter'),
    dataColumns: z.array(z.string()).describe('Numeric columns to chart'),
    title: z.string().optional(),
    seriesNames: z.array(z.string()).optional().describe('Legend labels'),
    legendPosition: z.enum(['top', 'bottom', 'right', 'left', 'none']).optional(),
    stacked: z.boolean().optional(),
    pieHole: z.number().optional().describe('0 for pie, 0.4 for donut (value between 0 and 0.9)'),
    trendlines: z.boolean().optional(),
    curveType: z.enum(['none', 'function', 'smooth']).optional(),
    yAxisFormat: z.enum(['currency', 'percent', 'decimal', 'short']).optional(),
    colors: z.array(z.string()).optional(),
  }),
});

// ============================================
// CONDITIONAL FORMAT TOOL
// ============================================

export const conditionalFormatTool = tool({
  description: `Apply conditional formatting rules to highlight cells based on values.
  
Rule types:
- Greater than / Less than thresholds
- Between ranges
- Text contains
- Custom formula
- Color scales (gradient)`,

  inputSchema: z.object({
    range: z.string().describe('Range to apply rules to'),
    rules: z.array(z.object({
      type: z.enum(['greaterThan', 'lessThan', 'between', 'equalTo', 'textContains', 'customFormula', 'colorScale']),
      value: z.union([z.number(), z.string()]).optional(),
      minValue: z.number().optional(),
      maxValue: z.number().optional(),
      formula: z.string().optional(),
      backgroundColor: z.string().optional(),
      textColor: z.string().optional(),
      bold: z.boolean().optional(),
    })),
  }),
});

// ============================================
// DATA VALIDATION TOOL
// ============================================

export const dataValidationTool = tool({
  description: `Add data validation: dropdowns, checkboxes, number ranges, date ranges.`,

  inputSchema: z.object({
    range: z.string().describe('Range to validate'),
    validationType: z.enum(['dropdown', 'checkbox', 'numberRange', 'dateRange', 'textLength', 'customFormula']),
    values: z.array(z.string()).optional().describe('Dropdown options'),
    min: z.number().optional(),
    max: z.number().optional(),
    formula: z.string().optional(),
    showWarning: z.boolean().optional().describe('Show warning vs reject invalid'),
  }),
});

// ============================================
// FILTER TOOL
// ============================================

export const filterTool = tool({
  description: `Filter data to show/hide rows based on criteria.`,

  inputSchema: z.object({
    range: z.string().describe('Data range including headers'),
    criteria: z.array(z.object({
      column: z.string().describe('Column letter'),
      operator: z.enum(['equals', 'notEquals', 'contains', 'greaterThan', 'lessThan', 'between', 'isEmpty', 'isNotEmpty']),
      value: z.union([z.string(), z.number()]).optional(),
      minValue: z.union([z.string(), z.number()]).optional(),
      maxValue: z.union([z.string(), z.number()]).optional(),
    })),
  }),
});

// ============================================
// SHEET OPERATIONS TOOL
// ============================================

export const sheetOpsTool = tool({
  description: `Sheet operations: freeze rows/columns, sort, hide/show, resize, protect.`,

  inputSchema: z.object({
    operations: z.array(z.object({
      operation: z.enum([
        'freezeRows', 'freezeColumns', 'unfreezeRows', 'unfreezeColumns',
        'sort', 'hideRows', 'hideColumns', 'showRows', 'showColumns',
        'resizeRows', 'resizeColumns', 'protect', 'unprotect',
        'insertRows', 'insertColumns', 'deleteRows', 'deleteColumns'
      ]),
      rows: z.number().optional(),
      columns: z.number().optional(),
      range: z.string().optional(),
      sortBy: z.array(z.object({
        column: z.string(),
        ascending: z.boolean().optional(),
      })).optional(),
      size: z.number().optional().describe('Pixel size for resize'),
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
  description: `Create or format a data table with headers, styling, and structure.`,

  inputSchema: z.object({
    range: z.string().describe('Table range'),
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
