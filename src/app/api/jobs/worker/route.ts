/**
 * Job Worker - Processes queued async jobs
 * 
 * Triggered by:
 * - Vercel Cron (every minute)
 * - Manual POST request (for testing)
 * 
 * Flow:
 * 1. Pick next queued job (with locking)
 * 2. Process each input row
 * 3. Update progress/results in real-time
 * 4. Mark complete/failed
 * 
 * @see vercel.json for cron config
 */

import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { supabaseAdmin } from '@/lib/supabase';
import { decryptApiKey } from '@/utils/encryption';
import { getModel, type AIProvider } from '@/lib/ai/models';
import { getSystemPrompt, type TaskType } from '@/lib/prompts';
import { generateCacheKey, getFromCache, setCache } from '@/lib/cache';

interface JobConfig {
  model: AIProvider;
  specificModel: string;
  encryptedApiKey: string;
  taskType?: TaskType;
  prompt?: string;  // Optional template like "Summarize: {input}"
}

interface InputRow {
  index: number;
  input: string;
}

interface ResultRow {
  index: number;
  input: string;
  output: string;
  tokens: number;
  cached: boolean;
  error?: string;
}

// Verify cron secret (set in Vercel environment)
function verifyCronSecret(req: Request): boolean {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // Allow if no secret configured (dev mode)
  if (!cronSecret) return true;
  
  return authHeader === `Bearer ${cronSecret}`;
}

export async function POST(req: Request): Promise<Response> {
  // Verify this is a legitimate cron/worker call
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get next queued job using atomic lock
    const { data: jobId } = await supabaseAdmin.rpc('get_next_job');
    
    if (!jobId) {
      return NextResponse.json({ message: 'No jobs queued' });
    }

    // Fetch full job data
    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const config: JobConfig = job.config;
    const inputs: InputRow[] = job.input_data;
    const results: ResultRow[] = job.results || [];
    
    // Decrypt API key
    const apiKey = decryptApiKey(config.encryptedApiKey);
    if (!apiKey) {
      await markJobFailed(jobId, 'Invalid API key');
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // Get system prompt
    const systemPrompt = getSystemPrompt(config.taskType || 'DEFAULT');
    
    let totalTokens = 0;
    let processedCount = job.processed_rows || 0;

    // Process each input row
    for (const row of inputs) {
      // Skip already processed rows (for resume after failure)
      if (results.some(r => r.index === row.index)) continue;

      // Check if job was cancelled
      const { data: checkJob } = await supabaseAdmin
        .from('jobs')
        .select('status')
        .eq('id', jobId)
        .single();
      
      if (checkJob?.status === 'cancelled') {
        return NextResponse.json({ message: 'Job cancelled', processedCount });
      }

      try {
        // Apply prompt template if provided
        const userInput = config.prompt 
          ? config.prompt.replace('{input}', row.input)
          : row.input;

        // Check cache first
        const cacheKey = generateCacheKey(config.specificModel, systemPrompt, userInput);
        const cacheResult = await getFromCache(cacheKey);

        let output: string;
        let tokens: number;
        let cached: boolean;

        if (cacheResult.cached) {
          output = cacheResult.response;
          tokens = cacheResult.tokensUsed;
          cached = true;
        } else {
          // Call AI
          const { text, usage } = await generateText({
            model: getModel(config.model, config.specificModel, apiKey),
            system: systemPrompt,
            messages: [{ role: 'user', content: userInput }],
            maxOutputTokens: 2000,  // Lower for bulk ops
          });

          output = text;
          tokens = (usage?.inputTokens || 0) + (usage?.outputTokens || 0);
          cached = false;

          // Store in cache
          await setCache(cacheKey, config.specificModel, cacheKey.slice(0, 16), text, tokens);
        }

        results.push({
          index: row.index,
          input: row.input,
          output,
          tokens,
          cached
        });

        totalTokens += tokens;
        processedCount++;

        // Update progress every 5 rows or on completion
        if (processedCount % 5 === 0 || processedCount === inputs.length) {
          const progress = Math.round((processedCount / inputs.length) * 100);
          await supabaseAdmin
            .from('jobs')
            .update({
              progress,
              processed_rows: processedCount,
              results,
              credits_used: Math.ceil(totalTokens * 0.001)
            })
            .eq('id', jobId);
        }

      } catch (rowError) {
        // Log row error but continue processing
        results.push({
          index: row.index,
          input: row.input,
          output: '',
          tokens: 0,
          cached: false,
          error: rowError instanceof Error ? rowError.message : 'Processing failed'
        });
        processedCount++;
      }
    }

    // Mark job as completed
    await supabaseAdmin
      .from('jobs')
      .update({
        status: 'completed',
        progress: 100,
        processed_rows: processedCount,
        results,
        credits_used: Math.ceil(totalTokens * 0.001),
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    // Log usage
    await supabaseAdmin.from('usage_logs').insert({
      user_id: job.user_id,
      job_id: jobId,
      model: config.model,
      specific_model: config.specificModel,
      tokens_input: Math.floor(totalTokens * 0.4),  // Rough split
      tokens_output: Math.floor(totalTokens * 0.6),
      source: 'bulk_job',
      is_byok: true,
      is_cached: false
    });

    return NextResponse.json({ 
      jobId,
      status: 'completed',
      processedRows: processedCount,
      totalTokens
    });

  } catch (error) {
    console.error('Worker error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Worker failed' 
    }, { status: 500 });
  }
}

async function markJobFailed(jobId: string, errorMessage: string): Promise<void> {
  await supabaseAdmin
    .from('jobs')
    .update({
      status: 'failed',
      error_message: errorMessage,
      completed_at: new Date().toISOString()
    })
    .eq('id', jobId);
}

// GET for health check / manual trigger info
export async function GET(): Promise<Response> {
  const { count } = await supabaseAdmin
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued');

  return NextResponse.json({ 
    worker: 'ready',
    queuedJobs: count || 0,
    message: 'POST to this endpoint to process next job'
  });
}
