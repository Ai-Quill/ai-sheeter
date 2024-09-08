import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

interface SettingsData {
  apiKey: string;
  defaultModel: string;
}

interface Settings {
  [key: string]: SettingsData;
}

export async function POST(request: Request) {
  const { userEmail, settings }: { userEmail: string; settings: Settings } = await request.json();

  if (!userEmail || !settings) {
    return NextResponse.json({ error: 'User email and settings are required' }, { status: 400 });
  }

  try {
    const apiKeys = Object.entries(settings).map(([model, data]) => ({
      user_email: userEmail,
      model,
      api_key: data.apiKey,
      default_model: data.defaultModel
    }));

    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .upsert(apiKeys, { onConflict: 'user_email,model' })
      .select();

    if (error) throw error;

    return NextResponse.json({ message: 'Settings saved successfully', data });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}