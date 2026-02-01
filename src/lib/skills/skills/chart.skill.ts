/**
 * Chart Skill - EXPERT MODE
 * 
 * You are a Google Sheets visualization expert. This skill provides ALL
 * 70+ chart options including combo charts, dual Y-axis, logarithmic scales,
 * and comprehensive styling. Analyze the data and create stunning visuals.
 * 
 * @version 2.0.0 - Expert Mode
 */

import { GoogleSheetSkill, SkillExample, DataContext } from '../types';

const CHART_PATTERNS: RegExp[] = [
  /\b(chart|graph|plot|visualize|visualization)\b/i,
  /\b(pie|bar|line|column|area|scatter|histogram|combo)\s*(chart|graph)?\b/i,
  /\b(donut|trend|series)\b/i,
  /\bshow\s+(me\s+)?(a\s+)?(graph|chart|visual)\b/i,
  /\bcreate\s+(a\s+)?(graph|chart|visual)\b/i,
  /\b(revenue|sales|data)\s+over\s+time\b/i,
  /\bcompare\s+.*\s+(visually|graphically)\b/i,
  /\b(dual\s*axis|secondary\s*axis|two\s*axis)\b/i,
  /\b(log\s*scale|logarithmic)\b/i,
];

function calculateIntentScore(command: string, context?: DataContext): number {
  const cmdLower = command.toLowerCase();
  let score = 0;
  
  if (/\b(chart|graph|plot|visualize)\b/i.test(cmdLower)) score += 0.5;
  if (/\b(pie|bar|line|column|area|scatter|histogram|combo|donut)\b/i.test(cmdLower)) score += 0.4;
  if (/\b(show|create|make|build|generate)\s+(me\s+)?(a\s+)?(chart|graph|visual)/i.test(cmdLower)) score += 0.3;
  if (/\b(over\s+time|trend|growth|monthly|yearly|quarterly)\b/i.test(cmdLower)) score += 0.2;
  if (/\bcompare\b/i.test(cmdLower) && context && context.dataColumns.length > 2) score += 0.15;
  if (context && context.dataColumns.length >= 2) score += 0.05;
  if (/\b(dual|secondary)\s*axis\b/i.test(cmdLower)) score += 0.3;
  if (/\blog/i.test(cmdLower)) score += 0.2;
  
  return Math.min(score, 1.0);
}

