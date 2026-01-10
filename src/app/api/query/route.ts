/**
 * AI Query Endpoint - Unified via Vercel AI SDK
 * 
 * Features:
 * - Single API for all providers (OpenAI, Anthropic, Google, Groq)
 * - Built-in system prompts (context engineering)
 * - Response caching (saves API costs)
 * - Automatic task type inference
 * - Unified token counting
 * - Multi-modal support (text + images)
 * 
 * @see https://ai-sdk.dev/docs/introduction
 */

import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { decryptApiKey } from '@/utils/encryption';
import { supabaseAdmin } from '@/lib/supabase';
import { getModel, type AIProvider } from '@/lib/ai/models';
import { getSystemPrompt, inferTaskType } from '@/lib/prompts';
import { generateCacheKey, getFromCache, setCache } from '@/lib/cache';

// Type for multi-modal message content
type MessageContent = 
  | string 
  | Array<{ type: 'text'; text: string } | { type: 'image'; image: string }>;

// For image processing, convert URLs to base64
async function fetchImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const mimeType = response.headers.get('content-type') || 'image/jpeg';
  return `data:${mimeType};base64,${base64}`;
}

async function getUserIdFromEmail(userEmail: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', userEmail)
    .single();

  if (error) {
    console.error('Error fetching user ID:', error);
    return null;
  }

  return data?.id || null;
}

export async function POST(req: Request): Promise<Response> {
  const { 
    model, 
    input, 
    userEmail, 
    userId, 
    specificModel, 
    encryptedApiKey, 
    imageUrl,
    taskType: explicitTaskType,  // Optional: client can hint the task type
    skipCache = false            // Optional: force fresh response
  } = await req.json();

  // Validate required fields
  if (!model || !input || (!userEmail && !userId) || !encryptedApiKey) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  try {
    // Resolve user ID
    let actualUserId = userId;
    if (!actualUserId && userEmail) {
      actualUserId = await getUserIdFromEmail(userEmail);
      if (!actualUserId) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
    }

    // Decrypt API key
    const apiKey = decryptApiKey(encryptedApiKey);
    if (!apiKey) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // Resolve model
    let selectedModel = specificModel;
    if (!selectedModel) {
      const { data, error } = await supabaseAdmin
        .from('api_keys')
        .select('default_model')
        .eq('user_id', actualUserId)
        .eq('model', model)
        .single();

      if (error) throw error;
      selectedModel = data.default_model;
    }

    // Get credit price per token
    const { data: modelData, error: modelError } = await supabaseAdmin
      .from('models')
      .select('credit_price_per_token')
      .eq('name', selectedModel)
      .single();

    if (modelError || !modelData) {
      console.error('Error fetching model data:', modelError);
      return NextResponse.json({ error: 'Model data not found' }, { status: 404 });
    }

    const creditPricePerToken = modelData.credit_price_per_token;

    // === Context Engineering: Get appropriate system prompt ===
    const taskType = explicitTaskType || inferTaskType(input);
    const systemPrompt = getSystemPrompt(taskType);

    // === Check cache (skip for image queries - they're unique) ===
    const canCache = !imageUrl && !skipCache;
    let cacheKey = '';
    
    if (canCache) {
      cacheKey = generateCacheKey(selectedModel, systemPrompt, input);
      const cacheResult = await getFromCache(cacheKey);
      
      if (cacheResult.cached) {
        // Cache hit! Return cached response
        const creditsUsed = cacheResult.tokensUsed * creditPricePerToken;
        
        // Log as cached usage (no actual API call made)
        await supabaseAdmin.from('credit_usage').insert({
          user_id: actualUserId,
          model: model,
          credits_used: 0  // No credits charged for cache hits
        });

        return NextResponse.json({ 
          result: cacheResult.response, 
          creditsUsed: 0,  // Free!
          meta: {
            taskType,
            model: selectedModel,
            cached: true,
            tokens: {
              input: 0,
              output: 0,
              total: cacheResult.tokensUsed  // Original token count
            }
          }
        });
      }
    }

    // === Build messages array (supports text + images) ===
    let messageContent: MessageContent;
    
    if (imageUrl) {
      // Multi-modal: text + image
      const base64Image = await fetchImageAsBase64(imageUrl);
      messageContent = [
        { type: 'text', text: input },
        { type: 'image', image: base64Image }
      ];
    } else {
      // Text only
      messageContent = input;
    }
    
    const messages = [{ role: 'user' as const, content: messageContent }];

    // === Generate response using AI SDK ===
    const { text, usage } = await generateText({
      model: getModel(model as AIProvider, selectedModel, apiKey),
      system: systemPrompt,
      messages,
      maxOutputTokens: 4000,
    });

    // Calculate credits used (AI SDK v6 uses inputTokens/outputTokens)
    const inputTokens = usage?.inputTokens || 0;
    const outputTokens = usage?.outputTokens || 0;
    const totalTokens = inputTokens + outputTokens;
    const creditsUsed = totalTokens * creditPricePerToken;

    // === Store in cache (for text-only queries) ===
    if (canCache && cacheKey) {
      await setCache(cacheKey, selectedModel, cacheKey.slice(0, 16), text, totalTokens);
    }

    // Log credit usage
    await supabaseAdmin.from('credit_usage').insert({
      user_id: actualUserId,
      model: model,
      credits_used: creditsUsed
    });

    return NextResponse.json({ 
      result: text, 
      creditsUsed,
      meta: {
        taskType,
        model: selectedModel,
        cached: false,
        tokens: {
          input: inputTokens,
          output: outputTokens,
          total: totalTokens
        }
      }
    });

  } catch (error: unknown) {
    console.error('Error processing request:', error instanceof Error ? error.message : String(error));
    
    // Provide more helpful error messages
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const status = errorMessage.includes('API key') ? 401 : 
                   errorMessage.includes('not found') ? 404 : 500;
    
    return NextResponse.json({ error: errorMessage }, { status });
  }
}
