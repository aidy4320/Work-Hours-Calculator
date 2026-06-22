// TASK-06 — Email notification engine `notify` (PLAN §4; SPEC §7, Edge Cases §9)
//
// Scheduled server-only sweep (scheduling itself is wired in TASK-14 via pg_cron).
// For each verified user it evaluates four notification types, honoring their
// notification_settings, and sends due emails via Resend. notification_log
// guarantees once-per-period delivery; failures are logged and retried next run.
//
// Auth: deployed with --no-verify-jwt and gated on a shared NOTIFY_CRON_SECRET,
// so only the scheduler (which holds that secret) can trigger it.
// Pure decision logic lives in ./logic.ts (unit-tested in notify.test.ts).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  firstOfNextMonth,
  isEligibleUser,
  monthElapsedFraction,
  reminderTarget,
  shouldSendBehindTarget,
  ym,
  ymd,
} from './logic.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('NOTIFY_CRON_SECRET') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') ?? 'onboarding@resend.dev'

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

type Action = { user: string; type: string; period: string; result: 'sent' | 'failed' | 'skipped' }

async function monthWorked(userId: string, year: number, month: number): Promise<number> {
  const start = `${ym(year, month)}-01`
  const end = ymd(firstOfNextMonth(year, month))
  const { data } = await admin
    .from('time_entries')
    .select('hours_worked')
    .eq('user_id', userId)
    .gte('entry_date', start)
    .lt('entry_date', end)
  return (data ?? []).reduce((s: number, r: { hours_worked: number }) => s + Number(r.hours_worked), 0)
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
    })
    return res.ok
  } catch {
    return false
  }
}

async function alreadySent(userId: string, type: string, period: string): Promise<boolean> {
  const { data } = await admin
    .from('notification_log')
    .select('status')
    .eq('user_id', userId)
    .eq('type', type)
    .eq('period', period)
    .maybeSingle()
  return data?.status === 'sent'
}

// Send once per (user, type, period); retry rows previously marked 'failed'.
async function deliver(
  userId: string,
  email: string,
  type: string,
  period: string,
  subject: string,
  html: string,
): Promise<Action['result']> {
  if (await alreadySent(userId, type, period)) return 'skipped'
  const ok = await sendEmail(email, subject, html)
  await admin
    .from('notification_log')
    .upsert(
      { user_id: userId, type, period, status: ok ? 'sent' : 'failed', sent_at: new Date().toISOString() },
      { onConflict: 'user_id,type,period' },
    )
  return ok ? 'sent' : 'failed'
}

async function runSweep(now: Date): Promise<Action[]> {
  const actions: Action[] = []
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1
  const curPeriod = ym(year, month)
  const elapsed = monthElapsedFraction(now)

  const { data: userPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  for (const u of userPage?.users ?? []) {
    if (!isEligibleUser(u.email, u.email_confirmed_at)) continue
    const email = u.email as string

    const { data: ns } = await admin.from('notification_settings').select('*').eq('user_id', u.id).maybeSingle()
    if (!ns) continue

    const { data: us } = await admin
      .from('user_settings')
      .select('monthly_target_hours')
      .eq('user_id', u.id)
      .maybeSingle()
    const target = Number(us?.monthly_target_hours ?? 0)
    const worked = await monthWorked(u.id, year, month)

    // 1) behind-target warning
    if (shouldSendBehindTarget(ns, target, worked, elapsed)) {
      const percent = ((worked / target) * 100).toFixed(0)
      const r = await deliver(u.id, email, 'behind_target', curPeriod,
        'You are behind your monthly hours goal',
        `<p>You've logged <b>${worked}</b> of your <b>${target}</b> hour goal this month (${percent}%). There is still time to catch up.</p>`)
      actions.push({ user: u.id, type: 'behind_target', period: curPeriod, result: r })
    }

    // 2) log-hours reminder
    const rem = reminderTarget(ns, now)
    if (rem) {
      const { data: recent } = await admin
        .from('time_entries')
        .select('id')
        .eq('user_id', u.id)
        .gte('entry_date', rem.windowStart)
        .limit(1)
      if (!recent || recent.length === 0) {
        const r = await deliver(u.id, email, 'reminder', rem.period,
          'Reminder: log your work hours',
          `<p>You haven't logged any hours ${ns.reminder_frequency === 'daily' ? 'today' : 'this week'} yet.</p>`)
        actions.push({ user: u.id, type: 'reminder', period: rem.period, result: r })
      }
    }

    // 3) goal-achieved confirmation (alert row created by the TASK-05 trigger)
    if (ns.goal_achieved_email_enabled) {
      const { data: alert } = await admin
        .from('alerts')
        .select('id')
        .eq('user_id', u.id)
        .eq('month', `${curPeriod}-01`)
        .maybeSingle()
      if (alert) {
        const r = await deliver(u.id, email, 'goal_achieved', curPeriod,
          'You reached your monthly goal!',
          `<p>Congratulations — you've reached your <b>${target}</b> hour goal for ${curPeriod}.</p>`)
        actions.push({ user: u.id, type: 'goal_achieved', period: curPeriod, result: r })
      }
    }

    // 4) end-of-month summary (previous month), only in the first days of a new month
    if (ns.monthly_summary_enabled && now.getUTCDate() <= 3) {
      const pYear = month === 1 ? year - 1 : year
      const pMonth = month === 1 ? 12 : month - 1
      const pPeriod = ym(pYear, pMonth)
      const pWorked = await monthWorked(u.id, pYear, pMonth)
      const r = await deliver(u.id, email, 'monthly_summary', pPeriod,
        `Your ${pPeriod} hours summary`,
        `<p>In ${pPeriod} you logged <b>${pWorked}</b> hours${target > 0 ? ` against a ${target} hour goal` : ''}.</p>`)
      actions.push({ user: u.id, type: 'monthly_summary', period: pPeriod, result: r })
    }
  }
  return actions
}

Deno.serve(async (req: Request) => {
  // Only the scheduler (holding NOTIFY_CRON_SECRET) may trigger the sweep.
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  if (!CRON_SECRET || token !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const actions = await runSweep(new Date())
  const summary = {
    sent: actions.filter((a) => a.result === 'sent').length,
    failed: actions.filter((a) => a.result === 'failed').length,
    skipped: actions.filter((a) => a.result === 'skipped').length,
    actions,
  }
  return new Response(JSON.stringify(summary), { status: 200, headers: { 'Content-Type': 'application/json' } })
})

export { runSweep }
