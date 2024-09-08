import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userEmail = searchParams.get('userEmail');

  if (!userEmail) {
    return NextResponse.json({ error: 'User email is required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('user_settings')
      .select('*')
      .eq('user_email', userEmail)
      .single();

    if (error) throw error;

    // The API keys are already encrypted, so we can send them directly to the client
    return NextResponse.json({ settings: data || {} });
  } catch (error) {
    console.error('Error fetching user settings:', error);
    return NextResponse.json({ error: 'Failed to fetch user settings' }, { status: 500 });
  }
}