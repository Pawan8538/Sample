import { handleAuth, handleCallback } from '@auth0/nextjs-auth0'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const GET = handleAuth({
  callback: async (req, res) => {
    try {
      const session = await handleCallback(req, res)

      console.log('Auth0 callback session:', {
        hasUser: !!session?.user,
        hasSub: !!session?.user?.sub,
        hasEmail: !!session?.user?.email,
        hasName: !!session?.user?.name,
        hasPicture: !!session?.user?.picture
      })

      const user = session?.user

      if (user?.sub) {
        const { data, error } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('auth0_id', user.sub)
          .single()

        if (!data) {
          console.log('Inserting new user into Supabase...')
          const { error: insertError } = await supabaseAdmin.from('users').insert([
            {
              auth0_id: user.sub,
              email: user.email,
              name: user.name,
              avatar_url: user.picture
            }
          ])
          if (insertError) throw insertError
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
