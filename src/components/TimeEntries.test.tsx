import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const create = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }
const update = { mutateAsync: vi.fn().mockResolvedValue({}) }
const remove = { mutate: vi.fn() }

let entries: unknown[] = []

vi.mock('../hooks/useEntries', () => ({
  useEntries: () => ({ data: entries, isLoading: false, isError: false, create, update, remove }),
}))

import { TimeEntries } from './TimeEntries'

beforeEach(() => {
  entries = []
  create.mutateAsync.mockClear()
  update.mutateAsync.mockClear()
  remove.mutate.mockClear()
})

describe('TimeEntries', () => {
  it('shows the empty state when there are no entries', () => {
    render(<TimeEntries year={2026} month={6} />)
    expect(screen.getByText(/No entries yet this month/)).toBeInTheDocument()
  })

  it('shows the hours field for work and hides it for day-off types', () => {
    render(<TimeEntries year={2026} month={6} />)
    expect(screen.getByLabelText('Hours')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'vacation' } })
    expect(screen.queryByLabelText('Hours')).not.toBeInTheDocument()
  })

  it('blocks a work entry with no hours and shows a clear error', () => {
    render(<TimeEntries year={2026} month={6} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add entry' }))
    expect(screen.getByText('Enter how many hours you worked.')).toBeInTheDocument()
    expect(create.mutateAsync).not.toHaveBeenCalled()
  })

  it('submits a valid work entry', () => {
    render(<TimeEntries year={2026} month={6} />)
    fireEvent.change(screen.getByLabelText('Hours'), { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add entry' }))
    expect(create.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ entry_type: 'work', hours_worked: 8 }),
    )
  })

  it('renders an entry and deletes it after confirmation', () => {
    entries = [
      {
        id: 1,
        user_id: 'u',
        entry_date: '2026-06-10',
        entry_type: 'work',
        hours_worked: 5,
        notes: null,
        created_at: '',
        updated_at: '',
      },
    ]
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<TimeEntries year={2026} month={6} />)
    expect(screen.getByText('5.00 h')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(remove.mutate).toHaveBeenCalledWith(1)
  })
})
