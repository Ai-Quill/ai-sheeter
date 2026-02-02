/**
 * Response Normalizer
 * 
 * Consolidates all response correction logic that was previously scattered
 * as FIX blocks in parse-chain. This module handles common AI response
 * mistakes and normalizes them to the expected schema.
 * 
 * @version 1.0.0
 * @created 2026-02-02
 */

import { DataContext, SheetActionType } from '../skills/types';

// ============================================
// TYPES
// ============================================

export interface RawSheetResponse {
  sheetAction?: string;
  sheetConfig?: Record<string, any>;
  outputMode?: string;
  steps?: any[];
  summary?: string;
  clarification?: string;
}

export interface NormalizedSheetResponse {
  sheetAction: SheetActionType;
  sheetConfig: Record<string, any>;
  wasNormalized: boolean;
  normalizations: string[];
}

interface NormalizationContext {
  command: string;
  dataContext: DataContext;
}

// ============================================
// COLOR MAP FOR CONDITIONAL FORMAT EXTRACTION
// ============================================

const COLOR_MAP: Record<string, string> = {
  'green': '#00B050',
  'red': '#FF0000',
  'yellow': '#FFFF00',
  'orange': '#FFA500',
  'blue': '#0000FF',
  'purple': '#800080',
  'pink': '#FFC0CB',
  'grey': '#808080',
  'gray': '#808080',
  'white': '#FFFFFF',
  'black': '#000000',
};

// ============================================
// MAIN NORMALIZER
// ============================================

/**
 * Normalize a raw AI response into the expected schema
 * Consolidates all FIX logic from parse-chain
 */
export function normalizeSheetResponse(
  raw: RawSheetResponse,
  ctx: NormalizationContext
): NormalizedSheetResponse {
  let sheetAction = raw.sheetAction;
  let sheetConfig = { ...(raw.sheetConfig || {}) };
  const normalizations: string[] = [];
  
  // Extract from steps array if needed
  if (!sheetAction && Array.isArray(raw.steps) && raw.steps.length > 0) {
    const extracted = extractFromSteps(raw.steps, ctx);
    sheetAction = extracted.sheetAction;
    sheetConfig = extracted.sheetConfig;
    if (extracted.normalized) {
      normalizations.push('extracted_from_steps');
    }
  }
  
  // Apply normalizations in order
  const result1 = normalizeConditionalFormatFromCommand(sheetAction, sheetConfig, ctx);
  sheetAction = result1.sheetAction;
  sheetConfig = result1.sheetConfig;
  if (result1.normalized) normalizations.push('conditional_format_from_command');
  
  const result2 = normalizeValidationActionName(sheetAction);
  sheetAction = result2.sheetAction;
  if (result2.normalized) normalizations.push('validation_action_name');
  
  const result3 = normalizeNestedValidation(sheetAction, sheetConfig, ctx);
  sheetAction = result3.sheetAction;
  sheetConfig = result3.sheetConfig;
  if (result3.normalized) normalizations.push('nested_validation');
  
  const result4 = normalizeNestedConditionalFormat(sheetAction, sheetConfig, ctx);
  sheetAction = result4.sheetAction;
  sheetConfig = result4.sheetConfig;
  if (result4.normalized) normalizations.push('nested_conditional_format');
  
  const result5 = normalizeValidationCriteria(sheetAction, sheetConfig);
  sheetConfig = result5.sheetConfig;
  if (result5.normalized) normalizations.push('validation_criteria');
  
  const result6 = normalizeValidationMinMax(sheetAction, sheetConfig, ctx);
  sheetConfig = result6.sheetConfig;
  if (result6.normalized) normalizations.push('validation_min_max');
  
  const result7 = normalizeFullColumnRange(sheetAction, sheetConfig, ctx);
  sheetConfig = result7.sheetConfig;
  if (result7.normalized) normalizations.push('full_column_range');
  
  // Infer action from config if still undefined
  if (!sheetAction && sheetConfig) {
    sheetAction = inferActionFromConfig(sheetConfig);
    if (sheetAction) normalizations.push('inferred_from_config');
  }
  
  // Log normalizations if any
  if (normalizations.length > 0) {
    console.log(`[Normalizer] Applied ${normalizations.length} normalizations:`, normalizations.join(', '));
  }
  
  return {
    sheetAction: (sheetAction || 'format') as SheetActionType,
    sheetConfig,
    wasNormalized: normalizations.length > 0,
    normalizations,
  };
}

