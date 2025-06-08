// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    pathname: '/',
    query: {},
  }),
}))

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock tRPC
jest.mock('@/lib/trpc', () => ({
  trpc: {
    useQuery: jest.fn(),
    useMutation: jest.fn(),
    useUtils: jest.fn(() => ({
      chat: {
        getAll: {
          invalidate: jest.fn(),
        },
      },
    })),
  },
}))

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
    })),
  },
  supabaseAdmin: {
    from: jest.fn(() => ({
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      eq: jest.fn(),
      order: jest.fn(),
    })),
  },
}))

// Mock Auth0
jest.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    isAuthenticated: true,
    user: {
      sub: 'auth0|123',
      email: 'test@example.com',
      name: 'Test User',
    },
    loginWithRedirect: jest.fn(),
    logout: jest.fn(),
    getAccessTokenSilently: jest.fn().mockResolvedValue('mock-token'),
  }),
  Auth0Provider: ({ children }) => children,
})) 