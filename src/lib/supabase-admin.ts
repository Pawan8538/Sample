import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Debug logging (without exposing actual values)
console.log('Environment check:', {
  hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  urlLength: process.env.NEXT_PUBLIC_SUPABASE_URL?.length,
  keyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length
})

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL')
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing env.SUPABASE_SERVICE_ROLE_KEY')
}

// Create a Supabase client with the service role key for server-side operations
export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Verify the connection
supabaseAdmin.auth.getSession().then(
  () => console.log('Supabase admin client initialized successfully'),
  (error) => console.error('Failed to initialize Supabase admin client:', error)
) 