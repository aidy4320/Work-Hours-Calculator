import { supabase } from '../lib/supabase'
import type { MonthlySummary } from '../types/models'

// Server-computed: logged work hours + vacation/holiday credit (PLAN §4/§5.4).
export async function getSummary(year: number, month: number): Promise<MonthlySummary> {
  const { data, error } = await supabase.rpc('get_monthly_summary', {
    p_year: year,
    p_month: month,
  })
  if (error) throw error
  return data as unknown as MonthlySummary
}
