import { handleAuth, handleCallback } from '@auth0/nextjs-auth0'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const GET = handleAuth({
  // @ts-ignore - suppressing implicit any error for req and res
  callback: async (req, res) => {
    try {
      // @ts-ignore
      const session = await handleCallback(req, res)
      // @ts-ignore
      const user = session?.user

      if (user?.sub) {
        const { data } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('auth0_id', user.sub)
          .single()

        if (!data) {
          await supabaseAdmin.from('users').insert([{
            auth0_id: user.sub,
            email: user.email,
            name: user.name,
            avatar_url: user.picture,
          }])
        }
      }

      return session
    } catch (error) {
      console.error('Auth0 callback error:', error)
      throw error
    }
  }
})

export const POST = handleAuth()
