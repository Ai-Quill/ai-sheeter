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
 * 4. Update progress/results via Supabase (batched updates)
 * 
 * Performance (Optimized for GPT-5 Mini):
 * - PARALLEL_JOBS: 5 jobs simultaneously
 * - BATCH_SIZE: 25 rows per AI call
 * - PARALLEL_BATCHES: 5 batches in parallel per job
 * - UPDATE_FREQUENCY: DB update every 2 batch chunks
 * - Cron frequency: Every 10 seconds recommended
 * 
 * @see vercel.json for cron config
 * @version 2.1.0 - Optimized batch processing for speed
 */

import { NextResponse } from 'next/server';
import { generateText } from 'ai';
// Note: Removed zod + generateObject - using generateText for speed
import { supabaseAdmin } from '@/lib/supabase';
import { decryptApiKey } from '@/utils/encryption';
import { getModel, type AIProvider } from '@/lib/ai/models';
import { getSystemPrompt, type TaskType } from '@/lib/prompts';
import { generateCacheKey, getFromCache, setCache } from '@/lib/cache';

// ============================================
// BATCH PROCESSING STRATEGY
// Using generateText + parsing instead of generateObject for 2-3x speed improvement
// generateObject's JSON schema enforcement adds significant overhead
// ============================================

// Vercel Pro: Extended timeout for parallel job processing (5 min)
export const maxDuration = 300;

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
    // Extract the instruction part, keeping {{input}} context
    // Replace {{input}} with "each item" for batch context
    const instruction = promptTemplate
      .replace(/\{\{input\}\}/g, 'each item below')
      .replace(/\{input\}/g, 'each item below')
      .trim();
    
    return `${instruction}

Items to process:
${lines}

IMPORTANT: Return ONLY the result for each item. No confirmations, no "Yes", no "|||" separators.

Reply format (numbered, one result per line):
1. [result only]
2. [result only]
...`;
  }
  
  return `Process each item and return numbered results:

${lines}

IMPORTANT: Return ONLY the result for each item. No confirmations, no "Yes", no extra text.

Reply:
1. [result only]
2. [result only]
...`;
}

// Clean up AI output - remove unwanted suffixes that some models add
// IMPORTANT: Only removes confirmation words when they appear AFTER a separator,
// not when they ARE the legitimate answer (e.g., "Is this valid?" → "Yes")
function cleanOutput(output: string): string {
  if (!output) return output;
  
  const trimmed = output.trim();
  
  // Don't clean if the entire output is a simple confirmation word
  // These could be legitimate yes/no/done answers to classification questions
  const simpleAnswers = /^(Yes|No|Done|Completed|OK|True|False|Sí|Non|Oui|Ja|Nein|はい|いいえ|예|아니요|是|否|Да|Нет)\.?$/i;
  if (simpleAnswers.test(trimmed)) {
    return trimmed;
  }
  
  // Only clean patterns where a separator is followed by confirmation words
  // This targets unwanted suffixes like "analysis text ||| Yes" or "result; Done"
  let cleaned = trimmed
    // Remove "|||" separator patterns with text after (e.g., "result ||| Yes", "text ||| Done")
    // Only if there's actual content before the separator
    .replace(/(.+?)\s*\|\|\|\s*(Yes|No|Done|Completed|OK|True|False)?\s*$/i, '$1')
    // Remove trailing "|" or ";" followed by confirmation word (e.g., "text | Yes", "result; Done")
    .replace(/(.+?)\s*[|;]\s*(Yes|No|Done|Completed|OK|True|False)\s*$/i, '$1')
    // Clean up orphaned trailing separators
    .replace(/\s*\|+\s*$/, '')
    .trim();
  
  return cleaned;
}

