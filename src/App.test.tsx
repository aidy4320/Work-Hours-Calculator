import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the shared Supabase client so auth flows run without a backend.
// vi.hoisted lets the (hoisted) vi.mock factory reference `auth` safely.
const { auth } = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
  },
}))
vi.mock('./lib/supabase', () => ({ supabase: { auth } }))

// Home renders the Dashboard; stub its data hook so routing tests stay focused on auth.
vi.mock('./hooks/useSummary', () => ({
  useSummary: () => ({ data: null, isLoading: true, isError: false }),
}))

import App from './App'

describe('auth routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  })

  it('redirects unauthenticated users to the sign-in screen', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } })
    window.history.pushState({}, '', '/')
    render(<App />)
    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('shows the app home when a session exists', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { email: 'a@b.com' } } } })
    window.history.pushState({}, '', '/')
    render(<App />)
    expect(await screen.findByText(/your month, in hours/i)).toBeInTheDocument()
  })
})
