import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request): Promise<Response> {
  try {
    // Get all unique user emails from existing tables
    const { data: userEmails, error: emailError } = await supabaseAdmin
      .from('user_prompts')
      .select('user_email')
      .union(
        supabaseAdmin.from('api_keys').select('user_email'),
        supabaseAdmin.from('credit_usage').select('user_email')
      );

    if (emailError) {
      throw new Error('Failed to fetch user emails: ' + emailError.message);
    }

    const uniqueEmails = [...new Set(userEmails.map(item => item.user_email))];

    // Insert users into the new users table
    for (const email of uniqueEmails) {
      const { data: user, error: insertError } = await supabaseAdmin
        .from('users')
        .insert({ email })
        .select()
        .single();

      if (insertError && insertError.code !== '23505') { // Ignore unique constraint violations
        console.error(`Failed to insert user ${email}: ${insertError.message}`);
      }
    }

    // Update existing tables with user_id
    const tables = ['user_prompts', 'api_keys', 'credit_usage'];
    for (const table of tables) {
      const { error: updateError } = await supabaseAdmin.rpc('update_user_ids', { table_name: table });
      if (updateError) {
        throw new Error(`Failed to update ${table}: ${updateError.message}`);
      }
    }

    return NextResponse.json({ message: 'Migration completed successfully' });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: 'Migration failed: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}
