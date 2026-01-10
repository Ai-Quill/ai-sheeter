/**
 * Stripe Service - Subscription & Payment Management
 * 
 * Environment Variables Required:
 * - STRIPE_SECRET_KEY: Stripe API key
 * - STRIPE_WEBHOOK_SECRET: Webhook signature verification
 * - NEXT_PUBLIC_APP_URL: Base URL for redirects
 * 
 * Pricing Tiers:
 * - Starter: $9/mo - 1,000 credits
 * - Pro: $29/mo - 5,000 credits  
 * - Power: $79/mo - Unlimited
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
  starter: {
    name: 'Starter',
    priceMonthly: 9,
    credits: 1000,
    features: ['Basic AI queries', 'Email support', '10 async jobs/day']
  },
  pro: {
    name: 'Pro',
    priceMonthly: 29,
    credits: 5000,
    features: ['All AI models', 'Priority support', '100 async jobs/day', 'Response caching']
  },
  power: {
    name: 'Power',
    priceMonthly: 79,
    credits: -1,  // Unlimited
    features: ['Unlimited credits (BYOK)', 'Dedicated support', 'Unlimited async jobs', 'Custom prompts']
  }
} as const;

export type PlanTier = keyof typeof PRICING_TIERS | 'free' | 'legacy';

// Credit limits per tier
export function getCreditsForTier(tier: PlanTier): number {
  switch (tier) {
    case 'starter': return 1000;
    case 'pro': return 5000;
    case 'power': return -1;  // Unlimited
    case 'legacy': return -1;  // Grandfathered unlimited BYOK
    case 'free': return 100;   // Trial credits
    default: return 0;
  }
}

// Check if tier has BYOK privileges
export function hasBYOKPrivileges(tier: PlanTier): boolean {
  return tier === 'legacy' || tier === 'power';
}
