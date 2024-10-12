import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(): Promise<Response> {
  try {
    console.log('Starting migration process...');

    // Get all unique emails from api_keys table
    const { data: apiKeyEmails, error: apiKeyError } = await supabaseAdmin
      .from('api_keys')
      .select('user_email')
      .not('user_email', 'is', null);

    if (apiKeyError) {
      throw new Error('Failed to fetch user emails: ' + apiKeyError.message);
    }

    const uniqueEmails = Array.from(new Set(apiKeyEmails?.map(item => item.user_email) || []));
    console.log('Unique emails found:', uniqueEmails.length);

    // Insert users into the users table
    for (const email of uniqueEmails) {
      const { data: existingUser, error: checkError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error(`Error checking existing user for ${email}:`, checkError);
        continue;
      }

      if (!existingUser) {
        const { error: insertError } = await supabaseAdmin
          .from('users')
          .insert({ email })
          .single();

        if (insertError) {
          console.error(`Failed to insert user ${email}:`, insertError);
        } else {
          console.log(`Inserted new user: ${email}`);
        }
      }
    }

    // Update other tables with user_id
    const tables = ['user_prompts', 'api_keys', 'credit_usage'];
    for (const table of tables) {
      const { error: updateError } = await supabaseAdmin.rpc('update_user_ids', { table_name: table });
      if (updateError) {
        console.error(`Failed to update ${table}:`, updateError);
      } else {
        console.log(`Updated ${table} with user_ids`);
      }
    }

    console.log('Migration completed successfully');
    return NextResponse.json({ message: 'Migration completed successfully' });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: 'Migration failed: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}
