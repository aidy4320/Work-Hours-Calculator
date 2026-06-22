import { useQuery } from '@tanstack/react-query'
import { getSummary } from '../api/summary'

export function useSummary(year: number, month: number) {
  return useQuery({
    queryKey: ['summary', year, month],
    queryFn: () => getSummary(year, month),
  })
}
