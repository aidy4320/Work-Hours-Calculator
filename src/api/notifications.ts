import { supabase } from '../lib/supabase'
import type { NotificationSettings, NotificationSettingsUpdate } from '../types/models'

// notification_settings is seeded on signup; notification_log is server-only (read elsewhere).
export async function getNotificationPrefs(): Promise<NotificationSettings> {
  const { data, error } = await supabase.from('notification_settings').select('*').single()
  if (error) throw error
  return data
}

export async function updateNotificationPrefs(
  patch: NotificationSettingsUpdate,
): Promise<NotificationSettings> {
  const { data, error } = await supabase
    .from('notification_settings')
    .update(patch)
    .select()
    .single()
  if (error) throw error
  return data
}
