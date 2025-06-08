import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { supabaseAdmin } from './supabase-admin'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL')
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

// Client-side Supabase instance
export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
)

// Helper function to get user by Auth0 ID
export async function getUserByAuth0Id(auth0Id: string) {
  try {
    // Use admin client for server-side operations
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('auth0_id', auth0Id)
      .single()

    if (error) {
      console.error('Error fetching user by Auth0 ID:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('Error in getUserByAuth0Id:', error)
    throw error
  }
}

// Helper function to create or update user from Auth0 data
export async function upsertUserFromAuth0(auth0User: {
  sub: string
  email: string
  name?: string
  picture?: string
}) {
  try {
    console.log('Upserting user in Supabase:', {
      auth0Id: auth0User.sub,
      email: auth0User.email,
      hasName: !!auth0User.name,
      hasPicture: !!auth0User.picture
    })

    // Use admin client for server-side operations
    const { data, error } = await supabaseAdmin
      .from('users')
      .upsert({
        auth0_id: auth0User.sub,
        email: auth0User.email,
        name: auth0User.name || null,
        picture_url: auth0User.picture || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'auth0_id',
        ignoreDuplicates: false
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase upsert error:', error)
      throw error
    }

    if (!data) {
      throw new Error('No data returned from upsert operation')
    }

    console.log('Successfully upserted user in Supabase:', {
      id: data.id,
      email: data.email
    })

    return data
  } catch (error) {
    console.error('Error in upsertUserFromAuth0:', error)
    throw error
  }
}

// Helper function to get user's conversations
export async function getUserConversations(userId: string) {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data
}

// Helper function to get conversation messages
export async function getConversationMessages(conversationId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      generated_images (*)
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
} 