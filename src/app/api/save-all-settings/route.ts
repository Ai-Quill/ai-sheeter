import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// ... existing imports and supabase client creation ...

export async function POST(request: Request) {
  const { userEmail, settings } = await request.json();

  if (!userEmail || !settings) {
    return NextResponse.json({ error: 'User email and settings are required' }, { status: 400 });
  }

  try {
    // The API keys are already encrypted on the client side, so we can save them directly
    const { data, error } = await supabaseAdmin
      .from('user_settings')
      .upsert({ user_email: userEmail, ...settings })
      .select();

    if (error) throw error;

    return NextResponse.json({ message: 'Settings saved successfully', data });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}