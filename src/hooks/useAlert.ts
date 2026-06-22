import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dismissAlert, getActiveAlert } from '../api/alerts'

// month = first day of the month, e.g. '2026-06-01'
export function useAlert(month: string) {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: ['alert', month],
    queryFn: () => getActiveAlert(month),
  })

  const dismiss = useMutation({
    mutationFn: dismissAlert,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['alert', month] })
      const prev = qc.getQueryData(['alert', month])
      qc.setQueryData(['alert', month], null) // optimistically hide the banner
      return { prev }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['alert', month], ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['alert', month] }),
  })

  return { ...query, dismiss }
}
