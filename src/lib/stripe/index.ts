/**
 * Stripe Service - Subscription & Payment Management
 * 
 * Environment Variables Required:
 * - STRIPE_SECRET_KEY: Stripe API key
 * - STRIPE_WEBHOOK_SECRET: Webhook signature verification
 * - STRIPE_PRICE_ID_PRO: Price ID for Pro tier
 * - NEXT_PUBLIC_APP_URL: Base URL for redirects
 * 
 * Pricing Tiers:
 * - Free: 500 requests/month - All features, BYOK
 * - Pro: $14.99/mo - Unlimited requests, All features, BYOK
 * - Legacy: Unlimited free forever (existing users)
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
    features: ['300 queries/month', 'All features included', 'BYOK (your own API keys)', 'Community support']
  },
  pro: {
    name: 'Pro',
    priceMonthly: 14.99,
    priceId: process.env.STRIPE_PRICE_ID_PRO || null,
    requestLimit: -1,  // Unlimited
    features: ['Unlimited queries', 'All features included', 'BYOK (your own API keys)', 'Priority email support', 'Early access to new features']
  },
  legacy: {
    name: 'Legacy',
    priceMonthly: 0,
    priceId: null,
    requestLimit: -1,  // Unlimited
    features: ['Grandfathered unlimited access', 'All features included', 'Thank you for being an early user! ❤️']
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
