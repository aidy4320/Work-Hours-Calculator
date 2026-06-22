import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createEntry,
  deleteEntry,
  listEntries,
  updateEntry,
  type EntryInput,
} from '../api/entries'
import type { TimeEntry } from '../types/models'

export function useEntries(year: number, month: number) {
  const qc = useQueryClient()
  const key = ['entries', year, month] as const

  const query = useQuery({ queryKey: key, queryFn: () => listEntries(year, month) })

  // Hours/day-off changes affect the month total, the alert, and the summary.
  function invalidateMonth() {
    qc.invalidateQueries({ queryKey: key })
    qc.invalidateQueries({ queryKey: ['summary', year, month] })
    qc.invalidateQueries({ queryKey: ['alert'] })
  }

  const create = useMutation({
    mutationFn: (input: EntryInput) => createEntry(input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<TimeEntry[]>(key) ?? []
      const temp: TimeEntry = {
        id: -Date.now(),
        user_id: 'optimistic',
        entry_date: input.entry_date,
        entry_type: input.entry_type,
        hours_worked: input.entry_type === 'work' ? (input.hours_worked ?? 0) : 0,
        notes: input.notes ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      qc.setQueryData<TimeEntry[]>(
        key,
        [...prev, temp].sort((a, b) => a.entry_date.localeCompare(b.entry_date)),
      )
      return { prev }
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
    },
    onSettled: invalidateMonth,
  })

  const update = useMutation({
    mutationFn: (vars: { id: number; patch: Parameters<typeof updateEntry>[1] }) =>
      updateEntry(vars.id, vars.patch),
    onSettled: invalidateMonth,
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteEntry(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<TimeEntry[]>(key) ?? []
      qc.setQueryData<TimeEntry[]>(key, prev.filter((e) => e.id !== id))
      return { prev }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
    },
    onSettled: invalidateMonth,
  })

  return { ...query, create, update, remove }
}
