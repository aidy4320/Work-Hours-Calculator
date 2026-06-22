import type { Database } from './db'

type Tables = Database['public']['Tables']

export type UserSettings = Tables['user_settings']['Row']
export type UserSettingsUpdate = Tables['user_settings']['Update']

export type TimeEntry = Tables['time_entries']['Row']
export type EntryType = 'work' | 'vacation' | 'holiday'

export type Alert = Tables['alerts']['Row']

export type NotificationSettings = Tables['notification_settings']['Row']
export type NotificationSettingsUpdate = Tables['notification_settings']['Update']

// get_monthly_summary RPC returns jsonb; the client shape (PLAN §5.4):
export interface MonthlySummary {
  year: number
  month: number
  target_hours: number
  worked_hours: number
  remaining_hours: number
  percent_complete: number
  goal_reached: boolean
  is_current_month: boolean
  daily_breakdown: { date: string; total_hours: number }[]
}
