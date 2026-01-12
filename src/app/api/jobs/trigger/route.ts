/**
 * Lightweight Job Trigger Endpoint
 * 
 * Returns immediately after triggering the worker.
 * This allows Apps Script to trigger job processing without blocking.
 * 
 * POST /api/jobs/trigger
 * Body: { jobIds: string[] }
 * 
 * @version 1.0.0
 */

import { NextResponse } from 'next/server';

// Use Edge Runtime for fast response
export const runtime = 'edge';

/**
 * POST /api/jobs/trigger - Trigger worker to process jobs
 * Returns immediately - actual processing happens async
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const jobIds = body.jobIds || [];
    
    // Get the worker URL
    const baseUrl = process.env.NEXT_PUBLIC_API_URL 
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    
    // Trigger worker in background - don't await
    // Using waitUntil if available (Vercel Edge), otherwise fire-and-forget
    const workerPromise = fetch(`${baseUrl}/api/jobs/worker`, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store',
        'X-Trigger-Source': 'api-trigger',
        ...(process.env.CRON_SECRET ? { 'Authorization': `Bearer ${process.env.CRON_SECRET}` } : {})
      }
    }).catch(err => {
      console.log('[Trigger] Worker call failed:', err.message);
    });

    // In Edge Runtime, we can use waitUntil to keep the function alive
    // while returning immediately to the client
    const ctx = (globalThis as unknown as { waitUntil?: (promise: Promise<unknown>) => void });
    if (ctx.waitUntil) {
      ctx.waitUntil(workerPromise);
    }
    
    // Return immediately
    return NextResponse.json({
      triggered: true,
      jobCount: jobIds.length,
      message: 'Worker triggered'
    });
    
  } catch (error) {
    console.error('[Trigger] Error:', error);
    return NextResponse.json({
      triggered: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * GET handler for simple trigger
 */
export async function GET(): Promise<Response> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL 
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  
  // Fire-and-forget
  fetch(`${baseUrl}/api/jobs/worker`, {
    method: 'GET',
    headers: {
      'Cache-Control': 'no-cache, no-store',
      ...(process.env.CRON_SECRET ? { 'Authorization': `Bearer ${process.env.CRON_SECRET}` } : {})
    }
  }).catch(() => {});
  
  return NextResponse.json({ triggered: true });
}
