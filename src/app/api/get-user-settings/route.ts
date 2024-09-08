import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

interface ApiKeyData {
  model: string;
  api_key: string;
  default_model: string;
}

interface Settings {
  [key: string]: {
    apiKey: string;
    defaultModel: string;
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userEmail = searchParams.get('userEmail');

  if (!userEmail) {
    return NextResponse.json({ error: 'User email is required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .select('model, api_key, default_model')
      .eq('user_email', userEmail);

    if (error) throw error;

    // Transform the data into the expected format
    const settings: Settings = (data as ApiKeyData[]).reduce((acc, item) => {
      acc[item.model] = {
        apiKey: item.api_key, // Keep the API key encrypted
        defaultModel: item.default_model
      };
      return acc;
    }, {} as Settings);

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error fetching user settings:', error);
    return NextResponse.json({ error: 'Failed to fetch user settings' }, { status: 500 });
  }
}