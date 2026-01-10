/**
 * Jobs API - Async Bulk Processing
 * 
 * Endpoints:
 * - POST /api/jobs - Create a new job
 * - GET /api/jobs - List user's jobs
 * - GET /api/jobs?id=xxx - Get single job status + results
 * - DELETE /api/jobs?id=xxx - Cancel a job
 * 
 * Jobs enable bulk processing (100s of rows) without hitting
 * Google Apps Script 30-second timeout.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

// Validate user via email or userId
async function validateUser(userEmail?: string, userId?: string): Promise<string | null> {
  if (userId) return userId;
  
  if (userEmail) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', userEmail)
      .single();
    
    if (!error && data) return data.id;
  }
  
  return null;
}

/**
 * POST /api/jobs - Create a new async job
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const { 
      userEmail, 
      userId, 
      inputs,      // Array of inputs to process
      config       // { model, specificModel, encryptedApiKey, taskType, prompt? }
    } = await req.json();

    const actualUserId = await validateUser(userEmail, userId);
    if (!actualUserId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
      return NextResponse.json({ error: 'inputs must be a non-empty array' }, { status: 400 });
    }

    if (!config?.model || !config?.encryptedApiKey) {
      return NextResponse.json({ error: 'config.model and config.encryptedApiKey required' }, { status: 400 });
    }

    // Estimate credits (rough: 500 tokens avg per input)
    const estimatedTokens = inputs.length * 500;
    const creditsEstimated = Math.ceil(estimatedTokens * 0.001);  // Rough estimate

    const jobId = uuidv4();
    
    const { error } = await supabaseAdmin
      .from('jobs')
      .insert({
        id: jobId,
        user_id: actualUserId,
        status: 'queued',
        config: {
          model: config.model,
          specificModel: config.specificModel,
          encryptedApiKey: config.encryptedApiKey,
          taskType: config.taskType || 'DEFAULT',
          prompt: config.prompt  // Optional template
        },
        input_data: inputs.map((input: string, index: number) => ({ index, input })),
        total_rows: inputs.length,
        credits_estimated: creditsEstimated,
        progress: 0,
        processed_rows: 0,
        results: []
      });

    if (error) {
      console.error('Error creating job:', error);
      return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
    }

    return NextResponse.json({ 
      jobId,
      status: 'queued',
      totalRows: inputs.length,
      creditsEstimated,
      message: 'Job created. Poll GET /api/jobs?id=<jobId> for status.'
    });

  } catch (error) {
    console.error('Job creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/jobs - List jobs or get single job
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('id');
    const userEmail = searchParams.get('userEmail');
    const userId = searchParams.get('userId');

    const actualUserId = await validateUser(userEmail || undefined, userId || undefined);
    if (!actualUserId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (jobId) {
      // Get single job
      const { data, error } = await supabaseAdmin
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', actualUserId)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }

      return NextResponse.json({
        id: data.id,
        status: data.status,
        progress: data.progress,
        processedRows: data.processed_rows,
        totalRows: data.total_rows,
        creditsUsed: data.credits_used,
        results: data.status === 'completed' ? data.results : [],
        errorMessage: data.error_message,
        createdAt: data.created_at,
        completedAt: data.completed_at
      });
    }

    // List all jobs for user
    const { data, error } = await supabaseAdmin
      .from('jobs')
      .select('id, status, progress, total_rows, processed_rows, created_at, completed_at')
      .eq('user_id', actualUserId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error listing jobs:', error);
      return NextResponse.json({ error: 'Failed to list jobs' }, { status: 500 });
    }

    return NextResponse.json({ jobs: data || [] });

  } catch (error) {
    console.error('Job list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/jobs?id=xxx - Cancel a job
 */
export async function DELETE(req: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('id');
    const userEmail = searchParams.get('userEmail');
    const userId = searchParams.get('userId');

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
    }

    const actualUserId = await validateUser(userEmail || undefined, userId || undefined);
    if (!actualUserId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Only cancel if queued or processing
    const { data, error } = await supabaseAdmin
      .from('jobs')
      .update({ 
        status: 'cancelled',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .eq('user_id', actualUserId)
      .in('status', ['queued', 'processing'])
      .select('id, status')
      .single();

    if (error || !data) {
      return NextResponse.json({ 
        error: 'Job not found or cannot be cancelled' 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      id: data.id, 
      status: 'cancelled',
      message: 'Job cancelled successfully'
    });

  } catch (error) {
    console.error('Job cancel error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
