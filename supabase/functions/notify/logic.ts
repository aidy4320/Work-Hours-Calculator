// TASK-06 — Pure notification-decision logic (no DB / no network).
// Separated so it can be unit-tested with a mocked provider (Deno test / CI).

export interface NotificationSettings {
  behind_target_enabled: boolean
  behind_target_threshold_pct: number
  reminder_enabled: boolean
  reminder_frequency: 'daily' | 'weekly'
  goal_achieved_email_enabled: boolean
  monthly_summary_enabled: boolean
}

export const pad = (n: number) => String(n).padStart(2, '0')
export const ym = (y: number, m: number) => `${y}-${pad(m)}`
export const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
export const firstOfNextMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 1)) // m is 1-based

export function monthElapsedFraction(now: Date): number {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth() + 1
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return now.getUTCDate() / daysInMonth
}

export function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = (t.getUTCDay() + 6) % 7 // Mon=0
  t.setUTCDate(t.getUTCDate() - day + 3) // nearest Thursday
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4))
  const week =
    1 +
    Math.round(
      ((t.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7,
    )
  return `${t.getUTCFullYear()}-W${pad(week)}`
}

export function mondayOfWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = (t.getUTCDay() + 6) % 7
  t.setUTCDate(t.getUTCDate() - day)
  return ymd(t)
}

// A user only receives emails once their address is verified (SPEC Edge §9).
export function isEligibleUser(email: string | null | undefined, emailConfirmedAt: string | null | undefined): boolean {
  return Boolean(email) && Boolean(emailConfirmedAt)
}

// Behind-target warning: enabled, real target, goal not yet reached, the month is
// at least half elapsed, and target progress is below the user's threshold.
export function shouldSendBehindTarget(
  s: NotificationSettings,
  target: number,
  worked: number,
  elapsedFraction: number,
): boolean {
  if (!s.behind_target_enabled) return false
  if (target <= 0) return false // target 0 is met immediately -> never "behind"
  if (worked >= target) return false // goal reached
  const percent = (worked / target) * 100
  return elapsedFraction >= 0.5 && percent < s.behind_target_threshold_pct
}

// Reminder window/period key; null if reminders are disabled.
export function reminderTarget(s: NotificationSettings, now: Date): { period: string; windowStart: string } | null {
  if (!s.reminder_enabled) return null
  if (s.reminder_frequency === 'daily') return { period: ymd(now), windowStart: ymd(now) }
  return { period: isoWeekKey(now), windowStart: mondayOfWeek(now) }
}
