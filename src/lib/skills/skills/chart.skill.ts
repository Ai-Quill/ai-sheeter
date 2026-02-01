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

// Minimal seed examples - database will provide better examples over time
const CHART_EXAMPLES: SkillExample[] = [];

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
