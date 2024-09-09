import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    const { error } = await supabaseAdmin
      .from('waitlist')
      .upsert({ 
        email: email
      }, { 
        onConflict: 'email' 
      })

    if (error) {
      console.error('Error adding to waitlist:', error)
      return NextResponse.json({ error: 'Failed to join waitlist' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Successfully joined waitlist' })
  } catch (error: unknown) {
    console.error('Error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}