/**
 * Usage Check API
 * 
 * Returns user's current usage, limit, and tier information.
 * Used by frontend to display usage indicator and determine if upgrade needed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { canPerformRequest } from '@/lib/auth/gating';

export async function POST(request: NextRequest) {
  try {
    const { userId, userEmail } = await request.json();
    
    if (!userId && !userEmail) {
      return NextResponse.json(
        { error: 'Missing userId or userEmail' },
        { status: 400 }
      );
    }

    const check = await canPerformRequest(userId || userEmail);

    return NextResponse.json({
      canProceed: check.allowed,
      remaining: check.remaining,
      limit: check.limit,
      tier: check.tier,
      isUnlimited: check.limit === -1,
      needsUpgrade: !check.allowed,
      reason: check.reason
    });

  } catch (error) {
    console.error('Usage check error:', error);
    return NextResponse.json(
      { error: 'Failed to check usage' },
      { status: 500 }
    );
  }
}
