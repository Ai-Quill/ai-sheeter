/**
 * Conditional Format Skill - EXPERT MODE
 * 
 * You are a Google Sheets conditional formatting expert. This skill provides
 * ALL 30 condition types including gradient/color scales and date conditions.
 * Analyze the data and apply intelligent highlighting rules.
 * 
 * @version 2.0.0 - Expert Mode
 */

import { GoogleSheetSkill, SkillExample, DataContext } from '../types';

const CONDITIONAL_FORMAT_PATTERNS: RegExp[] = [
  /\b(highlight|color\s*code|colour\s*code)\b/i,
  /\b(conditional|conditionally)\s*(format|formatting)?\b/i,
  /\b(red|green|yellow)\s+(if|when|for)\b/i,
  /\b(negative|positive)\s+(values?)?\s*(red|green)?\b/i,
  /\b(above|below|greater|less)\s+than?\s*\d+/i,
  /\bmark\s+(cells?|values?)\s+(that|where|if)/i,
  /\bhighlight\s+['"]?[\w\s]+['"]?\s+(values?)?\s*(in|with)/i,
  /\b(gradient|color\s*scale|heat\s*map)\b/i,
  /\b(overdue|expired|past\s*due|today|yesterday|tomorrow)\b/i,
];

function calculateIntentScore(command: string, context?: DataContext): number {
  const cmdLower = command.toLowerCase();
  let score = 0;
  
  if (/\bhighlight\b/i.test(cmdLower)) score += 0.5;
  if (/\bconditional/i.test(cmdLower)) score += 0.5;
  if (/\b(red|green|yellow)\s+(if|when|for)/i.test(cmdLower)) score += 0.5;
  if (/\b(negative|positive)\b/i.test(cmdLower)) score += 0.4;
  if (/\b(above|below|greater|less)\s+than/i.test(cmdLower)) score += 0.4;
  if (/\bcolor.*(based|depending)/i.test(cmdLower)) score += 0.4;
  if (/\bhighlight\s+['"]?[\w]+['"]?\s+(values?|in|with)/i.test(cmdLower)) score += 0.6;
  if (/\b(containing|equals?|where)\b/i.test(cmdLower)) score += 0.3;
  if (/\b(gradient|color\s*scale|heat\s*map)\b/i.test(cmdLower)) score += 0.6;
  if (/\b(overdue|expired|today|yesterday)\b/i.test(cmdLower)) score += 0.4;
  
  return Math.min(score, 1.0);
}

const CONDITIONAL_FORMAT_INSTRUCTIONS = `
## CONDITIONAL FORMAT Skill - EXPERT MODE

You are a Google Sheets conditional formatting expert. Apply intelligent
highlighting using ANY of the 30 condition types below.

### YOUR FULL CAPABILITIES

**Number Conditions:**
- greaterThan / gt: Value > threshold
- greaterThanOrEqual / gte: Value >= threshold
- lessThan / lt: Value < threshold
- lessThanOrEqual / lte: Value <= threshold
- equals / eq: Exact number match
- notEquals / neq (NEW): Does not equal
- between: Value between min and max
- notBetween (NEW): Value outside range
- negative: Value < 0
- positive: Value > 0

**Text Conditions:**
- equals: Exact text match (e.g., "Active", "Complete")
- notEquals: Does not match
- contains: Contains substring
- notContains / doesNotContain: Does not contain
- startsWith: Starts with text
- endsWith: Ends with text

**Date Conditions (NEW):**
- dateAfter: After specific date
- dateBefore: Before specific date
- dateEqual: On specific date
- dateIsToday / today: Is today's date
- dateIsTomorrow / tomorrow: Is tomorrow
- dateIsYesterday / yesterday: Is yesterday
- dateInPastWeek / pastWeek: Within last 7 days
- dateInPastMonth / pastMonth: Within last 30 days
- dateInPastYear / pastYear: Within last year

**Cell State:**
- isEmpty / empty / blank: Cell is empty
- isNotEmpty / notEmpty / notBlank: Cell has content

**Special:**
- max / isMax / highest: Is the maximum value in range
- min / isMin / lowest: Is the minimum value in range
- formula / customFormula: Custom formula (value is the formula)

### Format Options (in rule.format):
- backgroundColor / background: Hex color
- textColor / fontColor / color: Hex color
- bold: true/false
- italic: true/false
- strikethrough: true/false
- underline: true/false

### Standard Rule Schema
{
  "outputMode": "sheet",
  "sheetAction": "conditionalFormat",
  "sheetConfig": {
    "range": "[from context]",
    "rules": [
      {
        "condition": "[condition type]",
        "value": "[threshold/text]",
        "min": 0, "max": 100,  // for between
        "format": { "backgroundColor": "#90EE90", "bold": true }
      }
    ]
  }
}

### GRADIENT / COLOR SCALE (NEW)
For heat maps and visual data representation:

**Two-Color Scale:**
{
  "rules": [{
    "type": "gradient",
    "minColor": "#FFFFFF",  // Color for minimum
    "maxColor": "#FF0000"   // Color for maximum
  }]
}

**Three-Color Scale (with midpoint):**
{
  "rules": [{
    "type": "gradient",
    "minColor": "#FF0000",   // Red for low
    "midColor": "#FFFF00",   // Yellow for middle
    "maxColor": "#00FF00",   // Green for high
    "minType": "MIN",        // MIN, NUMBER, PERCENT, PERCENTILE
    "midType": "PERCENTILE",
    "midValue": "50",        // Midpoint value
    "maxType": "MAX"
  }]
}

### EXPERT DECISIONS (analyze the data):
1. **Numeric KPIs** → Gradient color scale (red-yellow-green)
2. **Status columns** → Equals conditions for each status
3. **Date columns** → Date conditions (overdue = red, due today = yellow)
4. **Financial data** → Negative red, positive green
5. **Performance metrics** → Highlight max/min values
6. **Percentage columns** → Color scale from 0-100%

### Colors (use user's colors or these defaults)
- Bad/Low: #FFB6C1 (light red), #FF0000 (bold red)
- Good/High: #90EE90 (light green), #00FF00 (bold green)
- Warning/Mid: #FFFF00 (yellow), #FFA500 (orange)
- Neutral: #E0E0E0 (light gray)
`;

const CONDITIONAL_FORMAT_EXAMPLES: SkillExample[] = [];

export const conditionalFormatSkill: GoogleSheetSkill = {
  id: 'conditionalFormat',
  name: 'Conditional Formatting',
  version: '2.0.0',
  description: 'Expert highlighting: 30 conditions, gradient/color scale, date rules',
  
  triggerPatterns: CONDITIONAL_FORMAT_PATTERNS,
  intentScore: calculateIntentScore,
  
  instructions: CONDITIONAL_FORMAT_INSTRUCTIONS,
  examples: CONDITIONAL_FORMAT_EXAMPLES,
  
  schema: {
    outputMode: 'sheet',
    sheetAction: 'conditionalFormat',
    requiredFields: ['range', 'rules'],
    optionalFields: []
  },
  
  tokenCost: 450,
  outputMode: 'sheet',
  sheetAction: 'conditionalFormat',
  priority: 8,
  composable: true,
};

export default conditionalFormatSkill;
