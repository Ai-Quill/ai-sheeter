/**
 * Chart Skill
 * 
 * Handles all chart/visualization requests:
 * - Line, bar, column, pie, area, scatter charts
 * - Trendlines and formatting options
 * 
 * @version 1.0.0
 */

import { GoogleSheetSkill, SkillExample, DataContext } from '../types';

// ============================================
// TRIGGER PATTERNS
// ============================================

const CHART_PATTERNS: RegExp[] = [
  /\b(chart|graph|plot|visualize|visualization)\b/i,
  /\b(pie|bar|line|column|area|scatter|histogram)\s*(chart|graph)?\b/i,
  /\b(donut|trend|series)\b/i,
  /\bshow\s+(me\s+)?(a\s+)?(graph|chart|visual)\b/i,
  /\bcreate\s+(a\s+)?(graph|chart|visual)\b/i,
  /\b(revenue|sales|data)\s+over\s+time\b/i,
  /\bcompare\s+.*\s+(visually|graphically)\b/i,
];

// ============================================
// INTENT SCORING
// ============================================

function calculateIntentScore(command: string, context?: DataContext): number {
  const cmdLower = command.toLowerCase();
  let score = 0;
  
  // Primary chart keywords (high confidence)
  if (/\b(chart|graph|plot|visualize)\b/i.test(cmdLower)) {
    score += 0.5;
  }
  
  // Specific chart types (very high confidence)
  if (/\b(pie|bar|line|column|area|scatter|histogram|donut)\b/i.test(cmdLower)) {
    score += 0.4;
  }
  
  // Action verbs suggesting visualization
  if (/\b(show|create|make|build|generate)\s+(me\s+)?(a\s+)?(chart|graph|visual)/i.test(cmdLower)) {
    score += 0.3;
  }
  
  // Temporal patterns suggesting trend charts
  if (/\b(over\s+time|trend|growth|monthly|yearly|quarterly)\b/i.test(cmdLower)) {
    score += 0.2;
  }
  
  // Comparison patterns
  if (/\bcompare\b/i.test(cmdLower) && context && context.dataColumns.length > 2) {
    score += 0.15;
  }
  
  // Context boost: multiple numeric columns suggest chart possibility
  if (context && context.dataColumns.length >= 2) {
    score += 0.05;
  }
  
  // Cap at 1.0
  return Math.min(score, 1.0);
}

// ============================================
// INSTRUCTIONS
// ============================================

const CHART_INSTRUCTIONS = `
## CHART Skill

For chart/visualization requests, return outputMode: "sheet" with sheetAction: "chart".

### Schema
{
  "outputMode": "sheet",
  "sheetAction": "chart",
  "sheetConfig": {
    "chartType": "line|bar|column|pie|area|scatter|histogram",
    "domainColumn": "[from context - category/date column]",
    "dataColumns": ["[from context - numeric columns]"],
    "seriesNames": ["[from context - column headers]"],
    "title": "[user's title or derive from data]",
    "legendPosition": "top|bottom|right|none",
    "yAxisFormat": "currency|percent|decimal"
  }
}

### Derive from Context
- **domainColumn**: Look at context headers for category/date column (usually first)
- **dataColumns**: Look at context for numeric columns (check sample data)
- **seriesNames**: Extract from actual column headers in context

### Chart Type Rules
- PIE: exactly ONE dataColumn
- LINE/BAR/AREA: include ALL relevant numeric columns from context
- SCATTER: domainColumn=X values, dataColumns=Y values only

### Smart Options
- Revenue/Sales data → yAxisFormat: "currency"
- Percentage data → yAxisFormat: "percent"
- Date X-axis → slantedTextAngle: 60
- Trendlines MUST have labelInLegend
`;

// ============================================
// EXAMPLES
// ============================================

