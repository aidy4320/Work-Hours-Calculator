// TASK-06 — Unit tests for the pure notification-decision logic.
// Run with: deno test supabase/functions/notify/notify.test.ts  (CI; no DB/network)

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  isEligibleUser,
  isoWeekKey,
  monthElapsedFraction,
  reminderTarget,
  shouldSendBehindTarget,
  type NotificationSettings,
} from './logic.ts'

const base: NotificationSettings = {
  behind_target_enabled: true,
  behind_target_threshold_pct: 50,
  reminder_enabled: true,
  reminder_frequency: 'weekly',
  goal_achieved_email_enabled: true,
  monthly_summary_enabled: true,
}

Deno.test('behind-target: due when month half-elapsed and below threshold', () => {
  // target 100, worked 30 -> 30% < 50%, elapsed 0.7
  assertEquals(shouldSendBehindTarget(base, 100, 30, 0.7), true)
})

Deno.test('behind-target: not due before half the month', () => {
  assertEquals(shouldSendBehindTarget(base, 100, 30, 0.4), false)
})

Deno.test('behind-target: not due when on pace (above threshold)', () => {
  assertEquals(shouldSendBehindTarget(base, 100, 60, 0.7), false)
})

Deno.test('behind-target: respects opt-out', () => {
  assertEquals(shouldSendBehindTarget({ ...base, behind_target_enabled: false }, 100, 10, 0.9), false)
})

Deno.test('behind-target: never when target is 0', () => {
  assertEquals(shouldSendBehindTarget(base, 0, 0, 0.9), false)
})

Deno.test('behind-target: not due once goal reached', () => {
  assertEquals(shouldSendBehindTarget(base, 100, 100, 0.9), false)
})

Deno.test('reminder: weekly period uses ISO week key', () => {
  const r = reminderTarget(base, new Date(Date.UTC(2026, 5, 22))) // 2026-06-22 (Mon)
  assertEquals(r?.period, isoWeekKey(new Date(Date.UTC(2026, 5, 22))))
  assertEquals(r?.windowStart, '2026-06-22')
})

Deno.test('reminder: daily period uses date key', () => {
  const r = reminderTarget({ ...base, reminder_frequency: 'daily' }, new Date(Date.UTC(2026, 5, 22)))
  assertEquals(r?.period, '2026-06-22')
})

Deno.test('reminder: null when disabled', () => {
  assertEquals(reminderTarget({ ...base, reminder_enabled: false }, new Date()), null)
})

Deno.test('eligibility: verified email only', () => {
  assertEquals(isEligibleUser('a@b.com', '2026-06-01T00:00:00Z'), true)
  assertEquals(isEligibleUser('a@b.com', null), false)
  assertEquals(isEligibleUser(null, '2026-06-01T00:00:00Z'), false)
})

Deno.test('isoWeekKey: known date', () => {
  // 2026-01-01 is a Thursday -> ISO week 1 of 2026
  assertEquals(isoWeekKey(new Date(Date.UTC(2026, 0, 1))), '2026-W01')
})

Deno.test('monthElapsedFraction: mid-month', () => {
  // June has 30 days; the 15th -> 0.5
  assertEquals(monthElapsedFraction(new Date(Date.UTC(2026, 5, 15))), 15 / 30)
})