// ============================================
// EXTRACTION HELPERS
// ============================================

/**
 * Extract sheet action from steps array
 */
function extractFromSteps(
  steps: any[],
  ctx: NormalizationContext
): { sheetAction: string | undefined; sheetConfig: Record<string, any>; normalized: boolean } {
  const firstStep = steps[0];
  
  if (firstStep.action === 'format' || firstStep.formatting || firstStep.borders) {
    const formatOperations = steps.map((step: any) => ({
      range: step.range,
      formatting: step.formatting || {},
      borders: step.borders,
      alignment: step.alignment || step.formatting?.horizontalAlignment,
      bold: step.bold,
      backgroundColor: step.backgroundColor,
      textColor: step.textColor,
    }));
    
    return {
      sheetAction: 'format',
      sheetConfig: {
        formatType: 'text',
        operations: formatOperations,
        range: formatOperations[0]?.range || ctx.dataContext.dataRange,
        options: formatOperations[0]?.formatting || {},
      },
      normalized: true,
    };
  }
  
  if (firstStep.chartType || firstStep.action === 'chart') {
    return {
      sheetAction: 'chart',
      sheetConfig: firstStep,
      normalized: true,
    };
  }
  
  return { sheetAction: undefined, sheetConfig: {}, normalized: false };
}

// ============================================
// NORMALIZATION FUNCTIONS
// ============================================

/**
 * FIX 0: Command-based conditional format routing
 * If command says "conditional format" but AI returned "format"
 */
function normalizeConditionalFormatFromCommand(
  sheetAction: string | undefined,
  sheetConfig: Record<string, any>,
  ctx: NormalizationContext
): { sheetAction: string | undefined; sheetConfig: Record<string, any>; normalized: boolean } {
  if (sheetAction !== 'format') return { sheetAction, sheetConfig, normalized: false };
  if (!/\bconditional\s*(format|formatting)\b/i.test(ctx.command)) return { sheetAction, sheetConfig, normalized: false };
  
  // Check if operations already have conditionalFormat (let later normalizer handle it)
  if (sheetConfig.operations?.some((op: any) => op.formatting?.conditionalFormat)) {
    return { sheetAction, sheetConfig, normalized: false };
  }
  
  // Try to extract rules from command
  const rules = extractConditionalRulesFromCommand(ctx.command);
  if (rules.length > 0) {
    console.log('[Normalizer] Built conditionalFormat from command');
    return {
      sheetAction: 'conditionalFormat',
      sheetConfig: {
        range: sheetConfig.range || ctx.dataContext.dataRange,
        rules,
      },
      normalized: true,
    };
  }
  
  return { sheetAction, sheetConfig, normalized: false };
}

/**
 * Extract conditional format rules from command text
 */
function extractConditionalRulesFromCommand(command: string): any[] {
  const rules: any[] = [];
  const rulePattern = /(?:where\s+\w+\s+)?equals?\s*['"]?([^'"]+?)['"]?\s*(?:in\s+|with\s+)?(\w+)/gi;
  
  let match;
  while ((match = rulePattern.exec(command)) !== null) {
    const value = match[1].trim();
    const colorName = match[2].toLowerCase();
    const bgColor = COLOR_MAP[colorName] || '#FFFF00';
    rules.push({
      condition: 'equals',
      value,
      format: { backgroundColor: bgColor, bold: true },
    });
  }
  
  return rules;
}

/**
 * FIX 1: Correct "validation" → "dataValidation"
 */
