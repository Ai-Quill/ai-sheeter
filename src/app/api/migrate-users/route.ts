import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(): Promise<Response> {
  try {
    // Get user emails from each table
    const { data: promptEmails, error: promptError } = await supabaseAdmin
      .from('user_prompts')
      .select('user_email');

    const { data: apiKeyEmails, error: apiKeyError } = await supabaseAdmin
      .from('api_keys')
      .select('user_email');

    const { data: creditUsageEmails, error: creditUsageError } = await supabaseAdmin
      .from('credit_usage')
      .select('user_email');

    if (promptError || apiKeyError || creditUsageError) {
      throw new Error('Failed to fetch user emails: ' + 
        (promptError || apiKeyError || creditUsageError)?.message);
    }

    // Combine and deduplicate emails
    const allEmails = [
      ...(promptEmails || []),
      ...(apiKeyEmails || []),
      ...(creditUsageEmails || [])
    ];
    const uniqueEmails = Array.from(new Set(allEmails.map(item => item.user_email).filter(Boolean)));

    // Insert users into the new users table
    for (const email of uniqueEmails) {
      const { error: insertError } = await supabaseAdmin
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
