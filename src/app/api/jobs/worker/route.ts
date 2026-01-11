/**
 * Job Worker - Processes queued async jobs
 * 
 * Triggered by:
 * - Vercel Cron (configurable frequency)
 * - Manual POST request (for testing)
 * 
 * Flow:
 * 1. Claim multiple jobs atomically (parallel processing)
 * 2. Process all jobs concurrently with Promise.allSettled
 * 3. Each job processes rows in batches
 * 4. Update progress/results in real-time via Supabase
 * 
 * Performance (Vercel Pro + Supabase Pro):
 * - PARALLEL_JOBS: Process up to 5 jobs simultaneously
 * - BATCH_SIZE: 10-15 rows per API call
 * - Cron frequency: Every 10 seconds recommended
 * 
 * @see vercel.json for cron config
 * @version 2.0.0 - Parallel job processing
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

// Create a batched prompt for multiple inputs
function createBatchPrompt(promptTemplate: string, batch: InputRow[]): string {
  const lines = batch.map((row, i) => `${i + 1}. ${row.input}`).join('\n');
  
  if (promptTemplate && (promptTemplate.includes('{input}') || promptTemplate.includes('{{input}}'))) {
    // Template-based prompt
    const instruction = promptTemplate
      .replace('{input}', '')
      .replace('{{input}}', '')
      .trim();
    return `${instruction}\n\nProcess each item below and return results in the same numbered format:\n\n${lines}`;
  }
  
  return `Process each item below and return results in the same numbered format:\n\n${lines}`;
}

// Parse batched response back into individual results
function parseBatchResponse(response: string, batch: InputRow[]): Array<{index: number; input: string; output: string}> {
  const results: Array<{index: number; input: string; output: string}> = [];
  const lines = response.split('\n').filter(l => l.trim());
  
  // Try to match numbered responses
  const numberedPattern = /^(\d+)[.\):\s]+(.+)$/;
  const parsedLines: Map<number, string> = new Map();
  
  let currentNum = 0;
  let currentContent = '';
  
  for (const line of lines) {
    const match = line.match(numberedPattern);
    if (match) {
      // Save previous if exists
      if (currentNum > 0 && currentContent) {
        parsedLines.set(currentNum, currentContent.trim());
      }
      currentNum = parseInt(match[1], 10);
      currentContent = match[2];
    } else if (currentNum > 0) {
      // Continue previous numbered item
      currentContent += ' ' + line.trim();
    }
  }
  
  // Save last item
  if (currentNum > 0 && currentContent) {
    parsedLines.set(currentNum, currentContent.trim());
  }
  
  // Map back to batch items
  for (let i = 0; i < batch.length; i++) {
    const row = batch[i];
    const output = parsedLines.get(i + 1) || '';
    results.push({
      index: row.index,
      input: row.input,
      output
    });
  }
  
  // Fallback: if no numbered responses found, try splitting by lines
  if (results.every(r => !r.output) && lines.length >= batch.length) {
    for (let i = 0; i < batch.length; i++) {
      results[i].output = lines[i]?.trim() || '';
    }
  }
  
  return results;
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

// ============================================
// PARALLEL JOB PROCESSING (Vercel Pro)
// ============================================

// Configuration for Pro environments
const PARALLEL_JOBS = 5;  // Process up to 5 jobs simultaneously
const BATCH_SIZE = 12;    // Rows per AI call (optimized for Pro)

interface JobResult {
  jobId: string;
  status: 'completed' | 'failed';
  processedRows: number;
  totalTokens: number;
  elapsedMs: number;
  error?: string;
}

/**
 * Process a single job completely
 * Extracted for parallel execution
 */