const CHART_EXAMPLES: SkillExample[] = [
  {
    command: "Create a line chart showing revenue trends",
    context: "Columns: A=Month, B=Store A, C=Store B, D=Store C",
    response: {
      outputMode: "sheet",
      sheetAction: "chart",
      sheetConfig: {
        chartType: "line",
        domainColumn: "A",
        dataColumns: ["B", "C", "D"],
        seriesNames: ["Store A", "Store B", "Store C"],
        title: "Revenue Trends",
        legendPosition: "bottom",
        yAxisFormat: "currency",
        curveType: "smooth"
      },
      summary: "Create line chart for revenue trends",
      clarification: "Creating a line chart to visualize revenue trends across all stores."
    },
    relevanceHints: ["line", "trend", "revenue", "over time"]
  },
  {
    command: "Make a pie chart of sales by category",
    context: "Columns: A=Category, B=Sales Amount",
    response: {
      outputMode: "sheet",
      sheetAction: "chart",
      sheetConfig: {
        chartType: "pie",
        domainColumn: "A",
        dataColumns: ["B"],
        seriesNames: ["Sales Amount"],
        title: "Sales by Category",
        legendPosition: "right",
        pieSliceText: "percentage"
      },
      summary: "Create pie chart for sales distribution",
      clarification: "Creating a pie chart showing sales distribution by category."
    },
    relevanceHints: ["pie", "distribution", "breakdown", "category"]
  },
  {
    command: "Create a bar chart comparing monthly performance",
    context: "Columns: A=Month, B=Revenue, C=Expenses, D=Profit",
    response: {
      outputMode: "sheet",
      sheetAction: "chart",
      sheetConfig: {
        chartType: "bar",
        domainColumn: "A",
        dataColumns: ["B", "C", "D"],
        seriesNames: ["Revenue", "Expenses", "Profit"],
        title: "Monthly Performance Comparison",
        legendPosition: "top",
        yAxisFormat: "currency"
      },
      summary: "Create bar chart comparing monthly metrics",
      clarification: "Creating a bar chart to compare revenue, expenses, and profit by month."
    },
    relevanceHints: ["bar", "compare", "monthly", "performance"]
  },
  {
    command: "Show me a scatter plot with trendline for marketing spend vs revenue",
    context: "Columns: B=Marketing Spend, C=Revenue",
    response: {
      outputMode: "sheet",
      sheetAction: "chart",
      sheetConfig: {
        chartType: "scatter",
        domainColumn: "B",
        dataColumns: ["C"],
        seriesNames: ["Revenue"],
        title: "Marketing Spend vs Revenue",
        xAxisTitle: "Marketing Spend",
        yAxisTitle: "Revenue",
        trendlines: [
          { type: "linear", series: 0, labelInLegend: "Revenue Correlation" }
        ]
      },
      summary: "Create scatter plot with trendline",
      clarification: "Creating a scatter chart showing correlation between marketing spend and revenue."
    },
    relevanceHints: ["scatter", "correlation", "trendline", "vs"]
  }
];

// ============================================
// SKILL DEFINITION
// ============================================

export const chartSkill: GoogleSheetSkill = {
  id: 'chart',
  name: 'Chart & Visualization',
  version: '1.0.0',
  description: 'Create charts and visualizations from spreadsheet data',
  
  triggerPatterns: CHART_PATTERNS,
  intentScore: calculateIntentScore,
  
  instructions: CHART_INSTRUCTIONS,
  examples: CHART_EXAMPLES,
  
  schema: {
    outputMode: 'sheet',
    sheetAction: 'chart',
    requiredFields: ['chartType', 'domainColumn', 'dataColumns'],
    optionalFields: ['title', 'seriesNames', 'legendPosition', 'yAxisFormat', 'curveType', 'pieHole', 'trendlines']
  },
  
  tokenCost: 800,  // Estimated tokens when included
  outputMode: 'sheet',
  sheetAction: 'chart',
  priority: 10,
  
  composable: false,  // Charts are typically standalone
  conflicts: ['writeData'],  // Can't chart and write data at same time
};

export default chartSkill;
