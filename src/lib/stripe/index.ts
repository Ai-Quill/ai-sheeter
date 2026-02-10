/**
 * Stripe Service - Subscription & Payment Management
 * 
 * Environment Variables Required:
 * - STRIPE_SECRET_KEY: Stripe API key
 * - STRIPE_WEBHOOK_SECRET: Webhook signature verification
 * - STRIPE_PRICE_ID_PRO: Price ID for Pro tier
 * - NEXT_PUBLIC_APP_URL: Base URL for redirects
 * - MANAGED_OPENAI_API_KEY: Platform OpenAI key for managed credits
 * - MANAGED_ANTHROPIC_API_KEY: Platform Anthropic key for managed credits
 * - MANAGED_GOOGLE_API_KEY: Platform Google key for managed credits
 * - MANAGED_GROQ_API_KEY: Platform Groq key for managed credits
 * 
 * Pricing Tiers:
 * - Free: 300 BYOK requests/month + 50 managed AI queries (~$0.015 cap)
 * - Pro: $14.99/mo - Unlimited BYOK + $4.99/mo managed AI credits
 * - Legacy: Unlimited free forever (existing users) + $4.99/mo managed credits
 */

import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY not set - Stripe features disabled');
}

export const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    })
  : null;

// Pricing configuration
export const PRICING_TIERS = {
  free: {
    name: 'Free',
    priceMonthly: 0,
    priceId: null,
    requestLimit: 300,
    managedCreditsCap: 0.015,  // ~50 queries on mini models
    features: [
      '50 free AI queries/month (no setup needed!)',
      '300 BYOK queries/month',
      'All features included',
      'BYOK (your own API keys)',
      'Community support',
    ]
  },
  pro: {
    name: 'Pro',
    priceMonthly: 14.99,
    priceId: process.env.STRIPE_PRICE_ID_PRO || null,
    requestLimit: -1,  // Unlimited
    managedCreditsCap: 4.99,   // $4.99/month managed AI credits
    features: [
      '$4.99/mo managed AI credits included',
      'GPT-5, Claude Sonnet 4.5, Gemini 2.5 Pro',
      'Unlimited BYOK queries',
      'BYOK (your own API keys)',
      'Priority email support',
      'Persistent conversation memory',
      'Early access to new features',
    ]
  },
  legacy: {
    name: 'Legacy',
    priceMonthly: 0,
    priceId: null,
    requestLimit: -1,  // Unlimited
    managedCreditsCap: 4.99,   // Same as Pro
    features: ['Grandfathered unlimited access', 'All features included', '$4.99/mo managed AI credits', 'Thank you for being an early user! ❤️']
  }
} as const;

export type PlanTier = 'free' | 'pro' | 'legacy';

// Request limits per tier
export function getRequestLimitForTier(tier: PlanTier): number {
  switch (tier) {
    case 'free': return 500;
    case 'pro': return -1;     // Unlimited
    case 'legacy': return -1;  // Unlimited
    default: return 0;
  }
}

// Check if tier has unlimited access
export function hasUnlimitedAccess(tier: PlanTier): boolean {
  return tier === 'legacy' || tier === 'pro';
}

// Legacy function - kept for backward compatibility
export function getCreditsForTier(tier: PlanTier): number {
  return getRequestLimitForTier(tier);
}

// Legacy function - kept for backward compatibility  
export function hasBYOKPrivileges(tier: PlanTier): boolean {
  return true; // All tiers use BYOK now
}
