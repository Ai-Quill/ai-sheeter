import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  const { name, email, message } = await request.json();

  try {
    const { error } = await supabase
      .from('contact_submissions')
      .insert([{ name, email, message }]);

    if (error) throw error;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error submitting form:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred while submitting the form.' },
      { status: 500 }
    );
  }
}