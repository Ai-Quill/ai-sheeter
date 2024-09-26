import { NextResponse } from 'next/server';
import { decryptApiKey } from '@/utils/encryption';
import OpenAI from 'openai';
import { supabaseAdmin } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';
import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request): Promise<Response> {
  const { model, input, userEmail, specificModel, encryptedApiKey } = await req.json();

  if (!model || !input || !userEmail || !encryptedApiKey) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  try {
    const decryptedApiKey = decryptApiKey(encryptedApiKey);

    if (!decryptedApiKey) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    let selectedModel = specificModel;
    if (!selectedModel) {
      const { data, error } = await supabaseAdmin
        .from('api_keys')
        .select('default_model')
        .eq('user_email', userEmail)
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
          const chatGptResponse = await openai.chat.completions.create({
            model: selectedModel,
            messages: [{ role: 'user', content: input }],
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

          const claudeResponse = await anthropic.messages.create({
            model: selectedModel,
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
        creditsUsed = groqResponse.usage?.total_tokens ?? 0 * creditPricePerToken;
        break;

      case 'GEMINI':
        const genAI = new GoogleGenerativeAI(decryptedApiKey);
        const geminiModel = genAI.getGenerativeModel({ model: selectedModel });
        
        // Count tokens
        const tokenCount = await geminiModel.countTokens(input);
        
        // Generate content
        const geminiResult = await geminiModel.generateContent(input);
        const geminiResponse = await geminiResult.response;
        
        result = geminiResponse.text();
        creditsUsed = tokenCount.totalTokens * creditPricePerToken;
        break;

      default:
        console.error('Unsupported model:', model);
        return NextResponse.json({ error: 'Unsupported model' }, { status: 400 });
    }

    await supabaseAdmin.from('credit_usage').insert({
      user_email: userEmail,
      model: model,
      credits_used: creditsUsed
    });

    return NextResponse.json({ result, creditsUsed });
  } catch (error: unknown) {
    console.error('Error processing request:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}