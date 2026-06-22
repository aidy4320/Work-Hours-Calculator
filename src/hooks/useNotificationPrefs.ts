import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getNotificationPrefs, updateNotificationPrefs } from '../api/notifications'
import type { NotificationSettings } from '../types/models'

export function useNotificationPrefs() {
  const qc = useQueryClient()
  const query = useQuery({ queryKey: ['notificationPrefs'], queryFn: getNotificationPrefs })

  const update = useMutation({
    mutationFn: updateNotificationPrefs,
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ['notificationPrefs'] })
      const prev = qc.getQueryData<NotificationSettings>(['notificationPrefs'])
      if (prev) qc.setQueryData<NotificationSettings>(['notificationPrefs'], { ...prev, ...patch })
      return { prev }
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.prev) qc.setQueryData(['notificationPrefs'], ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['notificationPrefs'] }),
  })

  return { ...query, update }
}
