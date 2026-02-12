/**
 * Managed AI Module - Pooled API Key Service
 * 
 * Provides managed AI access using platform-owned API keys.
 * Users don't need their own keys — credits are tracked per user.
 * 
 * Tiers:
 * - Free: Mini models only (GPT-5 Mini, Gemini 2.5 Flash, Haiku, Llama 4 Scout)
 *         ~50 queries/month ($0.015 cap)
 * - Pro:  Mini + mid-tier (adds GPT-5, Claude Sonnet 4.5, Gemini 2.5 Pro)
 *         $4.99/month cap
 * - Legacy: Grandfathered free users with unlimited BYOK access.
 *           No managed credits — they use their own API keys.
 * 
 * Cost tracking: Per-query cost calculated from actual token usage,
 * debited from user's monthly managed credit balance.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import type { AIProvider } from '@/lib/ai/models';
import type { PlanTier } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';

// ============================================
// TYPES
// ============================================

export interface ManagedModelInfo {
  provider: AIProvider;
  modelId: string;
  displayName: string;
  costPer1kTokens: number;
  tier: 'mini' | 'mid';
}

export interface ManagedCreditStatus {
  allowed: boolean;
  used_usd: number;
  cap_usd: number;
  remaining_usd: number;
  tier: PlanTier;
  reason?: string;
}

// ============================================
// MODEL REGISTRY
// ============================================

/**
 * All managed models with their cost and tier classification.
 * Costs are blended input/output per 1K tokens.
 */
export const MANAGED_MODEL_REGISTRY: Record<string, ManagedModelInfo> = {
  // Mini tier (available to Free + Pro)
  'gpt-5-mini': {
    provider: 'CHATGPT',
    modelId: 'gpt-5-mini',
    displayName: 'GPT-5 Mini',
    costPer1kTokens: 0.00083,    // $0.25/$2 per MTok (2:1 blended)
    tier: 'mini',
  },
  'gemini-2.5-flash': {
    provider: 'GEMINI',
    modelId: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    costPer1kTokens: 0.0003,     // $0.15/$0.60 per MTok (2:1 blended)
    tier: 'mini',
  },
  'claude-haiku-4-5': {
    provider: 'CLAUDE',
    modelId: 'claude-haiku-4-5',
    displayName: 'Claude Haiku 4.5',
    costPer1kTokens: 0.00233,    // $1/$5 per MTok (2:1 blended)
    tier: 'mini',
  },
  'meta-llama/llama-4-scout-17b-16e-instruct': {
    provider: 'GROQ',
    modelId: 'meta-llama/llama-4-scout-17b-16e-instruct',
    displayName: 'Llama 4 Scout (Groq)',
    costPer1kTokens: 0.000187,   // $0.11/$0.34 per MTok (2:1 blended) — supports structured outputs
    tier: 'mini',
  },
  // Mid tier (Pro + Legacy only)
  'gpt-5': {
    provider: 'CHATGPT',
    modelId: 'gpt-5',
    displayName: 'GPT-5',
    costPer1kTokens: 0.00417,    // $1.25/$10 per MTok (2:1 blended)
    tier: 'mid',
  },
  'claude-sonnet-4-5': {
    provider: 'CLAUDE',
    modelId: 'claude-sonnet-4-5',
    displayName: 'Claude Sonnet 4.5',
    costPer1kTokens: 0.007,      // $3/$15 per MTok (2:1 blended)
    tier: 'mid',
  },
  'gemini-2.5-pro': {
    provider: 'GEMINI',
    modelId: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    costPer1kTokens: 0.00417,    // $1.25/$10 per MTok (2:1 blended)
    tier: 'mid',
  },
  'meta-llama/llama-4-maverick-17b-128e-instruct': {
    provider: 'GROQ',
    modelId: 'meta-llama/llama-4-maverick-17b-128e-instruct',
    displayName: 'Llama 4 Maverick (Groq)',
    costPer1kTokens: 0.000333,   // $0.20/$0.60 per MTok (2:1 blended) — supports structured outputs
    tier: 'mid',
  },
};

/**
 * Models allowed per pricing tier
 */
export const TIER_MODEL_ALLOWLIST: Record<PlanTier, string[]> = {
  free: [
    'gpt-5-mini',
    'gemini-2.5-flash',
    'claude-haiku-4-5',
    'meta-llama/llama-4-scout-17b-16e-instruct',
  ],
  pro: [
    'gpt-5-mini',
    'gemini-2.5-flash',
    'claude-haiku-4-5',
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'gpt-5',
    'claude-sonnet-4-5',
    'gemini-2.5-pro',
    'meta-llama/llama-4-maverick-17b-128e-instruct',
  ],
  legacy: [
    'gpt-5-mini',
    'gemini-2.5-flash',
    'claude-haiku-4-5',
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'gpt-5',
    'claude-sonnet-4-5',
    'gemini-2.5-pro',
    'meta-llama/llama-4-maverick-17b-128e-instruct',
  ],
};

/**
 * Default managed model per tier (cheapest efficient option)
 */
export const DEFAULT_MANAGED_MODEL: Record<PlanTier, string> = {
  free: 'gemini-2.5-flash',
  pro: 'gpt-5-mini',
  legacy: 'gpt-5-mini',
};

/**
 * Managed credit caps per tier (USD/month)
 * 
 * Legacy users are grandfathered free users with unlimited BYOK access.
 * They use their own API keys — no managed credits needed.
 */