// Parse batched response back into individual results
function parseBatchResponse(response: string, batch: InputRow[]): Array<{index: number; input: string; output: string}> {
  const results: Array<{index: number; input: string; output: string}> = [];
  const lines = response.split('\n').filter(l => l.trim());
  
  console.log(`[BatchParse] Response length: ${response.length}, Lines: ${lines.length}, Batch: ${batch.length}`);
  console.log(`[BatchParse] First 200 chars: ${response.substring(0, 200)}`);
  
  // Try to match numbered responses (e.g., "1. result", "1) result", "1: result")
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
  
  console.log(`[BatchParse] Parsed ${parsedLines.size} numbered items`);
  
  // Map back to batch items with cleanup
  for (let i = 0; i < batch.length; i++) {
    const row = batch[i];
    const rawOutput = parsedLines.get(i + 1) || '';
    results.push({
      index: row.index,
      input: row.input,
      output: cleanOutput(rawOutput)
    });
  }
  
  // Count empty results
  const emptyCount = results.filter(r => !r.output).length;
  
  // Fallback: if no numbered responses found, try splitting by lines
  if (emptyCount === batch.length && lines.length >= batch.length) {
    console.log(`[BatchParse] Using line-by-line fallback`);
    for (let i = 0; i < batch.length; i++) {
      results[i].output = cleanOutput(lines[i]?.trim() || '');
    }
  }
  
  // If still too many empty, throw to trigger individual processing
  // Use 20% threshold - allows 1 empty result, but catches patterns where multiple fail
  const finalEmptyCount = results.filter(r => !r.output).length;
  if (finalEmptyCount > batch.length * 0.2) {
    console.log(`[BatchParse] FAILED: ${finalEmptyCount}/${batch.length} empty (>${Math.ceil(batch.length * 0.2)}), triggering individual fallback`);
    throw new Error('BATCH_PARSE_FAILED: Too many empty results');
  }
  
  console.log(`[BatchParse] Success: ${batch.length - finalEmptyCount}/${batch.length} with output`);
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
          output: cleanOutput(output),
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

// Configuration for Pro environments - Optimized for speed
const PARALLEL_JOBS = 5;    // Process up to 5 jobs simultaneously
const BATCH_SIZE = 25;      // Rows per AI call (GPT-5 Mini handles larger batches well)
const PARALLEL_BATCHES = 5; // Process up to 5 batches in parallel within a job
const UPDATE_FREQUENCY = 2; // Update DB every N batch chunks (reduces latency)

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
    
    console.log(`[Worker] Job ${jobId}: Processing ${pendingInputs.length} items in ${batches.length} batch(es), parallel: ${Math.min(PARALLEL_BATCHES, batches.length)}`);
    
    // Check if job was cancelled before starting
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

    // Process a single batch (arrow function for use in parallel processing)
    // Only mark as complex if the task truly requires individual context
    // Simple tasks (calculations, translations, classifications) can be batched
    const promptLower = (config.prompt || '').toLowerCase();
    const isComplexPrompt = config.prompt && (
      // Tasks that need full context per item (can't batch)
      promptLower.includes('summarize the entire') ||
      promptLower.includes('analyze in detail') ||
      promptLower.includes('write a full') ||
      promptLower.includes('generate a complete') ||
      // Very long prompts with multi-step instructions
      (config.prompt.length > 500 && (
        promptLower.includes('step 1') ||
        promptLower.includes('first,') ||
        promptLower.includes('then,')
      ))
    );
    
    // Log batch decision for debugging
    console.log(`[Worker] Job ${jobId}: Prompt length=${config.prompt?.length}, isComplex=${isComplexPrompt}`);
    
    const processSingleBatch = async (batch: InputRow[], batchIndex: number): Promise<{
      results: ResultRow[];
      tokens: number;
      error?: string;
    }> => {
      const batchResults: ResultRow[] = [];
      let batchTokens = 0;
      
      try {
        // For complex prompts OR small batches, use parallel individual processing
        // This is actually FASTER than structured output due to JSON schema overhead
        const useParallel = isComplexPrompt || batch.length <= 15;
        
        if (useParallel) {
          console.log(`[Worker] Job ${jobId} batch ${batchIndex}: Using PARALLEL processing (${isComplexPrompt ? 'complex prompt' : 'small batch'})`);
          throw new Error('USE_PARALLEL');
        }
        
        // For large batches, use generateText with numbered format (faster than generateObject)
        const batchItems = batch.map((row, i) => `${i + 1}. ${row.input}`).join('\n');
        const taskInstruction = config.prompt
          ? config.prompt.replace(/\{\{?input\}?\}/g, 'each item')
          : 'Process each item';
        
        console.log(`[Worker] Job ${jobId} batch ${batchIndex}: Model=${config.model}, specificModel=${config.specificModel}`);
        console.log(`[Worker] Job ${jobId} batch ${batchIndex}: Using TEXT BATCH (generateText)`);
        console.log(`[Worker] Job ${jobId} batch ${batchIndex}: Task: ${taskInstruction}`);
        console.log(`[Worker] Job ${jobId} batch ${batchIndex}: Items: ${batch.length}`);
        
        try {
          // Use generateText instead of generateObject - much faster!
          const result = await generateText({
            model: getModel(config.model, config.specificModel, apiKey),
            system: systemPrompt,
            prompt: `${taskInstruction}

Process each numbered item and respond with ONLY the results in the same numbered format:

${batchItems}

Reply with numbered results (1. result, 2. result, etc). Give ONLY the result for each item, no explanations.`,
          });
          
          const usage = result.usage || {};
          const tokens = (usage.inputTokens || 0) + (usage.outputTokens || 0);
          batchTokens = tokens;
          
          // Parse the text response into individual results
          const parsedResults = parseBatchResponse(result.text, batch);
          
          console.log(`[Worker] Job ${jobId} batch ${batchIndex}: Text batch response received, ${parsedResults.length} results, ${tokens} tokens`);
          
          // Map parsed results to our format
          for (const item of parsedResults) {
            batchResults.push({
              index: item.index,
              input: item.input,
              output: item.output,
              tokens: Math.ceil(tokens / batch.length),
              cached: false
            });
          }
          
          // Check for empty results - if too many, fall back to parallel
          // 20% threshold: allows 1 empty, catches 2+ empty
          const emptyCount = batchResults.filter(r => !r.output).length;
          if (emptyCount > batch.length * 0.2) {
            console.log(`[Worker] Job ${jobId} batch ${batchIndex}: Too many empty results (${emptyCount}/${batch.length} > 20%), falling back to parallel`);
            throw new Error('TOO_MANY_EMPTY');
          }
          
        } catch (aiError: any) {
          console.error(`[Worker] Job ${jobId} batch ${batchIndex}: Text batch failed:`, aiError.message);
          throw new Error(`TEXT_BATCH_FAILED: ${aiError.message}`);
        }
        
        return { results: batchResults, tokens: batchTokens };
        
      } catch (batchError) {
        console.log(`[Worker] Job ${jobId} batch ${batchIndex}: Processing ${batch.length} items in PARALLEL`);
        
        // Fallback: process items individually IN PARALLEL for speed
        // With retry logic for failed items
        const MAX_RETRIES = 2;
        const RETRY_DELAY_MS = 1000;
        
        const processRowWithRetry = async (row: InputRow, retryCount = 0): Promise<ResultRow> => {
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
            const output = cleanOutput(text);
            
            // Check if output is empty/too short - might need retry
            if (!output || output.length < 5) {
              if (retryCount < MAX_RETRIES) {
                console.log(`[Worker] Job ${jobId} row ${row.index}: Empty/short output (${output.length} chars), retrying (${retryCount + 1}/${MAX_RETRIES})`);
                await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (retryCount + 1)));
                return processRowWithRetry(row, retryCount + 1);
              }
              console.warn(`[Worker] Job ${jobId} row ${row.index}: Empty output after ${MAX_RETRIES} retries`);
            }
            
            return {
              index: row.index,
              input: row.input,
              output,
              tokens,
              cached: false
            };
          } catch (rowError: any) {
            const errorMsg = rowError?.message || 'Unknown error';
            
            // Retry on certain errors
            if (retryCount < MAX_RETRIES && (
              errorMsg.includes('rate') || 
              errorMsg.includes('timeout') || 
              errorMsg.includes('429') ||
              errorMsg.includes('500') ||
              errorMsg.includes('503')
            )) {
              console.log(`[Worker] Job ${jobId} row ${row.index}: Error "${errorMsg.slice(0, 50)}", retrying (${retryCount + 1}/${MAX_RETRIES})`);
              await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (retryCount + 1) * 2)); // Longer delay for errors
              return processRowWithRetry(row, retryCount + 1);
            }
            
            console.error(`[Worker] Job ${jobId} row ${row.index}: FAILED - ${errorMsg.slice(0, 100)}`);
            return {
              index: row.index,
              input: row.input,
              output: '',
              tokens: 0,
              cached: false,
              error: errorMsg
            };
          }
        };
        
        const rowPromises = batch.map(row => processRowWithRetry(row));
        
        // Wait for all rows to complete in parallel
        const parallelResults = await Promise.all(rowPromises);
        
        for (const result of parallelResults) {
          batchResults.push(result);
          batchTokens += result.tokens;
        }
        
        return { results: batchResults, tokens: batchTokens };
      }
    };

    // Process batches in parallel chunks
    let chunkIndex = 0;
    for (let i = 0; i < batches.length; i += PARALLEL_BATCHES) {
      const batchChunk = batches.slice(i, i + PARALLEL_BATCHES);
      
      // Process chunk in parallel
      const chunkResults = await Promise.all(
        batchChunk.map((batch, idx) => processSingleBatch(batch, i + idx))
      );
      
      // Collect results from parallel batches
      for (const chunkResult of chunkResults) {
        results.push(...chunkResult.results);
        totalTokens += chunkResult.tokens;
        processedCount += chunkResult.results.length;
      }
      
      chunkIndex++;
      
      // Update progress less frequently to reduce latency
      const isLastChunk = i + PARALLEL_BATCHES >= batches.length;
      if (isLastChunk || chunkIndex % UPDATE_FREQUENCY === 0) {
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

    // Log any empty results before completing
    const emptyResults = results.filter(r => !r.output || r.output.trim() === '');
    if (emptyResults.length > 0) {
      console.warn(`[Worker] Job ${jobId}: ${emptyResults.length}/${results.length} rows have EMPTY output at indices: ${emptyResults.map(r => r.index).join(', ')}`);
    }
    
    // Mark job as completed
    console.log(`[Worker] Job ${jobId} completing: ${processedCount} rows, ${totalTokens} tokens${emptyResults.length > 0 ? ` (${emptyResults.length} empty)` : ''}`);
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
    
    // Try to get multiple jobs using the parallel function
    // Falls back to single job if get_next_jobs doesn't exist or errors
    let jobIds: string[] = [];
    
    const { data: multiJobData, error: multiJobError } = await supabaseAdmin.rpc('get_next_jobs', { p_limit: PARALLEL_JOBS });
    
    if (!multiJobError && multiJobData && multiJobData.length > 0) {
      jobIds = multiJobData.map((j: { job_id: string }) => j.job_id);
      console.log(`[Worker] Claimed ${jobIds.length} jobs via get_next_jobs`);
    } else {
      // Log why parallel failed
      if (multiJobError) {
        console.log(`[Worker] get_next_jobs failed (${multiJobError.code}): ${multiJobError.message} - using fallback`);
      }
      // Fallback to single job processing
      const { data: singleJobId } = await supabaseAdmin.rpc('get_next_job');
      if (singleJobId) {
        jobIds = [singleJobId];
        console.log(`[Worker] Fallback: claimed 1 job via get_next_job`);
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
