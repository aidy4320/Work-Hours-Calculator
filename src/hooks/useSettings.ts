import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSettings, updateSettings } from '../api/settings'
import type { UserSettings } from '../types/models'

export function useSettings() {
  const qc = useQueryClient()
  const query = useQuery({ queryKey: ['settings'], queryFn: getSettings })

  const update = useMutation({
    mutationFn: updateSettings,
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ['settings'] })
      const prev = qc.getQueryData<UserSettings>(['settings'])
      if (prev) qc.setQueryData<UserSettings>(['settings'], { ...prev, ...patch })
      return { prev }
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.prev) qc.setQueryData(['settings'], ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      // standard_daily_hours feeds the summary credit
      qc.invalidateQueries({ queryKey: ['summary'] })
    },
  })

  return { ...query, update }
}
