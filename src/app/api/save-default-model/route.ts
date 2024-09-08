import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const { model, defaultModel, userId } = await req.json()

    const { error } = await supabaseAdmin
      .from('api_keys')
      .update({ default_model: defaultModel })
      .eq('user_id', userId)
      .eq('model', model)

    if (error) {
      return NextResponse.json({ error: 'Failed to update default model' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Default model updated successfully' })
  } catch (error: unknown) {
    console.error('Error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}