import { getSession } from '@auth0/nextjs-auth0'
import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { ZodError } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { type NextRequest } from 'next/server'

export const createTRPCContext = async (opts: { req: NextRequest }) => {
  const session = await getSession(opts.req)

  return {
    session,
    req: opts.req,
    supabase: supabaseAdmin, // Use admin client for server-side operations
  }
}

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

export const createTRPCRouter = t.router
export const publicProcedure = t.procedure

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
      supabase: ctx.supabase,
    },
  })
})

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed) 