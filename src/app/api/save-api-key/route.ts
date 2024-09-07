import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const { model, apiKey, userEmail } = await req.json()

    const { error } = await supabase
      .from('api_keys')
      .upsert({ 
        user_email: userEmail, 
        model: model, 
        api_key: apiKey 
      }, { 
        onConflict: 'user_email,model' 
      })

    if (error) {
      console.error('Error saving API key:', error)
      return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 })
    }

    return NextResponse.json({ message: 'API key saved successfully' })
  } catch (error: unknown) {
    console.error('Error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}