import { describe, it, expect } from 'vitest'
import { validateEntryInput } from './entries'

const today = new Date().toISOString().slice(0, 10)

describe('validateEntryInput', () => {
  it('accepts a valid work entry', () => {
    expect(validateEntryInput({ entry_date: today, entry_type: 'work', hours_worked: 7.5 })).toBeNull()
  })
  it('rejects future dates', () => {
    expect(
      validateEntryInput({ entry_date: '2999-01-01', entry_type: 'work', hours_worked: 8 }),
    ).toMatch(/future/i)
  })
  it('rejects negative hours', () => {
    expect(
      validateEntryInput({ entry_date: today, entry_type: 'work', hours_worked: -1 }),
    ).toMatch(/negative/i)
  })
  it('rejects more than two decimals', () => {
    expect(
      validateEntryInput({ entry_date: today, entry_type: 'work', hours_worked: 7.555 }),
    ).toMatch(/two decimal/i)
  })
  it('requires hours for a work entry', () => {
    expect(validateEntryInput({ entry_date: today, entry_type: 'work' })).toMatch(/how many hours/i)
  })
  it('allows a vacation day with no hours', () => {
    expect(validateEntryInput({ entry_date: today, entry_type: 'vacation' })).toBeNull()
  })
})