const CHART_INSTRUCTIONS = `
## CHART Skill - EXPERT MODE

You are a Google Sheets visualization expert. Create professional charts
using ANY of the 70+ options below. Analyze the data to choose the best
chart type and configuration.

### YOUR FULL CAPABILITIES

**Chart Types:**
- line: Trend over time, continuous data
- bar: Horizontal comparison
- column: Vertical comparison
- pie: Part-to-whole (single series only)
- area: Volume over time
- scatter: Correlation, distribution
- combo (NEW): Mixed chart types (bar + line)
- histogram: Frequency distribution
- stepped / steppedArea: Discrete changes

**Common Options (all charts):**
- title: Chart title
- titleColor: Title text color
- seriesNames: ["Label1", "Label2"] - Legend labels
- colors: ["#4285F4", "#EA4335"] - Series colors
- legendPosition: "top" | "bottom" | "right" | "left" | "none"
- width, height: Dimensions in pixels (default 600x400)
- backgroundColor: Chart background
- fontName: Font family

**Bar/Column Options:**
- stacked: true - Stack bars
- stackedPercent: true - Stack as 100%
- showDataLabels: true - Values on bars
- barGroupWidth: "75%" - Bar width

**Line Chart Options:**
- curveType: "none" | "function" (smooth) | "smooth" | "spline"
- lineWidth: 1-5 (default 2)
- pointSize: 0-10 (0 = no points)
- pointShape: "circle" | "triangle" | "square" | "diamond" | "star"
- interpolateNulls: true - Connect through missing values
- lineDashStyle: [4, 4] - Dashed lines
- crosshair: true - Show crosshairs on hover

**Area Chart Options:**
- areaOpacity: 0-1 (default 0.3) - Fill transparency
- stacked: true - Stack areas
- stackedPercent: true - Stack as 100%

**Pie/Donut Options:**
- pieHole: 0-1 (0 = pie, 0.4 = donut)
- pieSliceText: "percentage" | "value" | "label" | "none"
- pieStartAngle: 0-360
- is3D: true - 3D pie
- sliceVisibilityThreshold: 0.05 - Hide small slices

**Scatter Options:**
- pointSize: 3-10 (default 7)
- pointShape: "circle" | "triangle" | "square" | "diamond"
- trendlines: [{ type: "linear", showR2: true, labelInLegend: "Trend" }]
- trendlineType: "linear" | "exponential" | "polynomial"
- aggregationTarget: "category" | "series"

**COMBO CHART (NEW):**
- seriesTypes: ["bars", "line", "area"] - Type per series

**DUAL Y-AXIS (NEW):**
- secondaryAxis: [1, 2] - Series indices for secondary axis
- secondaryAxisTitle: "Right Y-Axis Label"

**Axis Options:**
- xAxisTitle, yAxisTitle: Axis labels
- xAxisFormat, yAxisFormat: "currency" | "percent" | "decimal" | "short"
- xAxisMin, xAxisMax, yAxisMin, yAxisMax: Axis range
- gridlines: true/false
- gridlineColor: "#f0f0f0"
- slantedTextAngle: 45 - Rotate X labels
- logScale / yAxisLogScale (NEW): true - Logarithmic scale
- xAxisLogScale (NEW): true - Log scale for X axis

### Schema
{
  "outputMode": "sheet",
  "sheetAction": "chart",
  "sheetConfig": {
    "chartType": "[type]",
    "domainColumn": "[category/date column letter]",
    "dataColumns": ["[numeric columns]"],
    "seriesNames": ["[column headers]"],
    "title": "[title]",
    // Any additional options as needed
  }
}

### EXPERT DECISIONS (analyze the data):
1. **Time series** → Line chart with smooth curves
2. **Comparison** → Column chart or bar chart
3. **Part-to-whole** → Pie/donut (single series)
4. **Correlation** → Scatter with trendline
5. **Volume over time** → Area chart
6. **Mixed units** → Combo chart with dual Y-axis
7. **Exponential data** → Log scale
8. **Many categories** → Horizontal bar, slanted labels
9. **Currency values** → yAxisFormat: "currency"
10. **Percentages** → yAxisFormat: "percent"

### Chart Type Selection:
- PIE: Exactly ONE dataColumn (part-to-whole)
- LINE/AREA: Time series, continuous data
- BAR/COLUMN: Categorical comparison
- SCATTER: Two numeric variables, correlation
- COMBO: When mixing metrics (e.g., revenue + growth %)
`;

const CHART_EXAMPLES: SkillExample[] = [];

export const chartSkill: GoogleSheetSkill = {
  id: 'chart',
  name: 'Chart & Visualization',
  version: '2.0.0',
  description: 'Expert charts: 70+ options, combo, dual-axis, log scale, trendlines',
  
  triggerPatterns: CHART_PATTERNS,
  intentScore: calculateIntentScore,
  
  instructions: CHART_INSTRUCTIONS,
  examples: CHART_EXAMPLES,
  
  schema: {
    outputMode: 'sheet',
    sheetAction: 'chart',
    requiredFields: ['chartType', 'domainColumn', 'dataColumns'],
    optionalFields: ['title', 'seriesNames', 'legendPosition', 'yAxisFormat', 'curveType', 'pieHole', 'trendlines', 'secondaryAxis', 'logScale', 'stacked', 'seriesTypes']
  },
  
  tokenCost: 900,
  outputMode: 'sheet',
  sheetAction: 'chart',
  priority: 10,
  
  composable: false,
  conflicts: ['writeData'],
};

export default chartSkill;
