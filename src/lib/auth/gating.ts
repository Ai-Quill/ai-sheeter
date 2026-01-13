/**
 * Feature Gating & Request Management
 * 
 * Controls access to features based on user's subscription tier.
 * Enforces request limits per tier:
 * - Free: 500 requests/month
 * - Pro: Unlimited
 * - Legacy: Unlimited (grandfathered)
 */

import { supabaseAdmin } from '@/lib/supabase';
import { getCreditsForTier, hasBYOKPrivileges, getRequestLimitForTier, hasUnlimitedAccess, type PlanTier } from '@/lib/stripe';

export interface UserAccess {
  userId: string;
  email: string;
  tier: PlanTier;
  creditsBalance: number;
  creditsLimit: number;
  isLegacy: boolean;
  hasBYOK: boolean;
}

export interface AccessCheck {
  allowed: boolean;
  reason?: string;
  userAccess?: UserAccess;
}

/**
 * Get user's access level and credits
 */
export async function getUserAccess(userIdOrEmail: string): Promise<UserAccess | null> {
  const isEmail = userIdOrEmail.includes('@');
  
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email, plan_tier, credits_balance, is_legacy_user')
    .eq(isEmail ? 'email' : 'id', userIdOrEmail)
    .single();

  if (error || !data) {
    return null;
  }

  const tier = (data.plan_tier || 'free') as PlanTier;

  return {
    userId: data.id,
    email: data.email,
    tier,
    creditsBalance: data.credits_balance || 0,
    creditsLimit: getCreditsForTier(tier),
    isLegacy: data.is_legacy_user || false,
    hasBYOK: hasBYOKPrivileges(tier) || data.is_legacy_user
  };
}

/**
 * Check if user can perform a query
 * @param estimatedCredits - Estimated credits for this operation
 */
export async function canPerformQuery(
  userIdOrEmail: string, 
  estimatedCredits: number = 1
): Promise<AccessCheck> {
  const access = await getUserAccess(userIdOrEmail);
  
  if (!access) {
    return { allowed: false, reason: 'User not found' };
  }

  // BYOK users (legacy, power) have unlimited access
  if (access.hasBYOK) {
    return { allowed: true, userAccess: access };
  }

  // Check credits
  if (access.creditsBalance < estimatedCredits) {
    return { 
      allowed: false, 
      reason: `Insufficient credits. You have ${access.creditsBalance}, need ${estimatedCredits}.`,
      userAccess: access
    };
  }

  return { allowed: true, userAccess: access };
}

/**
 * Check if user can create async jobs
 */
export async function canCreateJob(
  userIdOrEmail: string,
  rowCount: number
): Promise<AccessCheck> {
  const access = await getUserAccess(userIdOrEmail);
  
  if (!access) {
    return { allowed: false, reason: 'User not found' };
  }

  // Job limits by tier
  const dailyJobLimits: Record<PlanTier, number> = {
    free: 0,       // No async jobs on free tier
    legacy: -1,    // Unlimited
    starter: 10,
    pro: 100,
    power: -1      // Unlimited
  };

  const jobLimit = dailyJobLimits[access.tier];

  if (jobLimit === 0) {
    return { 
      allowed: false, 
      reason: 'Async jobs require a paid subscription.',
      userAccess: access
    };
  }

  // Check daily job count (skip for unlimited tiers)
  if (jobLimit > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count } = await supabaseAdmin
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', access.userId)
      .gte('created_at', today.toISOString());

    if ((count || 0) >= jobLimit) {
      return { 
        allowed: false, 
        reason: `Daily job limit reached (${jobLimit} jobs/day). Upgrade for more.`,
        userAccess: access
      };
    }
  }

  // Row count limits
  const maxRowsPerJob: Record<PlanTier, number> = {
    free: 0,
    legacy: 1000,
    starter: 100,
    pro: 500,
    power: 1000
  };

  if (rowCount > maxRowsPerJob[access.tier]) {
    return {
      allowed: false,
      reason: `Job too large. Max ${maxRowsPerJob[access.tier]} rows per job on ${access.tier} plan.`,
      userAccess: access
    };
  }

  return { allowed: true, userAccess: access };
}

/**
 * Deduct credits from user (for managed credits, not BYOK)
 */
export async function deductCredits(
  userId: string, 
  amount: number
): Promise<{ success: boolean; newBalance: number }> {
  const { data, error } = await supabaseAdmin.rpc('deduct_credits', {
    p_user_id: userId,
    p_amount: amount
  });

  if (error) {
    console.error('Credit deduction failed:', error);
    return { success: false, newBalance: -1 };
  }

  return { success: true, newBalance: data || 0 };
}

/**
 * Check if user has access to a specific model
 */
export function canUseModel(tier: PlanTier, model: string): boolean {
  // Premium models restricted by tier
  const premiumModels = [
    'gpt-5.2',
    'claude-opus-4-5',
    'gemini-3-pro'
  ];

  // Free tier: only basic models
  if (tier === 'free') {
    return !premiumModels.includes(model);
  }

  // All paid tiers get all models
  return true;
}

/**
 * Check if user can perform a request (new request-based system)
 * Returns: { allowed: boolean, remaining: number, limit: number, tier: PlanTier }
 */
export async function canPerformRequest(
  userIdOrEmail: string
): Promise<{
  allowed: boolean;
  reason?: string;
  remaining: number;
  limit: number;
  tier: PlanTier;
}> {
  const isEmail = userIdOrEmail.includes('@');
  
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email, plan_tier, is_legacy_user, requests_this_period, period_end')
    .eq(isEmail ? 'email' : 'id', userIdOrEmail)
    .single();

  if (error || !data) {
    return { 
      allowed: false, 
      reason: 'User not found',
      remaining: 0,
      limit: 0,
      tier: 'free'
    };
  }

  const tier = (data.plan_tier || 'free') as PlanTier;
  const limit = getRequestLimitForTier(tier);

  // Legacy and Pro users have unlimited
  if (tier === 'legacy' || tier === 'pro' || hasUnlimitedAccess(tier)) {
    return { 
      allowed: true,
      remaining: -1,  // Unlimited
      limit: -1,
      tier
    };
  }

  // Check if period has ended (auto-reset happens in database function)
  const periodEnd = new Date(data.period_end);
  const now = new Date();
  
  let used = data.requests_this_period || 0;
  
  // If period ended, count will be reset by database function
  if (periodEnd < now) {
    used = 0;
  }

  const remaining = Math.max(0, limit - used);
  const canProceed = used < limit;

  if (!canProceed) {
    return { 
      allowed: false, 
      reason: `Monthly limit reached (${limit} requests). Upgrade to Pro for unlimited access!`,
      remaining: 0,
      limit,
      tier
    };
  }

  return { 
    allowed: true,
    remaining,
    limit,
    tier
  };
}

/**
 * Increment user's request count
 */
export async function incrementRequestCount(userId: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc('increment_request_count', {
    p_user_id: userId
  });

  if (error) {
    console.error('Failed to increment request count:', error);
  }
}
