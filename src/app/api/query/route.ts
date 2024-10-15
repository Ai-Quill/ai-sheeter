import { NextResponse } from 'next/server';
import { decryptApiKey } from '@/utils/encryption';
import OpenAI from 'openai';
import { supabaseAdmin } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';
import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from 'axios';

async function getBase64FromUrl(url: string): Promise<{ base64: string; mediaType: string }> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const mediaType = response.headers.get('content-type') || 'application/octet-stream';
  return { base64, mediaType };
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
  const { model, input, userEmail, userId, specificModel, encryptedApiKey, imageUrl } = await req.json();

  if (!model || !input || (!userEmail && !userId) || !encryptedApiKey) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  try {
    let actualUserId = userId;
    if (!actualUserId && userEmail) {
      actualUserId = await getUserIdFromEmail(userEmail);
      if (!actualUserId) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
    }

    const decryptedApiKey = decryptApiKey(encryptedApiKey);

    if (!decryptedApiKey) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

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

    let result: string;
    let creditsUsed: number;

    switch (model) {
      case 'CHATGPT':
        const openai = new OpenAI({
          apiKey: decryptedApiKey
        });

        try {
          let messages: OpenAI.ChatCompletionMessageParam[] = [{ role: 'user', content: input }];
          if (imageUrl) {
            messages = [
              {
                role: 'user',
                content: [
                  { type: 'text', text: input },
                  { type: 'image_url', image_url: { url: imageUrl } }
                ]
              }
            ];
          }

          const chatGptResponse = await openai.chat.completions.create({
            model: selectedModel,
            messages: messages,
            max_tokens: 4000
          });

          result = chatGptResponse.choices[0].message.content ?? '';
          creditsUsed = (chatGptResponse.usage?.total_tokens ?? 0) * creditPricePerToken;
        } catch (error) {
          console.error('Error from OpenAI API:', error);
          return NextResponse.json({ error: 'Invalid API key or API error' }, { status: 401 });
        }
        break;

      case 'CLAUDE':
        try {
          const anthropic = new Anthropic({
            apiKey: decryptedApiKey
          });

          const messages: Anthropic.MessageParam[] = [
            {
              role: 'user',
              content: input
            }
          ];

          if (imageUrl) {
            const { base64: base64Image, mediaType } = await getBase64FromUrl(imageUrl);
            messages[0].content = [
              { type: 'text', text: input },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                  data: base64Image
                }
              }
            ];
          }

          const claudeResponse = await anthropic.messages.create({
            model: selectedModel,
            max_tokens: 1024,
            messages: messages
          });

          console.log('Claude response:', JSON.stringify(claudeResponse, null, 2));
          result = claudeResponse.content[0].type === 'text' 
            ? claudeResponse.content[0].text 
            : JSON.stringify(claudeResponse.content[0]);
          creditsUsed = claudeResponse.usage.output_tokens * creditPricePerToken;
        } catch (error) {
          console.error('Error from Claude API:', error instanceof Error ? error.message : String(error));
          return NextResponse.json({ error: 'Error from Claude API' }, { status: 400 });
        }
        break;

      case 'GROQ':
        const groq = new Groq({ apiKey: decryptedApiKey });
        const groqResponse = await groq.chat.completions.create({
          messages: [{ role: 'user', content: input }],
          model: selectedModel
        });

        result = groqResponse.choices[0]?.message?.content || "";
        creditsUsed = (groqResponse.usage?.total_tokens ?? 0) * creditPricePerToken;
        break;

      case 'GEMINI':
        const genAI = new GoogleGenerativeAI(decryptedApiKey);
        const geminiModel = genAI.getGenerativeModel({ model: selectedModel });
        
        let geminiInput;
        if (imageUrl) {
          const imageResponse = await fetch(imageUrl);
          const imageData = await imageResponse.arrayBuffer();
          geminiInput = [
            input,
            {
              inlineData: {
                data: Buffer.from(imageData).toString('base64'),
                mimeType: imageResponse.headers.get('content-type') || 'image/jpeg'
              }
            }
          ];
        } else {
          geminiInput = input;
        }
        
        // Generate content
        const geminiResult = await geminiModel.generateContent(geminiInput);
        const geminiResponse = await geminiResult.response;
        
        result = geminiResponse.text();
        creditsUsed = (await geminiModel.countTokens(input)).totalTokens * creditPricePerToken;
        break;

      case 'STRATICO':
        const straticoUrl = 'https://api.stratico.com/v1/chat/completions';
        const straticoHeaders = {
          'Authorization': `Bearer ${decryptedApiKey}`,
          'Content-Type': 'application/json'
        };
        const straticoPayload = {
          model: selectedModel || 'gpt-3.5-turbo', // Use default model if not specified
          messages: [{ role: 'user', content: input }]
        };

        if (imageUrl) {
          straticoPayload.messages[0].content = [
            { type: 'text', text: input },
            { type: 'image_url', image_url: { url: imageUrl } }
          ];
        }

        try {
          const straticoResponse = await axios.post(straticoUrl, straticoPayload, { headers: straticoHeaders });
          
          if (straticoResponse.data.choices && straticoResponse.data.choices.length > 0) {
            result = straticoResponse.data.choices[0].message.content;
          } else if (straticoResponse.data.content) {
            // Fallback in case the response structure is different
            result = straticoResponse.data.content;
          } else {
            throw new Error('Unexpected response structure from Stratico API');
          }

          // Calculate credits used, fallback to a default if usage is not provided
          creditsUsed = (straticoResponse.data.usage?.total_tokens || 0) * creditPricePerToken;
          if (creditsUsed === 0) {
            // If usage is not provided, estimate based on input and output length
            const inputTokens = input.length / 4; // Rough estimate
            const outputTokens = result.length / 4; // Rough estimate
            creditsUsed = (inputTokens + outputTokens) * creditPricePerToken;
          }
        } catch (error) {
          console.error('Error from Stratico API:', error);
          return NextResponse.json({ error: 'Error from Stratico API' }, { status: 400 });
        }
        break;

      default:
        console.error('Unsupported model:', model);
        return NextResponse.json({ error: 'Unsupported model' }, { status: 400 });
    }

    await supabaseAdmin.from('credit_usage').insert({
      user_id: actualUserId,
      model: model,
      credits_used: creditsUsed
    });

    return NextResponse.json({ result, creditsUsed });
  } catch (error: unknown) {
    console.error('Error processing request:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
