'use client'

import React from 'react'
import { UserProvider } from '@auth0/nextjs-auth0/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { trpc } from '@/lib/trpc'
import { httpBatchLink } from '@trpc/client'
import superjson from 'superjson'

const queryClient = new QueryClient()
const trpcClient = trpc.createClient({
  transformer: superjson,
  links: [
    httpBatchLink({ url: '/api/trpc' }),
  ],
})

export function Providers({ children }: { children: React.ReactNode }) {
  console.log('Basic Providers rendering')
  return (
    <UserProvider>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </trpc.Provider>
    </UserProvider>
  )
} 