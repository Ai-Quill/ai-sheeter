import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import axios from 'axios';

interface StraticoModel {
  name: string;
  display_name: string;
  llm: string;
  credit_price_per_token: number;
}

interface StraticoApiModel {
  id: string;
  name: string;
  // Add other properties that the Stratico API returns, if any
}

async function fetchStraticoModels(apiKey: string): Promise<StraticoModel[]> {
  try {
    const response = await axios.get<{ data: StraticoApiModel[] }>('https://api.stratico.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data.data.map((model: StraticoApiModel) => ({
      name: model.id,
      display_name: model.name,
      llm: 'STRATICO',
      credit_price_per_token: 0.01 // You may need to adjust this value
    }));
  } catch (error) {
    console.error('Error fetching Stratico models:', error);
    return [];
  }
}

export async function GET(): Promise<Response> {
  try {
    // Fetch existing models from the database
    const { data: dbModels, error } = await supabaseAdmin
      .from('models')
      .select('name, display_name, llm, credit_price_per_token')
      .order('llm', { ascending: true })
      .order('display_name', { ascending: true });

    if (error) {
      console.error('Error fetching models from database:', error);
      return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 });
    }

    // Fetch Stratico models
    // Note: In a real-world scenario, you'd need to securely retrieve the API key
    // This is just a placeholder - replace with your actual method of retrieving the API key
    const straticoApiKey = process.env.STRATICO_API_KEY;
    let straticoModels: StraticoModel[] = [];
    if (straticoApiKey) {
      straticoModels = await fetchStraticoModels(straticoApiKey);
    }

    // Combine database models with Stratico models
    const allModels = [...dbModels, ...straticoModels];

    return NextResponse.json(allModels);
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
