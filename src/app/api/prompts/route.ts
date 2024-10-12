import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(): Promise<Response> {
  try {
    const { data: prompts, error } = await supabaseAdmin
      .from('user_prompts')
      .select('*');

    if (error) {
      console.error('Error fetching prompts:', error);
      return NextResponse.json({ error: 'Failed to fetch prompts' }, { status: 500 });
    }

    return NextResponse.json(prompts);
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { name, prompt, variables } = await request.json();

    const { data, error } = await supabaseAdmin
      .from('user_prompts')
      .insert({ name, prompt, variables })
      .single();

    if (error) {
      console.error('Error creating prompt:', error);
      return NextResponse.json({ error: 'Failed to create prompt' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// TODO: Implement PUT and DELETE methods similarly
