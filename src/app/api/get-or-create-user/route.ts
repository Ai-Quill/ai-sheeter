import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request): Promise<Response> {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Try to get existing user
    let { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

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

      user = newUser;
    }

    return NextResponse.json({ userId: user.id });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Internal server error: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}
