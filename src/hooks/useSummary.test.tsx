import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi } from 'vitest'

vi.mock('../api/summary', () => ({
  getSummary: vi.fn().mockResolvedValue({
    year: 2026,
    month: 6,
    target_hours: 100,
    worked_hours: 38,
    remaining_hours: 62,
    percent_complete: 38,
    goal_reached: false,
    is_current_month: true,
    daily_breakdown: [],
  }),
}))

import { useSummary } from './useSummary'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useSummary', () => {
  it('returns the monthly summary (worked includes credited hours)', async () => {
    const { result } = renderHook(() => useSummary(2026, 6), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.worked_hours).toBe(38)
    expect(result.current.data?.remaining_hours).toBe(62)
  })
})
