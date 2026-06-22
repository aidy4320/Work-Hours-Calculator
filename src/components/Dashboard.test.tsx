import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('../hooks/useSummary', () => ({
  useSummary: () => ({
    data: {
      year: 2026,
      month: 6,
      target_hours: 160,
      worked_hours: 104.5,
      remaining_hours: 55.5,
      percent_complete: 65.31,
      goal_reached: false,
      is_current_month: true,
      daily_breakdown: [],
    },
    isLoading: false,
    isError: false,
  }),
}))

import { Dashboard } from './Dashboard'

describe('Dashboard', () => {
  it('shows logged, remaining and percent from the summary', () => {
    render(<Dashboard year={2026} month={6} />)
    expect(screen.getByText('104.50')).toBeInTheDocument()
    expect(screen.getByText('55.50')).toBeInTheDocument()
    expect(screen.getByText('160.00')).toBeInTheDocument()
    expect(screen.getByText('65%')).toBeInTheDocument()
    expect(screen.getByText(/June 2026/)).toBeInTheDocument()
  })
})
