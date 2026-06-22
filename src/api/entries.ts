import { supabase } from '../lib/supabase'
import type { EntryType, TimeEntry } from '../types/models'

export interface EntryInput {
  entry_date: string // YYYY-MM-DD
  entry_type: EntryType
  hours_worked?: number
  notes?: string
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// Client-side guard mirroring the DB CHECK constraints (SPEC §3, Edge Cases §1/§2).
// Returns an error message, or null when valid.
export function validateEntryInput(input: EntryInput): string | null {
  if (input.entry_date > todayISO()) {
    return 'You can’t log time for a future date.'
  }
  if (input.entry_type === 'work') {
    const h = input.hours_worked
    if (h == null || Number.isNaN(h)) return 'Enter how many hours you worked.'
    if (h < 0) return 'Hours can’t be negative.'
    if (Math.abs(h * 100 - Math.round(h * 100)) > 1e-9) return 'Use at most two decimal places.'
  }
  return null
}

export async function listEntries(year: number, month: number): Promise<TimeEntry[]> {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const end = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10) // first of next month
  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .gte('entry_date', start)
    .lt('entry_date', end)
    .order('entry_date', { ascending: true })
  if (error) throw error
  return data
}

export async function createEntry(input: EntryInput): Promise<TimeEntry> {
  const invalid = validateEntryInput(input)
  if (invalid) throw new Error(invalid)
  const row = {
    entry_date: input.entry_date,
    entry_type: input.entry_type,
    hours_worked: input.entry_type === 'work' ? (input.hours_worked ?? 0) : 0,
    notes: input.notes ?? null,
  }
  const { data, error } = await supabase.from('time_entries').insert(row).select().single()
  if (error) throw error
  return data
}

export async function updateEntry(
  id: number,
  patch: { hours_worked?: number; notes?: string | null; entry_type?: EntryType },
): Promise<TimeEntry> {
  const { data, error } = await supabase
    .from('time_entries')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteEntry(id: number): Promise<void> {
  const { error } = await supabase.from('time_entries').delete().eq('id', id)
  if (error) throw error
}
