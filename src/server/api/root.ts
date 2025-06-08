import { initTRPC } from '@trpc/server'
import superjson from 'superjson'
import { ZodError } from 'zod'
import { chatRouter } from './routers/chat'
import { userRouter } from './routers/user'

const t = initTRPC.create({
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

export const appRouter = createTRPCRouter({
  chat: chatRouter,
  user: userRouter,
})

export type AppRouter = typeof appRouter 