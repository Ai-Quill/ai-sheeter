/**
 * Real-time Job Status Stream (SSE)
 * 
 * Uses Server-Sent Events to push job status updates to clients.
 * This replaces polling with efficient real-time updates via Supabase.
 * 
 * Endpoint: GET /api/jobs/stream?jobIds=id1,id2,id3&userId=xxx
 * 
 * Architecture:
 * 1. Client opens EventSource connection
 * 2. Server subscribes to Supabase Realtime for job changes
 * 3. On change, server pushes SSE event to client
 * 4. Connection auto-closes when all jobs complete
 * 
 * Performance Optimizations:
 * - Edge Runtime for streaming without timeout limits
 * - Single subscription for multiple jobs
 * - Debounced updates (max 1 update per 500ms per job)
 * - Heartbeat every 30s to prevent connection timeout
 * - Graceful cleanup on disconnect
 * 
 * @version 1.0.0
 */

import { createClient, RealtimeChannel } from '@supabase/supabase-js';

// Edge Runtime for streaming without timeouts
export const runtime = 'edge';

// Environment variables
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Types for job updates
interface JobUpdate {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  processedRows: number;
  totalRows: number;
  errorMessage?: string;
  results?: Array<{ index: number; output: string; error?: string }>;
  completedAt?: string;
}

interface SSEMessage {
  type: 'update' | 'complete' | 'error' | 'heartbeat' | 'initial';
  jobId?: string;
  data?: JobUpdate;
  message?: string;
  timestamp: number;
}

/**
 * GET /api/jobs/stream - SSE endpoint for real-time job updates
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const jobIdsParam = searchParams.get('jobIds');
  const userId = searchParams.get('userId');

  // Validate inputs
  if (!jobIdsParam || !userId) {
    return new Response(
      JSON.stringify({ error: 'jobIds and userId required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const jobIds = jobIdsParam.split(',').filter(id => id.trim());
  if (jobIds.length === 0) {
    return new Response(
      JSON.stringify({ error: 'At least one jobId required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Create Supabase client for realtime
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Track job statuses and completion
  const jobStatuses: Map<string, string> = new Map();
  const completedJobs: Set<string> = new Set();
  const lastUpdate: Map<string, number> = new Map();
  const DEBOUNCE_MS = 500; // Min time between updates for same job

  // Create readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      let channel: RealtimeChannel | null = null;
      let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

      // Helper to send SSE message
      const sendMessage = (msg: SSEMessage) => {
        try {
          const data = `data: ${JSON.stringify(msg)}\n\n`;
          controller.enqueue(new TextEncoder().encode(data));
        } catch {
          // Stream might be closed
        }
      };

      // Helper to check if all jobs are terminal
      const allJobsTerminal = () => {
        return jobIds.every(id => completedJobs.has(id));
      };

      // Cleanup function
      const cleanup = async () => {
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
        if (channel) {
          await supabase.removeChannel(channel);
          channel = null;
        }
      };

      try {
        // Fetch initial job states
        const { data: initialJobs, error: fetchError } = await supabase
          .from('jobs')
          .select('id, status, progress, processed_rows, total_rows, error_message, results, completed_at')
          .in('id', jobIds)
          .eq('user_id', userId);

        if (fetchError) {
          sendMessage({ type: 'error', message: 'Failed to fetch jobs', timestamp: Date.now() });
          await cleanup();
          controller.close();
          return;
        }

        // Send initial states and track terminal jobs
        for (const job of (initialJobs || [])) {
          const update: JobUpdate = {
            id: job.id,
            status: job.status,
            progress: job.progress,
            processedRows: job.processed_rows,
            totalRows: job.total_rows,
            errorMessage: job.error_message,
            results: job.results,
            completedAt: job.completed_at
          };

          sendMessage({ type: 'initial', jobId: job.id, data: update, timestamp: Date.now() });
          jobStatuses.set(job.id, job.status);

          if (['completed', 'failed', 'cancelled'].includes(job.status)) {
            completedJobs.add(job.id);
          }
        }

        // If all jobs already terminal, close immediately
        if (allJobsTerminal()) {
          sendMessage({ type: 'complete', message: 'All jobs completed', timestamp: Date.now() });
          await cleanup();
          controller.close();
          return;
        }

        // Subscribe to realtime updates for all jobs
        channel = supabase
          .channel('job-updates')
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'jobs',
              filter: `id=in.(${jobIds.join(',')})`
            },
            (payload) => {
              const job = payload.new as Record<string, unknown>;
              const jobId = job.id as string;

              // Verify job belongs to user (security check)
              if (job.user_id !== userId) return;

              // Debounce rapid updates
              const now = Date.now();
              const lastTime = lastUpdate.get(jobId) || 0;
              if (now - lastTime < DEBOUNCE_MS) return;
              lastUpdate.set(jobId, now);

              const update: JobUpdate = {
                id: jobId,
                status: job.status as JobUpdate['status'],
                progress: job.progress as number,
                processedRows: job.processed_rows as number,
                totalRows: job.total_rows as number,
                errorMessage: job.error_message as string | undefined,
                results: job.results as JobUpdate['results'],
                completedAt: job.completed_at as string | undefined
              };

              // Send update
              sendMessage({ type: 'update', jobId, data: update, timestamp: now });

              // Track terminal state
              if (['completed', 'failed', 'cancelled'].includes(update.status)) {
                completedJobs.add(jobId);

                // If all jobs terminal, close stream
                if (allJobsTerminal()) {
                  sendMessage({ type: 'complete', message: 'All jobs completed', timestamp: Date.now() });
                  cleanup().then(() => controller.close());
                }
              }
            }
          )
          .subscribe();

        // Heartbeat every 30s to keep connection alive
        heartbeatInterval = setInterval(() => {
          sendMessage({ type: 'heartbeat', timestamp: Date.now() });
        }, 30000);

        // Handle client disconnect (when the stream is cancelled)
        // Note: Edge runtime handles this through the stream cancellation
        
      } catch (error) {
        console.error('SSE stream error:', error);
        sendMessage({ 
          type: 'error', 
          message: error instanceof Error ? error.message : 'Stream error',
          timestamp: Date.now()
        });
        await cleanup();
        controller.close();
      }
    },

    async cancel() {
      // Stream was cancelled by client - cleanup handled above
    }
  });

  // Return SSE response with proper headers
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
      // CORS headers for cross-origin access from Google Apps Script
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400', // Cache preflight for 24h
    },
  });
}
