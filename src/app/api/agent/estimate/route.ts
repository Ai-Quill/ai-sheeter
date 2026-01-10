/**
 * @file route.ts
 * @path /api/agent/estimate
 * @version 1.0.0
 * @updated 2026-01-10
 * 
 * Cost Estimation for Agent Operations
 * 
 * Estimates the cost of an operation before execution.
 * Uses average token counts per task type for estimation.
 */

import { NextRequest, NextResponse } from 'next/server';

// Average tokens per task type (input + output combined)
const AVG_TOKENS_PER_TASK: Record<string, { input: number; output: number }> = {
  translate: { input: 100, output: 120 },
  summarize: { input: 500, output: 100 },
  extract: { input: 200, output: 50 },
  classify: { input: 100, output: 20 },
  generate: { input: 50, output: 200 },
  clean: { input: 100, output: 100 },
  rewrite: { input: 100, output: 150 },
  custom: { input: 150, output: 150 }
};

// Pricing per 1M tokens (January 2026)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  GEMINI: { input: 0.075, output: 0.30 },
  GROQ: { input: 0.59, output: 0.79 },
  CHATGPT: { input: 0.25, output: 2.00 },
  CLAUDE: { input: 1.00, output: 5.00 }
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rowCount, taskType, model, sampleText } = body;

    if (!rowCount || rowCount < 1) {
      return NextResponse.json(
        { error: 'rowCount is required and must be positive' },
        { status: 400 }
      );
    }

    // Get task-specific token estimates
    const taskTokens = AVG_TOKENS_PER_TASK[taskType?.toLowerCase()] || AVG_TOKENS_PER_TASK.custom;
    
    // If sample text provided, use actual token count (rough estimate: 4 chars = 1 token)
    let inputTokens = taskTokens.input;
    if (sampleText) {
      inputTokens = Math.ceil(sampleText.length / 4);
    }
    const outputTokens = taskTokens.output;

    // Total tokens for all rows
    const totalInputTokens = inputTokens * rowCount;
    const totalOutputTokens = outputTokens * rowCount;
    const totalTokens = totalInputTokens + totalOutputTokens;

    // Get model pricing
    const modelKey = (model || 'GEMINI').toUpperCase();
    const pricing = MODEL_PRICING[modelKey] || MODEL_PRICING.GEMINI;

    // Calculate cost (pricing is per 1M tokens)
    const inputCost = (totalInputTokens / 1_000_000) * pricing.input;
    const outputCost = (totalOutputTokens / 1_000_000) * pricing.output;
    const totalCost = inputCost + outputCost;

    // Estimate time (rough: ~500ms per row for API calls)
    const estimatedSeconds = Math.ceil(rowCount * 0.5);
    const estimatedTime = estimatedSeconds < 60 
      ? `~${estimatedSeconds}s`
      : `~${Math.ceil(estimatedSeconds / 60)}m`;

    return NextResponse.json({
      rowCount,
      model: modelKey,
      taskType: taskType || 'custom',
      tokens: {
        input: totalInputTokens,
        output: totalOutputTokens,
        total: totalTokens
      },
      cost: {
        input: inputCost,
        output: outputCost,
        total: totalCost,
        formatted: totalCost < 0.01 
          ? `<$0.01`
          : `$${totalCost.toFixed(2)}`
      },
      time: {
        seconds: estimatedSeconds,
        formatted: estimatedTime
      },
      breakdown: {
        perRow: {
          tokens: inputTokens + outputTokens,
          cost: totalCost / rowCount
        }
      }
    });

  } catch (error) {
    console.error('Agent estimate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
