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
  const userId = searchParams.get('userId');

  if (!userEmail && !userId) {
    return NextResponse.json({ error: 'User identification is required' }, { status: 400 });
  }

  try {
    let query = supabaseAdmin
      .from('api_keys')
      .select('model, api_key, default_model');

    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      // First, get the user_id from the email
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', userEmail)
        .single();

      if (userError) {
        console.error('Error fetching user:', userError);
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      query = query.eq('user_id', userData.id);
    }

    const { data, error } = await query;

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
