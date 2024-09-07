import { NextResponse } from 'next/server'
import axios from 'axios'
import { supabase } from '@/lib/supabase'

interface ModelConfig {
  url: string;
  headers: Record<string, string>;
  data: Record<string, unknown>;
  params?: Record<string, string>;
  extractResponse: (data: unknown) => string;
  calculateCredits: (data: unknown) => number; // Add this line
}

// Define specific response types for each model
interface ChatGPTResponse {
  choices: Array<{ message: { content: string } }>;
  usage: {
    total_tokens: number;
  };
}

interface ClaudeResponse {
  content: Array<{ text: string }>;
  usage: {
    output_tokens: number;
  };
}

interface GroqResponse {
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

// interface CreditUsage {
//   model: string;
//   credits: number;
// }

export async function POST(req: Request) {
  try {
    const { model, input, userId, specificModel } = await req.json()

    // Fetch API key and default model from Supabase
    const { data, error } = await supabase
      .from('api_keys')
      .select('api_key, default_model')
      .eq('user_id', userId)
      .eq('model', model)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    const apiKey = data.api_key
    const selectedModel = specificModel || data.default_model

    const modelConfigs: Record<string, ModelConfig> = {
      CHATGPT: {
        url: 'https://api.openai.com/v1/chat/completions',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        data: {
          model: selectedModel || 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: input }]
        },
        extractResponse: (data: unknown) => (data as ChatGPTResponse).choices[0].message.content,
        calculateCredits: (data: unknown) => (data as ChatGPTResponse).usage.total_tokens / 1000
      },
      CLAUDE: {
        url: 'https://api.anthropic.com/v1/messages',
        headers: { 'x-api-key': apiKey },
        data: {
          model: selectedModel || 'claude-2.1',
          messages: [{ role: 'user', content: input }]
        },
        extractResponse: (data: unknown) => (data as ClaudeResponse).content[0].text,
        calculateCredits: (data: unknown) => (data as ClaudeResponse).usage.output_tokens / 1000
      },
      GROQ: {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        data: {
          model: selectedModel || 'mixtral-8x7b-32768',
          messages: [{ role: 'user', content: input }]
        },
        extractResponse: (data: unknown) => (data as GroqResponse).choices[0].message.content,
        calculateCredits: (data: unknown) => (data as GroqResponse).usage.total_tokens / 1000
      },
      GEMINI: {
        url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
        headers: {}, // Add this line
        params: { key: apiKey },
        data: {
          contents: [{ parts: [{ text: input }] }]
        },
        extractResponse: (data: unknown) => 
          (data as GeminiResponse).candidates[0].content.parts[0].text,
        calculateCredits: (data: unknown) => (data as GeminiResponse).usage.total_tokens / 1000
      }
    }

    const config = modelConfigs[model]
    if (!config) {
      return NextResponse.json({ error: 'Unsupported model' }, { status: 400 })
    }

    const response = await axios.post(config.url, config.data, {
      headers: config.headers,
      params: config.params
    })

    const result = config.extractResponse(response.data)
    const creditsUsed = config.calculateCredits(response.data)

    // Record credit usage
    await supabase.from('credit_usage').insert({
      user_id: userId,
      model: model,
      credits_used: creditsUsed
    })

    return NextResponse.json({ result, creditsUsed })
  } catch (error: unknown) {
    console.error('Error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}