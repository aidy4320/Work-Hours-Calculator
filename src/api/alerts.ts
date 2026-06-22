import { supabase } from '../lib/supabase'
import type { Alert } from '../types/models'

// month = first day of the month, e.g. '2026-06-01'
export async function getActiveAlert(month: string): Promise<Alert | null> {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('month', month)
    .eq('dismissed', false)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function dismissAlert(id: number): Promise<void> {
  const { error } = await supabase.from('alerts').update({ dismissed: true }).eq('id', id)
  if (error) throw error
}