export const MANAGED_CREDIT_CAPS: Record<PlanTier, number> = {
  free: 0.015,   // ~50 queries on mini models
  pro: 4.99,     // generous cap, mini + mid-tier
  legacy: 0,     // legacy = free users grandfathered with unlimited BYOK, no managed credits
};

// ============================================
// ENVIRONMENT KEYS
// ============================================

/**
 * Get managed API key for a provider from environment variables.
 * These are platform-owned keys, NOT user keys.
 */
function getManagedApiKey(provider: AIProvider): string | null {
  switch (provider) {
    case 'CHATGPT':
      return process.env.MANAGED_OPENAI_API_KEY || null;
    case 'CLAUDE':
      return process.env.MANAGED_ANTHROPIC_API_KEY || null;
    case 'GEMINI':
      return process.env.MANAGED_GOOGLE_API_KEY || null;
    case 'GROQ':
      return process.env.MANAGED_GROQ_API_KEY || null;
    default:
      return null;
  }
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Check if a model is allowed for the given tier in managed mode.
 */
export function isManagedModelAllowed(modelId: string, tier: PlanTier): boolean {
  const allowlist = TIER_MODEL_ALLOWLIST[tier];
  return allowlist?.includes(modelId) ?? false;
}

/**
 * Get a managed model instance using platform API keys.
 * Returns null if the model is not available or key is missing.
 */
export function getManagedModel(
  modelId: string,
  tier: PlanTier
): { model: LanguageModel; provider: AIProvider; modelId: string } | null {
  // Validate model is allowed for tier
  if (!isManagedModelAllowed(modelId, tier)) {
    return null;
  }

  const modelInfo = MANAGED_MODEL_REGISTRY[modelId];
  if (!modelInfo) {
    return null;
  }

  // Get platform API key for this provider
  const apiKey = getManagedApiKey(modelInfo.provider);
  if (!apiKey) {
    console.warn(`Managed API key not configured for provider: ${modelInfo.provider}`);
    return null;
  }

  // Create model instance using platform key
  let model: LanguageModel;
  switch (modelInfo.provider) {
    case 'CHATGPT':
      model = createOpenAI({ apiKey })(modelInfo.modelId);
      break;
    case 'CLAUDE':
      model = createAnthropic({ apiKey })(modelInfo.modelId);
      break;
    case 'GEMINI':
      model = createGoogleGenerativeAI({ apiKey })(modelInfo.modelId);
      break;
    case 'GROQ':
      model = createOpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' })(modelInfo.modelId);
      break;
    default:
      return null;
  }

  return { model, provider: modelInfo.provider, modelId: modelInfo.modelId };
}

/**
 * Calculate the cost of a query based on actual token usage.
 * Returns cost in USD.
 */
export function calculateQueryCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const modelInfo = MANAGED_MODEL_REGISTRY[modelId];
  if (!modelInfo) {
    // Fallback: use a conservative estimate
    return ((inputTokens + outputTokens) / 1000) * 0.001;
  }

  const totalTokens = inputTokens + outputTokens;
  return (totalTokens / 1000) * modelInfo.costPer1kTokens;
}

/**
 * Check if a user can use managed credits.
 * Handles period auto-reset.
 */
export async function canUseManagedCredits(
  userIdOrEmail: string
): Promise<ManagedCreditStatus> {
  const isEmail = userIdOrEmail.includes('@');

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, plan_tier, managed_credits_used_usd, managed_credits_cap_usd, managed_credits_reset_at')
    .eq(isEmail ? 'email' : 'id', userIdOrEmail)
    .single();

  if (error || !data) {
    return {
      allowed: false,
      used_usd: 0,
      cap_usd: 0,
      remaining_usd: 0,
      tier: 'free',
      reason: 'User not found',
    };
  }

  const tier = (data.plan_tier || 'free') as PlanTier;
  let used = Number(data.managed_credits_used_usd) || 0;
  const cap = Number(data.managed_credits_cap_usd) || MANAGED_CREDIT_CAPS[tier];
  const resetAt = new Date(data.managed_credits_reset_at);

  // Auto-reset if period expired
  if (resetAt < new Date()) {
    used = 0;
    // Reset in DB (fire-and-forget, the DB function handles it atomically)
    await supabaseAdmin.rpc('reset_managed_credits', { p_user_id: data.id });
  }

  const remaining = Math.max(0, cap - used);
  const allowed = used < cap;

  return {
    allowed,
    used_usd: used,
    cap_usd: cap,
    remaining_usd: remaining,
    tier,
    reason: allowed ? undefined : `Managed AI credits exhausted ($${cap.toFixed(2)}/month). Use your own API key for unlimited access, or upgrade to Pro.`,
  };
}

/**
 * Debit managed credits after a query.
 * Returns the new used amount.
 */
export async function debitManagedCredits(
  userId: string,
  costUsd: number
): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc('debit_managed_credits', {
    p_user_id: userId,
    p_cost_usd: costUsd,
  });

  if (error) {
    console.error('Failed to debit managed credits:', error);
    return -1;
  }

  return data || 0;
}

/**
 * Get the list of managed models available for a tier.
 * Used by frontend to populate model selector in managed mode.
 */
export function getManagedModelsForTier(tier: PlanTier): ManagedModelInfo[] {
  const allowlist = TIER_MODEL_ALLOWLIST[tier] || TIER_MODEL_ALLOWLIST.free;
  return allowlist
    .map((id) => MANAGED_MODEL_REGISTRY[id])
    .filter(Boolean);
}
