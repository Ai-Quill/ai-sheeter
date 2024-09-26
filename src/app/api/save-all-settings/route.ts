import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

interface SettingsData {
  apiKey: string;
  defaultModel: string;
}


interface SaveSettingsData {
  apiKey: string;
  defaultModel: string;
  // Add other properties if needed
}

export async function POST(request: Request) {
  console.log('Received POST request');
  
  let userEmail, settings;
  try {
    const body = await request.json();
    console.log('Received body:', body);
    ({ userEmail, settings } = body);
    console.log('Parsed request body:', { userEmail, settings });
  } catch (error) {
    console.error('Error parsing request body:', error);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!userEmail || !settings) {
    console.error('Missing required fields:', { userEmail, settings });
    return NextResponse.json({ error: 'User email and settings are required' }, { status: 400 });
  }

  try {
    const apiKeys = Object.entries(settings).map(([model, data]) => {
      console.log('Processing model:', model, 'with data:', data);
      return {
        user_email: userEmail,
        model,
        api_key: (data as SaveSettingsData).apiKey,
        default_model: (data as SaveSettingsData).defaultModel
      };
    });
    console.log('Prepared apiKeys for upsert:', apiKeys);

    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .upsert(apiKeys, { onConflict: 'user_email,model' })
      .select();

    if (error) {
      console.error('Supabase upsert error:', error);
      throw error;
    }

    console.log('Upsert successful, returned data:', data);
    return NextResponse.json({ message: 'Settings saved successfully', data });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}

export interface Settings {
  [key: string]: SettingsData;
}