function normalizeValidationActionName(
  sheetAction: string | undefined
): { sheetAction: string | undefined; normalized: boolean } {
  if (sheetAction === 'validation') {
    console.log('[Normalizer] Correcting validation → dataValidation');
    return { sheetAction: 'dataValidation', normalized: true };
  }
  return { sheetAction, normalized: false };
}

/**
 * FIX 2: Detect format with nested validation
 */
function normalizeNestedValidation(
  sheetAction: string | undefined,
  sheetConfig: Record<string, any>,
  ctx: NormalizationContext
): { sheetAction: string | undefined; sheetConfig: Record<string, any>; normalized: boolean } {
  if (sheetAction !== 'format' || !sheetConfig?.options?.validation) {
    return { sheetAction, sheetConfig, normalized: false };
  }
  
  console.log('[Normalizer] Extracting nested validation from format');
  const nestedValidation = sheetConfig.options.validation;
  const newConfig = {
    validationType: nestedValidation.type || 'checkbox',
    range: sheetConfig.range || ctx.dataContext.dataRange,
    values: nestedValidation.values,
    ...nestedValidation,
  };
  delete newConfig.type;
  
  return {
    sheetAction: 'dataValidation',
    sheetConfig: newConfig,
    normalized: true,
  };
}

/**
 * FIX 2.5: Detect format with nested conditionalFormat
 */
function normalizeNestedConditionalFormat(
  sheetAction: string | undefined,
  sheetConfig: Record<string, any>,
  ctx: NormalizationContext
): { sheetAction: string | undefined; sheetConfig: Record<string, any>; normalized: boolean } {
  if (sheetAction !== 'format') {
    return { sheetAction, sheetConfig, normalized: false };
  }
  
  let hasConditionalFormat = false;
  const conditionalRules: any[] = [];
  let targetRange = sheetConfig.range || ctx.dataContext.dataRange;
  
  // Check in operations array
  if (Array.isArray(sheetConfig.operations)) {
    for (const op of sheetConfig.operations) {
      if (op.formatting?.conditionalFormat) {
        hasConditionalFormat = true;
        targetRange = op.range || targetRange;
        const nestedRules = op.formatting.conditionalFormat;
        if (Array.isArray(nestedRules)) {
          for (const rule of nestedRules) {
            conditionalRules.push({
              condition: rule.condition,
              value: rule.value,
              format: {
                backgroundColor: rule.backgroundColor,
                textColor: rule.textColor,
                bold: rule.bold,
                italic: rule.italic,
              },
            });
          }
        }
      }
    }
  }
  
  // Check in options
  if (sheetConfig.options?.conditionalFormat) {
    hasConditionalFormat = true;
    const nestedRules = sheetConfig.options.conditionalFormat;
    if (Array.isArray(nestedRules)) {
      for (const rule of nestedRules) {
        conditionalRules.push({
          condition: rule.condition,
          value: rule.value,
          format: {
            backgroundColor: rule.backgroundColor,
            textColor: rule.textColor,
            bold: rule.bold,
            italic: rule.italic,
          },
        });
      }
    }
  }
  
  if (hasConditionalFormat && conditionalRules.length > 0) {
    console.log('[Normalizer] Extracting nested conditionalFormat from format');
    return {
      sheetAction: 'conditionalFormat',
      sheetConfig: { range: targetRange, rules: conditionalRules },
      normalized: true,
    };
  }
  
  return { sheetAction, sheetConfig, normalized: false };
}

/**
 * FIX 3: Flatten nested criteria for validation
 */
function normalizeValidationCriteria(
  sheetAction: string | undefined,
  sheetConfig: Record<string, any>
): { sheetConfig: Record<string, any>; normalized: boolean } {
  if (sheetAction !== 'dataValidation' || !sheetConfig?.criteria) {
    return { sheetConfig, normalized: false };
  }
  
  console.log('[Normalizer] Flattening validation criteria');
  const criteria = sheetConfig.criteria;
  const newConfig = { ...sheetConfig };
  
  if (criteria.minimum !== undefined) newConfig.min = criteria.minimum;
  if (criteria.maximum !== undefined) newConfig.max = criteria.maximum;
  if (criteria.condition === 'between' && !newConfig.validationType) {
    newConfig.validationType = 'number';
  }
  delete newConfig.criteria;
  
  return { sheetConfig: newConfig, normalized: true };
}

