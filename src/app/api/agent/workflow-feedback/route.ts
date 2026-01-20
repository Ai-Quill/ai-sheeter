/**
 * @file /api/agent/workflow-feedback
 * @version 2.0.0
 * @updated 2026-01-20
 * 
 * Records workflow feedback and stores successful workflows for learning.
 * 
 * CHANGELOG:
 * - 2.0.0 (2026-01-20): Integration with semantic workflow memory
 *   - Stores successful workflows with embeddings
 *   - Enables semantic search for future similar requests
 *   - This is the learning loop that makes the system smarter
 */

import { NextRequest, NextResponse } from 'next/server';
import { storeWorkflowWithEmbedding } from '@/lib/workflow-memory';
import { generateEmbedding } from '@/lib/ai/embeddings';

// ============================================
// TYPES
// ============================================

interface WorkflowFeedbackRequest {
  // The original command from the user
  command: string;
  
  // The workflow that was executed
  workflow: {
    steps: Array<{
      action: string;
      description: string;
      prompt: string;
      outputFormat?: string;
    }>;
    summary?: string;
    clarification?: string;
  };
  
  // Pre-computed embedding (from parse-chain response)
  embedding?: number[];
  
  // Feedback signals
  wasAccepted: boolean;      // User accepted the workflow
  wasModified: boolean;      // User modified before accepting
  executionSuccess: boolean; // Workflow ran without errors
  
  // Optional: detected domain for filtering
  domain?: string;
  
  // Optional: data context (for better future matching)
  dataContext?: {
    dataColumns: string[];
    headers: Record<string, string>;
  };
}

// ============================================
// MAIN HANDLER
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body: WorkflowFeedbackRequest = await request.json();
    const { 
      command,
      workflow,
      embedding,
      wasAccepted,
      wasModified,
      executionSuccess,
      domain,
      dataContext,
    } = body;

    // Validate required fields
    if (!command || !workflow) {
      return NextResponse.json(
        { error: 'command and workflow are required' },
        { status: 400 }
      );
    }

    console.log('[workflow-feedback] Received feedback:', {
      commandPreview: command.substring(0, 50) + '...',
      stepCount: workflow.steps?.length,
      wasAccepted,
      wasModified,
      executionSuccess,
    });

    // Only store successful, unmodified workflows
    // These are the "gold standard" examples we want to learn from
    const shouldStore = wasAccepted && executionSuccess && !wasModified;
    
    if (shouldStore) {
      console.log('[workflow-feedback] Storing successful workflow');
      
      try {
        // Use provided embedding or generate new one
        let workflowEmbedding = embedding;
        if (!workflowEmbedding) {
          workflowEmbedding = await generateEmbedding(command);
        }
        
        // Store for future matching
        const storedId = await storeWorkflowWithEmbedding(
          command,
          workflowEmbedding,
          workflow,
          domain,
          dataContext
        );
        
        if (storedId) {
          console.log('[workflow-feedback] Stored with ID:', storedId);
        }
      } catch (storeError) {
        // Non-critical - log but don't fail
        console.error('[workflow-feedback] Store error:', storeError);
      }
    } else {
      console.log('[workflow-feedback] Not storing (modified or failed):', {
        wasAccepted,
        wasModified,
        executionSuccess,
      });
    }

    // TODO: In the future, we could also:
    // - Store modified workflows to learn user preferences
    // - Track failure patterns to avoid them
    // - Update success rates on similar existing workflows

    return NextResponse.json({ 
      success: true,
      stored: shouldStore,
    });

  } catch (error) {
    console.error('[workflow-feedback] Error:', error);
    // Non-critical endpoint - don't fail hard
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to record feedback',
    });
  }
}
