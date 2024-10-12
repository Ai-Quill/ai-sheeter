import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('user_email');

    if (!userEmail) {
      return NextResponse.json({ error: 'User email is required' }, { status: 400 });
    }

    const { data: prompts, error } = await supabaseAdmin
      .from('user_prompts')
      .select('*')
      .eq('user_email', userEmail);

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
    const { name, prompt, variables, user_email } = await request.json();

    if (!name || !prompt || !user_email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('user_prompts')
      .insert({ name, prompt, variables, user_email })
      .select()
      .single();

    if (error) {
      console.error('Error creating prompt:', error);
      return NextResponse.json({ error: 'Failed to create prompt: ' + error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'No data returned from database' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Internal server error: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const { id, name, prompt, variables, user_email } = await request.json();

    if (!id || !name || !prompt || !user_email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('user_prompts')
      .update({ name, prompt, variables })
      .eq('id', id)
      .eq('user_email', user_email)
      .select()
      .single();

    if (error) {
      console.error('Error updating prompt:', error);
      return NextResponse.json({ error: 'Failed to update prompt: ' + error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Prompt not found or user not authorized' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Internal server error: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userEmail = searchParams.get('user_email');

    if (!id || !userEmail) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('user_prompts')
      .delete()
      .eq('id', id)
      .eq('user_email', userEmail);

    if (error) {
      console.error('Error deleting prompt:', error);
      return NextResponse.json({ error: 'Failed to delete prompt: ' + error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Prompt deleted successfully' });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Internal server error: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}
