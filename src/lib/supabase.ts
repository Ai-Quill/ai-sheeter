import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Admin Client
 * 
 * Uses service role key for backend operations that bypass Row Level Security (RLS).
 * This is the recommended approach for server-side API routes.
 * 
 * Environment Variables:
 * - SUPABASE_URL: Project URL (e.g., https://xxx.supabase.co)
 * - SUPABASE_SERVICE_ROLE_KEY: Secret service role key (never expose to client)
 * 
 * @see https://supabase.com/docs/guides/api#creating-api-routes
 */

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

// Export URL for direct connections if needed
export const SUPABASE_URL = supabaseUrl;