import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const userEmail = searchParams.get('userEmail')

  if (!userEmail) {
    return NextResponse.json({ error: 'User email is required' }, { status: 400 })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .select('model, api_key, default_model')
      .eq('user_email', userEmail)

    if (error) {
      console.error('Error fetching user settings:', error)
      return NextResponse.json({ error: 'Failed to fetch user settings' }, { status: 500 })
    }

    const settings = data.reduce((acc: Record<string, { apiKey: string, defaultModel: string }>, item) => {
      acc[item.model] = {
        apiKey: item.api_key,
        defaultModel: item.default_model
      }
      return acc
    }, {})

    return NextResponse.json({ settings })
  } catch (error: unknown) {
    console.error('Error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}