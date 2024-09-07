import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

interface ModelSettings {
  apiKey?: string;
  defaultModel: string;
}

interface Settings {
  [key: string]: ModelSettings;
}

export async function POST(req: Request) {
  try {
    const { userEmail, settings } = await req.json() as { userEmail: string; settings: Settings }

    const promises = Object.entries(settings).map(([model, modelSettings]) => {
      return supabase
        .from('api_keys')
        .upsert({ 
          user_email: userEmail, 
          model: model, 
          api_key: modelSettings.apiKey,
          default_model: modelSettings.defaultModel
        }, { 
          onConflict: 'user_email,model' 
        });
    });

    const results = await Promise.all(promises);

    const errors = results.filter(result => result.error);
    if (errors.length > 0) {
      console.error('Errors saving settings:', errors);
      return NextResponse.json({ error: 'Failed to save some settings' }, { status: 500 });
    }

    return NextResponse.json({ message: 'All settings saved successfully' });
  } catch (error: unknown) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}