async function processJob(jobId: string): Promise<JobResult> {
  const jobStartTime = Date.now();
  
  try {
    // Fetch full job data
    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return { 
        jobId, 
        status: 'failed', 
        processedRows: 0, 
        totalTokens: 0, 
        elapsedMs: Date.now() - jobStartTime,
        error: 'Job not found' 
      };
    }
    
    console.log(`[Worker] Job ${jobId}: ${job.total_rows} rows, model: ${job.config?.model}`);

    const config: JobConfig = job.config;
    const inputs: InputRow[] = job.input_data;
    const results: ResultRow[] = job.results || [];
    
    // Decrypt API key
    const apiKey = decryptApiKey(config.encryptedApiKey);
    if (!apiKey) {
      await markJobFailed(jobId, 'Invalid API key');
      return { 
        jobId, 
        status: 'failed', 
        processedRows: 0, 
        totalTokens: 0, 
        elapsedMs: Date.now() - jobStartTime,
        error: 'Invalid API key' 
      };
    }

    // Get system prompt
    const systemPrompt = getSystemPrompt(config.taskType || 'DEFAULT');
    
    let totalTokens = 0;
    let processedCount = job.processed_rows || 0;

    // Filter out already processed rows
    const pendingInputs = inputs.filter(row => !results.some(r => r.index === row.index));
    
    // Create batches
    const batches: InputRow[][] = [];
    for (let i = 0; i < pendingInputs.length; i += BATCH_SIZE) {
      batches.push(pendingInputs.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`[Worker] Job ${jobId}: Processing ${pendingInputs.length} items in ${batches.length} batch(es)`);
    
    for (const batch of batches) {
      // Check if job was cancelled
      const { data: checkJob } = await supabaseAdmin
        .from('jobs')
        .select('status')
        .eq('id', jobId)
        .single();
      
      if (checkJob?.status === 'cancelled') {
        return { 
          jobId, 
          status: 'failed', 
          processedRows: processedCount, 
          totalTokens, 
          elapsedMs: Date.now() - jobStartTime,
          error: 'Job cancelled' 
        };
      }

      try {
        // Create batched prompt
        const batchPrompt = createBatchPrompt(config.prompt || '', batch);
        
        // Call AI with batched prompt
        const { text, usage } = await generateText({
          model: getModel(config.model, config.specificModel, apiKey),
          system: systemPrompt + '\n\nIMPORTANT: Process each numbered item and return results in the same numbered format. Each result should be on its own line starting with the number.',
          messages: [{ role: 'user', content: batchPrompt }],
          maxOutputTokens: 4000,
        });

        const tokens = (usage?.inputTokens || 0) + (usage?.outputTokens || 0);
        totalTokens += tokens;
        
        // Parse batch response
        const batchResults = parseBatchResponse(text, batch);
        
        for (const result of batchResults) {
          results.push({
            ...result,
            tokens: Math.ceil(tokens / batch.length),
            cached: false
          });
          processedCount++;
        }
        
        // Update progress after each batch
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

      } catch (batchError) {
        console.error(`[Worker] Job ${jobId} batch error, fallback to individual:`, batchError);
        
        // Fallback: process items individually if batch fails
        for (const row of batch) {
          try {
            const userInput = config.prompt 
              ? config.prompt.replace('{input}', row.input).replace('{{input}}', row.input)
              : row.input;

            const { text, usage } = await generateText({
              model: getModel(config.model, config.specificModel, apiKey),
              system: systemPrompt,
              messages: [{ role: 'user', content: userInput }],
              maxOutputTokens: 2000,
            });

            const tokens = (usage?.inputTokens || 0) + (usage?.outputTokens || 0);
            totalTokens += tokens;
            
            results.push({
              index: row.index,
              input: row.input,
              output: text,
              tokens,
              cached: false
            });
          } catch (rowError) {
            results.push({
              index: row.index,
              input: row.input,
              output: '',
              tokens: 0,
              cached: false,
              error: rowError instanceof Error ? rowError.message : 'Processing failed'
            });
          }
          processedCount++;
        }
        
        // Update progress
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
    }

    // Mark job as completed
    console.log(`[Worker] Job ${jobId} completing: ${processedCount} rows, ${totalTokens} tokens`);
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
      tokens_input: Math.floor(totalTokens * 0.4),
      tokens_output: Math.floor(totalTokens * 0.6),
      source: 'bulk_job',
      is_byok: true,
      is_cached: false
    });

    return {
      jobId,
      status: 'completed',
      processedRows: processedCount,
      totalTokens,
      elapsedMs: Date.now() - jobStartTime
    };

  } catch (error) {
    console.error(`[Worker] Job ${jobId} failed:`, error);
    await markJobFailed(jobId, error instanceof Error ? error.message : 'Unknown error');
    return {
      jobId,
      status: 'failed',
      processedRows: 0,
      totalTokens: 0,
      elapsedMs: Date.now() - jobStartTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// GET - Triggered by Vercel cron to process jobs (PARALLEL)
export async function GET(req: Request): Promise<Response> {
  const startTime = Date.now();
  console.log('[Worker] Starting parallel job processing...');
  
  try {
    // First, reset any stale 'processing' jobs back to 'queued'
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    console.log('[Worker] Checking for stale jobs older than:', fiveMinutesAgo);
    
    const { data: staleJobs } = await supabaseAdmin
      .from('jobs')
      .select('id, retry_count')
      .eq('status', 'processing')
      .lt('started_at', fiveMinutesAgo)
      .lte('retry_count', 3);
    
    if (staleJobs && staleJobs.length > 0) {
      await Promise.all(staleJobs.map(staleJob => 
        supabaseAdmin
          .from('jobs')
          .update({ 
            status: 'queued',
            started_at: null,
            retry_count: (staleJob.retry_count || 0) + 1
          })
          .eq('id', staleJob.id)
      ));
      console.log(`[Worker] Reset ${staleJobs.length} stale jobs`);
    }
    
    // Try to get multiple jobs using the new function
    // Falls back to single job if get_next_jobs doesn't exist
    let jobIds: string[] = [];
    
    const { data: multiJobData, error: multiJobError } = await supabaseAdmin.rpc('get_next_jobs', { p_limit: PARALLEL_JOBS });
    
    if (!multiJobError && multiJobData && multiJobData.length > 0) {
      jobIds = multiJobData.map((j: { job_id: string }) => j.job_id);
    } else {
      // Fallback to single job processing
      const { data: singleJobId } = await supabaseAdmin.rpc('get_next_job');
      if (singleJobId) {
        jobIds = [singleJobId];
      }
    }
    
    if (jobIds.length === 0) {
      const elapsed = Date.now() - startTime;
      console.log(`[Worker] No jobs queued. Elapsed: ${elapsed}ms`);
      return NextResponse.json({ 
        message: 'No jobs queued', 
        staleJobsReset: staleJobs?.length || 0,
        elapsedMs: elapsed 
      });
    }

    console.log(`[Worker] Processing ${jobIds.length} job(s) in parallel: ${jobIds.join(', ')}`);

    // Process all jobs in parallel
    const jobResults = await Promise.allSettled(
      jobIds.map(jobId => processJob(jobId))
    );

    // Aggregate results
    const completed: JobResult[] = [];
    const failed: JobResult[] = [];
    let totalProcessed = 0;
    let totalTokensAll = 0;

    for (const result of jobResults) {
      if (result.status === 'fulfilled') {
        const jobResult = result.value;
        if (jobResult.status === 'completed') {
          completed.push(jobResult);
        } else {
          failed.push(jobResult);
        }
        totalProcessed += jobResult.processedRows;
        totalTokensAll += jobResult.totalTokens;
      } else {
        // Promise rejected - should not happen as processJob catches errors
        console.error('[Worker] Unexpected promise rejection:', result.reason);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[Worker] Completed ${completed.length}/${jobIds.length} jobs in ${elapsed}ms`);
    console.log(`[Worker] Total: ${totalProcessed} rows, ${totalTokensAll} tokens`);
    
    return NextResponse.json({ 
      message: `Processed ${jobIds.length} job(s) in parallel`,
      jobsProcessed: jobIds.length,
      completed: completed.length,
      failed: failed.length,
      totalRowsProcessed: totalProcessed,
      totalTokens: totalTokensAll,
      staleJobsReset: staleJobs?.length || 0,
      elapsedMs: elapsed,
      jobs: [...completed, ...failed]
    });

  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error('[Worker] Error after', elapsed, 'ms:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Worker failed',
      elapsedMs: elapsed
    }, { status: 500 });
  }
}
