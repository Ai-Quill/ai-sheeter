/**
 * @file /api/agent/workflow-feedback
 * @version 1.0.0
 * @updated 2026-01-19
 * 
 * Records workflow feedback to improve future suggestions.
 * Called by frontend after workflow execution completes.
 */

import { NextRequest, NextResponse } from 'next/server';
import workflowLearning from '@/lib/workflow-learning';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      workflowId, 
      wasAccepted, 
      wasModified, 
      finalSteps, 
      executionSuccess 
    } = body;

    if (!workflowId) {
      return NextResponse.json(
        { error: 'workflowId is required' },
        { status: 400 }
      );
    }

    // Record feedback (non-blocking)
    await workflowLearning.recordFeedback({
      workflowId,
      wasAccepted: wasAccepted ?? true,
      wasModified: wasModified ?? false,
      finalSteps,
      executionSuccess,
    });

    console.log('[workflow-feedback] Recorded:', {
      workflowId,
      wasAccepted,
      wasModified,
      executionSuccess,
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Workflow feedback error:', error);
    // Non-critical endpoint - don't fail hard
    return NextResponse.json({ success: false, error: 'Failed to record feedback' });
  }
}
