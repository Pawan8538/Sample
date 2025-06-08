import { z } from 'zod'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { upsertUserFromAuth0, getUserByAuth0Id } from '@/lib/supabase'

export const userRouter = createTRPCRouter({
  // Get current user
  me: protectedProcedure.query(async ({ ctx }) => {
    try {
      const user = await getUserByAuth0Id(ctx.session.user.sub)
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        })
      }
      return user
    } catch (error) {
      console.error('Error in me query:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get user',
        cause: error,
      })
    }
  }),

  // Create or update user from Auth0 data
  upsertFromAuth0: publicProcedure
    .input(
      z.object({
        sub: z.string().min(1, 'Auth0 ID is required'),
        email: z.string().email('Invalid email'),
        name: z.string().optional(),
        picture: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        console.log('Attempting to upsert user:', { 
          sub: input.sub,
          email: input.email,
          hasName: !!input.name,
          hasPicture: !!input.picture
        })

        if (!input.sub || !input.email) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Auth0 ID and email are required',
          })
        }

        const user = await upsertUserFromAuth0(input)
        console.log('Successfully upserted user:', { id: user.id, email: user.email })
        return user
      } catch (error) {
        console.error('Error in upsertFromAuth0:', error)
        
        if (error instanceof TRPCError) {
          throw error
        }

        // Handle Supabase errors
        if (error instanceof Error) {
          if (error.message.includes('duplicate key')) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'User already exists',
              cause: error,
            })
          }
          if (error.message.includes('auth')) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'Database authentication failed',
              cause: error,
            })
          }
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create/update user',
          cause: error,
        })
      }
    }),

  // Update user profile
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().optional(),
        picture_url: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const user = await getUserByAuth0Id(ctx.session.user.sub)
        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          })
        }

        // Update user in database
        const { data, error } = await ctx.supabase
          .from('users')
          .update(input)
          .eq('auth0_id', ctx.session.user.sub)
          .select()
          .single()

        if (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to update user',
            cause: error,
          })
        }

        return data
      } catch (error) {
        if (error instanceof TRPCError) throw error
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update user profile',
          cause: error,
        })
      }
    }),
}) 