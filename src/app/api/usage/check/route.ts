/**
 * Usage Check API
 * 
 * Returns user's current usage, limit, and tier information.
 * Used by frontend to display usage indicator and determine if upgrade needed.
 * 
 * Now also returns managed AI credit status for the free credit system.
 */

import { NextRequest, NextResponse } from 'next/server';
import { canPerformRequest } from '@/lib/auth/gating';
import { canUseManagedCredits, getManagedModelsForTier } from '@/lib/managed-ai';

export async function POST(request: NextRequest) {
  try {
    const { userId, userEmail } = await request.json();
    
    if (!userId && !userEmail) {
      return NextResponse.json(
        { error: 'Missing userId or userEmail' },
        { status: 400 }
      );
    }

    const identifier = userId || userEmail;

    // Check BYOK usage (existing)
    const check = await canPerformRequest(identifier);

    // Check managed AI credit status (new)
    const managedCredits = await canUseManagedCredits(identifier);

    // Get available managed models for this tier
    const managedModels = getManagedModelsForTier(managedCredits.tier).map(m => ({
      id: m.modelId,
      name: m.displayName,
      provider: m.provider,
      tier: m.tier,
    }));

    return NextResponse.json({
      // BYOK usage (existing, unchanged)
      canProceed: check.allowed,
      remaining: check.remaining,
      limit: check.limit,
      tier: check.tier,
      isUnlimited: check.limit === -1,
      needsUpgrade: !check.allowed,
      reason: check.reason,
      // Managed AI credits (new)
      managedCredits: {
        canUse: managedCredits.allowed,
        used_usd: managedCredits.used_usd,
        cap_usd: managedCredits.cap_usd,
        remaining_usd: managedCredits.remaining_usd,
      },
      managedModels,
    });

  } catch (error) {
    console.error('Usage check error:', error);
    return NextResponse.json(
      { error: 'Failed to check usage' },
      { status: 500 }
    );
  }
}
