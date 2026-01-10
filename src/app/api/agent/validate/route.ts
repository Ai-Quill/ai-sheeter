/**
 * @file route.ts
 * @path /api/agent/validate
 * @version 1.0.0
 * @updated 2026-01-10
 * 
 * Plan Validation for Agent Operations
 * 
 * Validates a parsed plan before execution:
 * - Checks for potential issues
 * - Warns about destructive operations
 * - Suggests improvements
 */

import { NextRequest, NextResponse } from 'next/server';

interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  suggestions: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { plan, context } = body;

    const result: ValidationResult = {
      valid: true,
      warnings: [],
      errors: [],
      suggestions: []
    };

    // Validate required fields
    if (!plan) {
      result.valid = false;
      result.errors.push('No plan provided');
      return NextResponse.json(result);
    }

    // 1. Check prompt is not empty
    if (!plan.prompt || plan.prompt.trim() === '') {
      result.valid = false;
      result.errors.push('Prompt cannot be empty');
    }

    // 2. Check input range format
    if (plan.inputRange) {
      const rangePattern = /^[A-Z]+\d*:[A-Z]+\d*$/i;
      if (!rangePattern.test(plan.inputRange)) {
        result.valid = false;
        result.errors.push(`Invalid input range format: ${plan.inputRange}`);
      }
    } else {
      result.valid = false;
      result.errors.push('Input range is required');
    }

    // 3. Check output columns
    if (!plan.outputColumns || plan.outputColumns.length === 0) {
      result.valid = false;
      result.errors.push('At least one output column is required');
    } else {
      // Check each column is a valid letter
      for (const col of plan.outputColumns) {
        if (!/^[A-Z]$/i.test(col)) {
          result.valid = false;
          result.errors.push(`Invalid output column: ${col}`);
        }
      }
    }

    // 4. Check for potential overwrite (if context provided)
    if (context?.outputHasData && plan.outputColumns) {
      result.warnings.push(
        `Column${plan.outputColumns.length > 1 ? 's' : ''} ${plan.outputColumns.join(', ')} ` +
        `already contain${plan.outputColumns.length > 1 ? '' : 's'} data. They will be overwritten.`
      );
    }

    // 5. Check for same input/output column
    if (plan.inputRange && plan.outputColumns) {
      const inputCol = plan.inputRange.match(/^([A-Z]+)/i)?.[1]?.toUpperCase();
      for (const outCol of plan.outputColumns) {
        if (outCol.toUpperCase() === inputCol) {
          result.warnings.push(
            `Output column ${outCol} is the same as input column. ` +
            `This will overwrite your source data.`
          );
        }
      }
    }

    // 6. Check row count warnings
    if (context?.rowCount) {
      if (context.rowCount > 500) {
        result.warnings.push(
          `Processing ${context.rowCount} rows may take several minutes. ` +
          `Consider testing with a smaller range first.`
        );
      }
      if (context.rowCount > 2000) {
        result.warnings.push(
          `Processing ${context.rowCount} rows may be slow and expensive. ` +
          `Consider breaking into smaller batches.`
        );
      }
    }

    // 7. Suggestions based on task type
    if (plan.taskType === 'translate' && plan.outputColumns?.length === 1) {
      result.suggestions.push(
        'Tip: You can translate to multiple languages at once. ' +
        'Example: "Translate to Spanish, French, German in B, C, D"'
      );
    }

    if (plan.taskType === 'extract' && !plan.prompt.toLowerCase().includes('only')) {
      result.suggestions.push(
        'Tip: Add "return only the [emails/numbers/names]" to your prompt ' +
        'for cleaner output.'
      );
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Agent validate error:', error);
    return NextResponse.json(
      { 
        valid: false, 
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings: [],
        suggestions: []
      },
      { status: 500 }
    );
  }
}
