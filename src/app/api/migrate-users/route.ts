import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(): Promise<Response> {
  try {
    // Get user IDs from each table
    const { data: promptUserIds, error: promptError } = await supabaseAdmin
      .from('user_prompts')
      .select('user_id');

    const { data: apiKeyUserIds, error: apiKeyError } = await supabaseAdmin
      .from('api_keys')
      .select('user_id');

    const { data: creditUsageUserIds, error: creditUsageError } = await supabaseAdmin
      .from('credit_usage')
      .select('user_id');

    if (promptError || apiKeyError || creditUsageError) {
      throw new Error('Failed to fetch user IDs: ' + 
        (promptError || apiKeyError || creditUsageError)?.message);
    }

    // Combine and deduplicate user IDs
    const allUserIds = [
      ...(promptUserIds || []),
      ...(apiKeyUserIds || []),
      ...(creditUsageUserIds || [])
    ];
    const uniqueUserIds = Array.from(new Set(allUserIds.map(item => item.user_id).filter(Boolean)));

    // Fetch emails for these user IDs
    const { data: users, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .in('id', uniqueUserIds);

    if (userError) {
      throw new Error('Failed to fetch user data: ' + userError.message);
    }

    // Create a map of user IDs to emails
    const userMap = new Map(users?.map(user => [user.id, user.email]) || []);

    // Insert missing users into the users table
    for (const userId of uniqueUserIds) {
      if (!userMap.has(userId)) {
        const { error: insertError } = await supabaseAdmin
          .from('users')
          .insert({ id: userId, email: `unknown_${userId}@example.com` })
          .single();

        if (insertError) {
          console.error(`Failed to insert user ${userId}: ${insertError.message}`);
        }
      }
    }

    return NextResponse.json({ message: 'Migration completed successfully' });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: 'Migration failed: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}