/**
 * FIX 4: Extract min/max from command for number validation
 */
function normalizeValidationMinMax(
  sheetAction: string | undefined,
  sheetConfig: Record<string, any>,
  ctx: NormalizationContext
): { sheetConfig: Record<string, any>; normalized: boolean } {
  if (sheetAction !== 'dataValidation' || sheetConfig?.validationType !== 'number') {
    return { sheetConfig, normalized: false };
  }
  if (sheetConfig.min !== undefined && sheetConfig.max !== undefined) {
    return { sheetConfig, normalized: false };
  }
  
  // Try to extract from command
  const betweenMatch = ctx.command.match(/between\s+([\d,]+)\s+and\s+([\d,]+)/i);
  const fromToMatch = ctx.command.match(/from\s+([\d,]+)\s+to\s+([\d,]+)/i);
  const rangeMatch = ctx.command.match(/([\d,]+)\s*[-–]\s*([\d,]+)/);
  
  const match = betweenMatch || fromToMatch || rangeMatch;
  if (match) {
    const num1 = parseInt(match[1].replace(/,/g, ''), 10);
    const num2 = parseInt(match[2].replace(/,/g, ''), 10);
    if (!isNaN(num1) && !isNaN(num2)) {
      console.log('[Normalizer] Extracted min/max from command:', Math.min(num1, num2), Math.max(num1, num2));
      return {
        sheetConfig: {
          ...sheetConfig,
          min: Math.min(num1, num2),
          max: Math.max(num1, num2),
        },
        normalized: true,
      };
    }
  }
  
  return { sheetConfig, normalized: false };
}

/**
 * FIX 5: Correct full-column ranges to data rows only
 */
function normalizeFullColumnRange(
  sheetAction: string | undefined,
  sheetConfig: Record<string, any>,
  ctx: NormalizationContext
): { sheetConfig: Record<string, any>; normalized: boolean } {
  if (sheetAction !== 'dataValidation' || !sheetConfig?.range) {
    return { sheetConfig, normalized: false };
  }
  
  const fullColumnMatch = sheetConfig.range.match(/^([A-Z]+):([A-Z]+)$/i);
  if (!fullColumnMatch || !ctx.dataContext.explicitRowInfo) {
    return { sheetConfig, normalized: false };
  }
  
  const col = fullColumnMatch[1].toUpperCase();
  const startRow = ctx.dataContext.explicitRowInfo.dataStartRow;
  const endRow = ctx.dataContext.explicitRowInfo.dataEndRow;
  const correctedRange = `${col}${startRow}:${col}${endRow}`;
  
  console.log(`[Normalizer] Correcting full-column range ${sheetConfig.range} → ${correctedRange}`);
  
  return {
    sheetConfig: { ...sheetConfig, range: correctedRange },
    normalized: true,
  };
}

/**
 * Infer action type from config structure
 */
function inferActionFromConfig(sheetConfig: Record<string, any>): SheetActionType | undefined {
  if (sheetConfig.chartType) return 'chart';
  if (sheetConfig.tableName !== undefined || sheetConfig.freezeHeader !== undefined) return 'createTable';
  if (sheetConfig.rules) return 'conditionalFormat';
  if (sheetConfig.validationType) return 'dataValidation';
  if (sheetConfig.criteria && !sheetConfig.validationType) return 'filter';
  if (sheetConfig.formatType || sheetConfig.options || sheetConfig.operations) return 'format';
  if (sheetConfig.data) return 'writeData';
  if (sheetConfig.operation) return 'sheetOps';
  return undefined;
}

// ============================================
// EXPORTS
// ============================================

export { COLOR_MAP, extractConditionalRulesFromCommand, inferActionFromConfig };
