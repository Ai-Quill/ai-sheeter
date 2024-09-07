import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import axios from 'axios';
import { supabaseAdmin } from '@/lib/supabase';
import { queue } from '@/lib/queue';

interface ModelConfig {
  url: string;
  headers: Record<string, string>;
  data: Record<string, unknown>;
  params?: Record<string, string>;
  extractResponse: (data: unknown) => string;
  calculateCredits: (data: unknown, creditPricePerToken: number) => number;
}

interface ClaudeResponse {
  content: Array<{ text: string }>;
  usage: {
    output_tokens: number;
  };
}

interface GrokResponse {
  choices: Array<{ message: { content: string } }>;
  usage: {
    total_tokens: number;
  };
}

interface GeminiResponse {
  candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
  usage: {
    total_tokens: number;
  };
}

export async function POST(req: Request): Promise<Response> {
  return new Promise((resolve) => {
    queue.add(async () => {
      try {
        const { model, input, userEmail, specificModel } = await req.json();

        const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin
          .from('api_keys')
          .select('api_key, default_model')
          .eq('user_email', userEmail)
          .eq('model', model)
          .single();

        if (apiKeyError || !apiKeyData) {
          console.error('Error fetching API key:', apiKeyError);
          resolve(NextResponse.json({ error: 'API key not found' }, { status: 404 }));
          return;
        }

        const apiKey = apiKeyData.api_key;
        const selectedModel = specificModel || apiKeyData.default_model;

        const { data: modelData, error: modelError } = await supabaseAdmin
          .from('models')
          .select('credit_price_per_token')
          .eq('name', selectedModel)
          .single();

        if (modelError || !modelData) {
          console.error('Error fetching model data:', modelError);
          resolve(NextResponse.json({ error: 'Model data not found' }, { status: 404 }));
          return;
        }

        const creditPricePerToken = modelData.credit_price_per_token;

        let result: string;
        let creditsUsed: number;

        if (model === 'CHATGPT') {
          const openai = new OpenAI({
            apiKey: apiKey
          });

          const response = await openai.chat.completions.create({
            model: selectedModel || 'gpt-4o',
            messages: [{ role: 'user', content: input }]
          });

          result = response.choices[0].message.content ?? '';
          creditsUsed = (response.usage?.total_tokens ?? 0) * creditPricePerToken;
        } else {
          const modelConfigs: Record<string, ModelConfig> = {
            CLAUDE: {
              url: 'https://api.anthropic.com/v1/messages',
              headers: { 'x-api-key': apiKey },
              data: {
                model: selectedModel || 'claude-3.5',
                messages: [{ role: 'user', content: input }]
              },
              extractResponse: (data: unknown) => (data as ClaudeResponse).content[0].text,
              calculateCredits: (data: unknown, creditPricePerToken: number) => (data as ClaudeResponse).usage.output_tokens * creditPricePerToken
            },
            GROQ: {
              url: 'https://api.xai.com/v1/chat/completions',
              headers: { 'Authorization': `Bearer ${apiKey}` },
              data: {
                model: selectedModel || 'grok-1',
                messages: [{ role: 'user', content: input }]
              },
              extractResponse: (data: unknown) => (data as GrokResponse).choices[0].message.content,
              calculateCredits: (data: unknown, creditPricePerToken: number) => (data as GrokResponse).usage.total_tokens * creditPricePerToken
            },
            GEMINI: {
              url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5:generateContent',
              headers: {},
              params: { key: apiKey },
              data: {
                contents: [{ parts: [{ text: input }] }]
              },
              extractResponse: (data: unknown) => 
                (data as GeminiResponse).candidates[0].content.parts[0].text,
              calculateCredits: (data: unknown, creditPricePerToken: number) => (data as GeminiResponse).usage.total_tokens * creditPricePerToken
            }
          };

          const config = modelConfigs[model];
          if (!config) {
            console.error('Unsupported model:', model);
            resolve(NextResponse.json({ error: 'Unsupported model' }, { status: 400 }));
            return;
          }

          const response = await axios.post(config.url, config.data, {
            headers: config.headers,
            params: config.params
          });

          result = config.extractResponse(response.data);
          creditsUsed = config.calculateCredits(response.data, creditPricePerToken);
        }

        await supabaseAdmin.from('credit_usage').insert({
          user_email: userEmail,
          model: model,
          credits_used: creditsUsed
        });

        resolve(NextResponse.json({ result, creditsUsed }));
      } catch (error: unknown) {
        console.error('Error processing request:', error instanceof Error ? error.message : String(error));
        resolve(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
      }
    });
  }) as Promise<Response>;
}