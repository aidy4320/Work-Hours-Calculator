import { supabase } from '../lib/supabase'
import type { UserSettings } from '../types/models'

// The user_settings row is created on signup (handle_new_user). RLS scopes
// every query to the caller's own row, so no explicit user filter is needed.
export async function getSettings(): Promise<UserSettings> {
  const { data, error } = await supabase.from('user_settings').select('*').single()
  if (error) throw error
  return data
}

export async function updateSettings(patch: {
  monthly_target_hours?: number
  standard_daily_hours?: number
}): Promise<UserSettings> {
  const { data, error } = await supabase
    .from('user_settings')
    .update(patch)
    .select()
    .single()
  if (error) throw error
  return data
}
