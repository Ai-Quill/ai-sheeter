import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request): Promise<Response> {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Try to get existing user
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw new Error('Failed to fetch user: ' + fetchError.message);
    }

    // If user doesn't exist, create a new one
    if (!user) {
      const { data: newUser, error: insertError } = await supabaseAdmin
        .from('users')
        .insert({ email })
        .select()
        .single();

      if (insertError) {
        throw new Error('Failed to create user: ' + insertError.message);
      }

      if (!newUser) {
        throw new Error('Failed to get or create user');
      }

      return NextResponse.json({ userId: newUser.id });
    }

    return NextResponse.json({ userId: user.id });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Internal server error: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}
