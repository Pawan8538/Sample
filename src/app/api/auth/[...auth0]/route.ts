import { handleAuth, handleCallback } from '@auth0/nextjs-auth0'
import { supabaseAdmin } from '@/lib/supabase-admin'

const MAX_RETRIES = 3
const RETRY_DELAY = 1000 // 1 second

async function createUserInSupabase(user: any, retryCount = 0) {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('auth0_id', user.sub)
      .single()

    if (data) {
      return data
    }

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      throw error
    }

    // User doesn't exist, create them
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from('users')
      .insert([{
        auth0_id: user.sub,
        email: user.email,
        name: user.name,
        picture_url: user.picture,
      }])
      .select()
      .single()

    if (insertError) {
      throw insertError
    }

    return newUser
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
      return createUserInSupabase(user, retryCount + 1)
    }
    throw error
  }
}

export const GET = handleAuth({
  // @ts-ignore - suppressing implicit any error for req and res
  callback: async (req, res) => {
    try {
      // @ts-ignore
      const session = await handleCallback(req, res)
      // @ts-ignore
      const user = session?.user

      if (user?.sub) {
        await createUserInSupabase(user)
      }

      return session
    } catch (error) {
      console.error('Auth0 callback error:', error)
      throw error
    }
  }
})

export const POST = handleAuth()
