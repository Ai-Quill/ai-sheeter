import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { model, apiKey, userEmail } = await req.json()

    // Log the received data (be careful not to log the full API key in production)
    console.log('Received data:', { model, userEmail, apiKeyLength: apiKey?.length })

    if (!model || !apiKey || !userEmail) {
      console.error('Missing required fields:', { model: !!model, apiKey: !!apiKey, userEmail: !!userEmail })
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { error, data } = await supabaseAdmin
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
      console.error('Error details:', JSON.stringify(error, null, 2))
      return NextResponse.json({ error: 'Failed to save API key', details: error }, { status: 500 })
    }

    console.log('API key saved successfully:', { userEmail, model })
    return NextResponse.json({ message: 'API key saved successfully', data })
  } catch (error: unknown) {
    console.error('Caught error:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    } else {
      console.error('Non-Error object thrown:', String(error))
    }
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 })
  }
}