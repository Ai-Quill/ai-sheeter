import { NextResponse } from 'next/server'
import axios from 'axios'
import { supabase } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const { model, input, userId } = await req.json()

    // Fetch API key from Supabase
    const { data, error } = await supabase
      .from('api_keys')
      .select('api_key')
      .eq('user_id', userId)
      .eq('model', model)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    const apiKey = data.api_key

    const modelConfigs: Record<string, any> = {
      CHATGPT: {
        url: 'https://api.openai.com/v1/chat/completions',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        data: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: input }]
        },
        extractResponse: (data: any) => data.choices[0].message.content
      },
      CLAUDE: {
        url: 'https://api.anthropic.com/v1/messages',
        headers: { 'x-api-key': apiKey },
        data: {
          model: 'claude-2.1',
          messages: [{ role: 'user', content: input }]
        },
        extractResponse: (data: any) => data.content[0].text
      },
      GROQ: {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        data: {
          model: 'mixtral-8x7b-32768',
          messages: [{ role: 'user', content: input }]
        },
        extractResponse: (data: any) => data.choices[0].message.content
      },
      GEMINI: {
        url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
        params: { key: apiKey },
        data: {
          contents: [{ parts: [{ text: input }] }]
        },
        extractResponse: (data: any) => data.candidates[0].content.parts[0].text
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

    return NextResponse.json({ result })
  } catch (error: any) {
    console.error('Error:', error.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}