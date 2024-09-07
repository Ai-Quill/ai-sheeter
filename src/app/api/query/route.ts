import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import axios from 'axios';
import { supabaseAdmin } from '@/lib/supabase';
import { queue } from '@/lib/queue';
import Anthropic from '@anthropic-ai/sdk';

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
        let selectedModel = specificModel || apiKeyData.default_model;
        if (!selectedModel) {
          switch (model) {
            case 'CHATGPT':
              selectedModel = "gpt-4";
              break;
            case 'CLAUDE':
              selectedModel = "claude-3-sonnet-20240229";
              break;
            case 'GROQ':
              selectedModel = "grok-1";
              break;
            case 'GEMINI':
              selectedModel = "gemini-pro";
              break;
            // Add default cases for other models if needed
          }
        }

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

        switch (model) {
          case 'CHATGPT':
            const openai = new OpenAI({
              apiKey: apiKey
            });

            const chatGptResponse = await openai.chat.completions.create({
              model: selectedModel || 'gpt-4o',
              messages: [{ role: 'user', content: input }],
              max_tokens: 4000
            });

            result = chatGptResponse.choices[0].message.content ?? '';
            creditsUsed = (chatGptResponse.usage?.total_tokens ?? 0) * creditPricePerToken;
            break;

          case 'CLAUDE':
            try {
              const anthropic = new Anthropic({
                apiKey: apiKey
              });

              const claudeResponse = await anthropic.messages.create({
                model: selectedModel || 'claude-3-sonnet-20240229',
                max_tokens: 1024,
                messages: [{ role: 'user', content: input }]
              });

              console.log('Claude response:', JSON.stringify(claudeResponse, null, 2));
              result = claudeResponse.content[0].type === 'text' 
                ? claudeResponse.content[0].text 
                : JSON.stringify(claudeResponse.content[0]);
              creditsUsed = claudeResponse.usage.output_tokens * creditPricePerToken;
            } catch (error) {
              console.error('Error from Claude API:', error instanceof Error ? error.message : String(error));
              resolve(NextResponse.json({ error: 'Error from Claude API' }, { status: 400 }));
              return;
            }
            break;

          case 'GROQ':
            const groqResponse = await axios.post('https://api.xai.com/v1/chat/completions', {
              model: selectedModel || 'grok-1',
              messages: [{ role: 'user', content: input }],
              max_tokens: 4000
            }, {
              headers: { 'Authorization': `Bearer ${apiKey}` }
            });

            result = groqResponse.data.choices[0].message.content;
            creditsUsed = groqResponse.data.usage.total_tokens * creditPricePerToken;
            break;

          case 'GEMINI':
            const geminiResponse = await axios.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5:generateContent', {
              contents: [{ parts: [{ text: input }] }],
              max_tokens: 4000
            }, {
              headers: {},
              params: { key: apiKey }
            });

            result = geminiResponse.data.candidates[0].content.parts[0].text;
            creditsUsed = geminiResponse.data.usage.total_tokens * creditPricePerToken;
            break;

          default:
            console.error('Unsupported model:', model);
            resolve(NextResponse.json({ error: 'Unsupported model' }, { status: 400 }));
            return;
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