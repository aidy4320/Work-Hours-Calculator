# Technical Plan — Work Hours Calculator

> Companion to [SPEC.md](SPEC.md). This document defines the **architecture**, **data
> structures**, **API/data access**, and **technology stack** for the application.

**Version:** 2.1
**Last Updated:** 2026-06-18
**Status:** Ready for Development

---

## 1. Technology Stack

| Layer            | Choice                              | Rationale                                                                       |
|------------------|-------------------------------------|--------------------------------------------------------------------------------|
| Frontend         | **React 18 + TypeScript**           | Strong typing, large ecosystem.                                                |
| Build tool       | **Vite**                            | Fast dev server and optimized production builds.                               |
| Data fetching    | **TanStack Query (React Query)**    | Caching, refetch-on-mutation, optimistic updates for instant UI feedback.      |
| Routing          | **React Router**                    | Auth-gated routes + month navigation (current / previous months).             |
| Backend platform | **Supabase**                        | Managed Postgres + Auth + auto REST API + RLS — no custom server to build.     |
| Authentication   | **Supabase Auth**                   | Email/password signup, login, email-based password reset, secure JWT sessions. |
| Database         | **Supabase Postgres 15+**           | Reliable cloud-hosted relational store; precise `NUMERIC` arithmetic.          |
| Authorization    | **Row Level Security (RLS)**        | Per-user data isolation enforced *in the database* (SPEC §1, §Authorization).  |
| Server logic     | **Supabase Edge Functions** (Deno/TS) | Alert detection, email-notification jobs & any logic that shouldn't live in the client. |
| Scheduling       | **Supabase Scheduled Functions** (`pg_cron`) | Periodic jobs that evaluate notification conditions and send emails. |
| Email delivery   | **Transactional email provider** (e.g. **Resend** or **SendGrid**) | Sends notification/transactional emails from Edge Functions via API. |
| Migrations       | **Supabase CLI migrations** (SQL)   | Versioned schema + RLS policies in source control.                            |
| Client SDK       | **`@supabase/supabase-js` v2**      | Typed client for auth and database queries.                                    |
| Tests            | **Vitest** + **React Testing Library** (frontend), **pgTAP**/SQL tests for RLS | Unit + policy coverage. |
| Deployment       | **Supabase** (backend) + **static host/CDN** (frontend, e.g. Vercel/Netlify) | Public HTTPS URL reachable from any machine. |

### 1.1 Recommended Languages

The stack intentionally uses **only two languages** — this keeps the codebase small, typed,
and consistent end to end:

| Language                        | Used for                                                       | Why                                                                                              |
|---------------------------------|---------------------------------------------------------------|-------------------------------------------------------------------------------------------------|
| **TypeScript**                  | React frontend **and** Supabase Edge Functions (Deno)         | One language across the whole codebase; DB types auto-generated from the schema; same `supabase-js` client on both sides; compile-time safety. |
| **SQL** (PostgreSQL / PL/pgSQL) | Schema, RLS policies, triggers, the `get_monthly_summary` RPC | The security- and correctness-critical logic (per-user isolation, hour aggregation, alert detection) lives in the database, where it can't be bypassed by the client. |

> **No Python / no custom backend language.** The previous FastAPI (Python) layer is dropped:
> Supabase provides the API and authentication, so there is nothing left for a separate backend
> language to do. JavaScript could technically replace TypeScript, but TS is strongly preferred
> for type safety against the generated DB types.

### Decimal precision
All hour values are stored as `NUMERIC(7,2)` in Postgres and handled as strings/`Decimal`-safe
values in the client — **never parsed into floats for arithmetic**. Aggregations are done in
SQL (`SUM(...)::numeric`) so totals stay exact. This satisfies the SPEC requirement of accurate
arithmetic to 2 decimal places (SPEC §8, Non-Functional §5).

---

## 2. Architecture

A React SPA talks **directly to Supabase** over HTTPS using the `supabase-js` client. Supabase
provides authentication, a managed Postgres database exposed through an auto-generated REST API
(PostgREST), and Row Level Security that guarantees each user only ever touches their own rows.
Server-side business logic (alert milestone detection) runs in an Edge Function or a Postgres
trigger so it can't be bypassed by the client.

```
┌──────────────────────────────────────┐
│            Browser (Client)           │
│  React + TS SPA (Vite)                │
│  - Auth screens (sign up / log in)    │
│  - Dashboard / progress               │
│  - Daily entry form                   │
│  - Month navigation                   │
│  - Alert banner                       │
│  uses @supabase/supabase-js           │
└───────────────┬──────────────────────┘
                │ HTTPS (JWT in Authorization header)
                ▼
┌──────────────────────────────────────┐
│               Supabase                │
│  ┌────────────┐  ┌─────────────────┐  │
│  │  Auth      │  │  PostgREST API  │  │
│  │ (GoTrue)   │  │  (auto CRUD)    │  │
│  └─────┬──────┘  └────────┬────────┘  │
│        │                  │           │
│        ▼                  ▼           │
│  ┌────────────────────────────────┐  │
│  │        Postgres 15             │  │
│  │  - auth.users (managed)        │  │
│  │  - user_settings        (RLS)  │  │
│  │  - time_entries         (RLS)  │  │
│  │  - alerts               (RLS)  │  │
│  │  - notification_settings(RLS)  │  │
│  │  - notification_log     (RLS)  │  │
│  │  - triggers / functions        │  │
│  │  - pg_cron (scheduled jobs)    │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │  Edge Functions                │  │
│  │  - alert logic                 │  │
│  │  - notify (eval + send email)  │──┼──► Email provider
│  └────────────────────────────────┘  │    (Resend / SendGrid)
└──────────────────────────────────────┘         │
                                                  ▼
                                          User's inbox
```

### Multi-user model
Authentication and identity are owned by **Supabase Auth**. Every user row in `auth.users`
has a UUID (`auth.uid()`). All application tables carry a `user_id uuid` column that defaults
to `auth.uid()`, and **RLS policies** restrict every `SELECT/INSERT/UPDATE/DELETE` to rows
where `user_id = auth.uid()`. This enforces SPEC §1 ("accounts fully isolated") and
Non-Functional §8 ("one user can never read or modify another user's data") at the database
level — not just in application code.

### Why Supabase
Registration, login, password reset, cloud hosting, cross-device access, and per-user isolation
are provided out of the box, removing the need to hand-write auth, password hashing,
session/token management, and a CRUD API. **Trade-off:** tighter coupling to the platform, and
correctness depends on getting RLS policies right (covered by tests in §9).

### Frontend layering
```
src/
├── main.tsx                  # app bootstrap, QueryClient, Router
├── lib/
│   └── supabase.ts           # createClient(URL, ANON_KEY) — single shared client
├── auth/
│   ├── AuthProvider.tsx      # session context, onAuthStateChange listener
│   ├── ProtectedRoute.tsx    # redirects to /login if no session
│   ├── LoginPage.tsx
│   ├── SignUpPage.tsx
│   └── ResetPasswordPage.tsx
├── api/                      # typed Supabase queries (thin wrappers)
│   ├── settings.ts
│   ├── entries.ts
│   └── summary.ts
├── types/                    # generated DB types (supabase gen types typescript)
├── hooks/                    # useSettings, useEntries, useSummary (React Query)
├── components/
│   ├── Dashboard.tsx         # totals, progress bar, percentage
│   ├── EntryForm.tsx         # add/edit hours + notes
│   ├── EntryList.tsx         # daily entries, edit/delete actions
│   ├── MonthNavigator.tsx    # prev/next month
│   └── AlertBanner.tsx       # dismissible goal-reached banner
└── pages/
    └── MonthView.tsx         # combines the above for a given month
```

---

## 3. Data Structures (Database Schema)

All timestamps stored in **UTC** (`timestamptz`). Dates stored as calendar `date` (no time
component) to avoid DST/timezone ambiguity (SPEC §2 "Date Boundaries", §6 "Timezone awareness").

Identity lives in Supabase's managed **`auth.users`** table (email, hashed password, email
verification, reset flow — all handled by Supabase Auth). Application tables reference it via
`user_id uuid` with `default auth.uid()` and a FK to `auth.users(id)`.

> **Maps to SPEC Data Model:** SPEC's "User Account Table" and "Password Reset Token Table" are
> **not** created as application tables here — they are provided by Supabase Auth's managed
> `auth` schema (`auth.users` plus internal token storage). We therefore only define the
> business tables below.

Every table's `updated_at` is maintained by a single shared trigger function defined once and
attached to each table (the "trigger on update" referenced in the schemas below):
```sql
create function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;
-- per table: create trigger trg_<table>_updated before update on <table>
--            for each row execute function set_updated_at();
```

### Table: `user_settings`
| Column                | Type           | Constraints                                   | Notes                                  |
|-----------------------|----------------|-----------------------------------------------|----------------------------------------|
| `user_id`             | UUID           | PK, FK → `auth.users(id)`, default `auth.uid()` | One settings row per user.           |
| `monthly_target_hours`| NUMERIC(7,2)   | NOT NULL, `>= 0`                              | Target hours/month (0 allowed).        |
| `standard_daily_hours`| NUMERIC(5,2)   | NOT NULL, `>= 0`                              | Default daily hours.                   |
| `created_at`          | TIMESTAMPTZ    | NOT NULL, default `now()`                     |                                        |
| `updated_at`          | TIMESTAMPTZ    | NOT NULL, default `now()`, trigger on update  |                                        |

> A row is auto-created for each new user via an `on auth.users` insert trigger
> (`handle_new_user`) seeding default settings (e.g. target 0, daily 8).

### Table: `time_entries`
| Column         | Type          | Constraints                                   | Notes                                       |
|----------------|---------------|-----------------------------------------------|---------------------------------------------|
| `id`           | BIGINT        | PK, generated always as identity              |                                             |
| `user_id`      | UUID          | NOT NULL, FK → `auth.users(id)`, default `auth.uid()` | Scopes the row to its owner.        |
| `entry_date`   | DATE          | NOT NULL, CHECK `entry_date <= current_date`  | No future dates (SPEC §2).                  |
| `hours_worked` | NUMERIC(7,2)  | NOT NULL, CHECK `hours_worked >= 0`           | Decimal, 0 allowed, no upper limit.         |
| `notes`        | TEXT          | NULL                                          | Optional project/work note.                 |
| `created_at`   | TIMESTAMPTZ   | NOT NULL, default `now()`                     |                                             |
| `updated_at`   | TIMESTAMPTZ   | NOT NULL, default `now()`, trigger on update  |                                             |

> **Multiple entries per day are allowed** (SPEC Story 2). Monthly totals aggregate all entries
> within the calendar month.
> Index: `ix_time_entries_user_date (user_id, entry_date)` for fast month queries.

### Table: `alerts`
| Column         | Type          | Constraints                                   | Notes                                       |
|----------------|---------------|-----------------------------------------------|---------------------------------------------|
| `id`           | BIGINT        | PK, generated always as identity              |                                             |
| `user_id`      | UUID          | NOT NULL, FK → `auth.users(id)`, default `auth.uid()` |                                     |
| `month`        | DATE          | NOT NULL                                      | First day of the month (e.g. `2026-06-01`). |
| `achieved_at`  | TIMESTAMPTZ   | NOT NULL                                      | When the milestone was reached.             |
| `dismissed`    | BOOLEAN       | NOT NULL, default false                       | Once dismissed, doesn't reappear (SPEC §7). |

> Unique constraint: `uq_alerts_user_month (user_id, month)` — one milestone record per month.

### Table: `notification_settings`
| Column                          | Type         | Constraints                                   | Notes                                          |
|---------------------------------|--------------|-----------------------------------------------|------------------------------------------------|
| `user_id`                       | UUID         | PK, FK → `auth.users(id)`, default `auth.uid()` | One preferences row per user.                |
| `behind_target_enabled`         | BOOLEAN      | NOT NULL, default `true`                      | Send behind-target warning emails.             |
| `behind_target_threshold_pct`   | NUMERIC(5,2) | NOT NULL, default `50`, CHECK `0–100`         | Warn if target progress < this when month mostly elapsed. |
| `reminder_enabled`              | BOOLEAN      | NOT NULL, default `true`                      | Send log-hours reminders.                      |
| `reminder_frequency`            | TEXT         | NOT NULL, default `'weekly'`, CHECK in (`daily`,`weekly`) | Reminder cadence.                   |
| `goal_achieved_email_enabled`   | BOOLEAN      | NOT NULL, default `true`                      | Send goal-achieved confirmation emails.        |
| `monthly_summary_enabled`       | BOOLEAN      | NOT NULL, default `true`                      | Send end-of-month summary emails.              |
| `created_at`                    | TIMESTAMPTZ  | NOT NULL, default `now()`                     |                                                |
| `updated_at`                    | TIMESTAMPTZ  | NOT NULL, default `now()`, trigger on update  |                                                |

> A row is auto-created for each new user by the same `handle_new_user` trigger that seeds
> `user_settings`, using the defaults above.

### Table: `notification_log`
| Column      | Type        | Constraints                                              | Notes                                              |
|-------------|-------------|---------------------------------------------------------|----------------------------------------------------|
| `id`        | BIGINT      | PK, generated always as identity                        |                                                    |
| `user_id`   | UUID        | NOT NULL, FK → `auth.users(id)`, default `auth.uid()`   |                                                    |
| `type`      | TEXT        | NOT NULL, CHECK in (`behind_target`,`reminder`,`goal_achieved`,`monthly_summary`) | Notification kind. |
| `period`    | TEXT        | NOT NULL                                                | Period key, e.g. `2026-06` (or `2026-06-18` for daily reminders). |
| `sent_at`   | TIMESTAMPTZ | NOT NULL, default `now()`                               |                                                    |
| `status`    | TEXT        | NOT NULL, CHECK in (`sent`,`failed`)                    | Delivery outcome.                                  |

> Unique constraint: `uq_notif_user_type_period (user_id, type, period)` — **enforces
> "send at most once per period"** (SPEC §7, §Edge Cases 9): the notify job inserts a log row
> before/while sending, and a duplicate insert is rejected, so the same email is never sent twice.

### Row Level Security (applied to all application tables)

> The SQL below is an **illustrative example** of the RLS approach. The authoritative,
> complete definitions live in the Supabase migration files (`supabase/migrations/*.sql`) —
> see the Migrations row in §1.

```sql
alter table user_settings         enable row level security;
alter table time_entries          enable row level security;
alter table alerts                enable row level security;
alter table notification_settings enable row level security;
alter table notification_log      enable row level security;

-- Full-CRUD pattern, repeated for user_settings, time_entries, alerts,
-- notification_settings (example shown for time_entries):
create policy "own rows - select" on time_entries
  for select using (auth.uid() = user_id);
create policy "own rows - insert" on time_entries
  for insert with check (auth.uid() = user_id);
create policy "own rows - update" on time_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows - delete" on time_entries
  for delete using (auth.uid() = user_id);

-- notification_log is READ-ONLY for users: only the server-side `notify`
-- function (service role, which bypasses RLS) writes it. Users may read
-- their own log rows but cannot insert/update/delete them.
create policy "own log - select" on notification_log
  for select using (auth.uid() = user_id);
```
With RLS on and these policies, the auto-generated REST API is automatically safe: a logged-in
user can only ever see/modify their own rows (and can only read — never write — their
`notification_log`).

---

## 4. Core Business Logic

### Monthly summary
Computed via a Postgres view/RPC function `get_monthly_summary(p_year int, p_month int)` (a
`SECURITY INVOKER` function so RLS still applies). Given a year and month:
1. Sum `hours_worked` across `time_entries` for `auth.uid()` within that calendar month.
2. `remaining = greatest(target - worked, 0)`.
3. `percent = round(worked / target * 100, 2)` if `target > 0`, else `100` (goal of 0 met immediately, SPEC §3).
4. Return a per-day breakdown `[{date, total_hours}]`.
All arithmetic in SQL `numeric`; results rounded to 2 decimals for display only.

### Alert detection
Implemented as a Postgres trigger on `time_entries` (insert/update/delete) — or an Edge Function
called after mutations:
- If the affected month's total **>= target** and no `alerts` row exists for that `(user_id, month)` → insert one with `achieved_at = now()`.
- If a later edit drops the total **below** target, the existing alert row remains (history of first achievement); the live summary's `goal_reached` flag reflects current state.
- Target changes mid-month recalculate progress immediately (summary is computed live).

Running this server-side (trigger/RPC) means the milestone can't be spoofed by the client.

### Email notifications (Edge Function `notify` + `pg_cron`)
A scheduled Edge Function (run by `pg_cron`, e.g. daily) evaluates each notification condition
per user, honoring `notification_settings`, and sends emails via the email provider. The
`notification_log` unique constraint guarantees once-per-period delivery (SPEC §7, Edge Cases 9).

Before sending to any user, `notify` skips users whose email is unverified when email
verification is enabled (`auth.users.email_confirmed_at is null`) — notification emails are
withheld until the address is verified (SPEC Edge Cases 9).

For each enabled user, per type:
- **behind_target** — if `monthly_summary` says elapsed-share-of-month ≥ a point but
  `percent_complete` < `behind_target_threshold_pct`, and `target > 0`, and goal not yet reached →
  send. `period = 'YYYY-MM'`.
- **reminder** — if no `time_entries` in the configured window (`daily`/`weekly`) → send.
  `period` = the day/ISO-week key.
- **goal_achieved** — sent when the alert row is created (event-driven from the alert
  trigger/`notify` call), if enabled. `period = 'YYYY-MM'`.
- **monthly_summary** — on the first run after a month ends, send the prior month's totals vs.
  target. `period` = the summarized month `'YYYY-MM'`.

Send flow (idempotent): attempt `insert into notification_log (user_id, type, period, status)`;
if the unique constraint rejects it, skip (already sent). On a real send failure, the row is
marked `failed` and retried on the next run — sending never blocks app usage (SPEC Edge Cases 9).
The function runs with the service role (server-side only) so it can read across users for the
scheduled sweep; it is **not** exposed to the client.

---

## 5. Data Access (Supabase client)

The frontend uses `supabase-js`; there is no hand-written REST server. Below are the canonical
operations the typed wrappers in `src/api/` expose. All calls run under the user's JWT, so RLS
scopes them automatically.

### 5.1 Auth (Supabase Auth)
```ts
// Sign up (SPEC Story 0a)
await supabase.auth.signUp({ email, password })
// Log in (SPEC Story 0b)
await supabase.auth.signInWithPassword({ email, password })
// Log out
await supabase.auth.signOut()
// Forgot password → sends reset email
await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/reset` })
// Set new password (on the reset page, after following the email link)
await supabase.auth.updateUser({ password: newPassword })
// Current session / listen for changes
supabase.auth.getSession()
supabase.auth.onAuthStateChange((_event, session) => { ... })
```
Email uniqueness, hashing, verification, token issuance/refresh are all handled by Supabase.

### 5.2 Settings
```ts
// Read (row auto-created on signup via trigger)
await supabase.from('user_settings').select('*').single()
// Update — validation: both >= 0 (also enforced by CHECK constraints)
await supabase.from('user_settings')
  .update({ monthly_target_hours: 168.0, standard_daily_hours: 8.5 })
  .select().single()
```

### 5.3 Time Entries
```ts
// Create — entry_date <= today and hours_worked >= 0 enforced by CHECK constraints
await supabase.from('time_entries')
  .insert({ entry_date: '2026-06-18', hours_worked: 7.5, notes: 'Client project' })
  .select().single()

// List a calendar month (ordered)
await supabase.from('time_entries')
  .select('*')
  .gte('entry_date', '2026-06-01').lte('entry_date', '2026-06-30')
  .order('entry_date', { ascending: true })

// Update / delete by id (RLS guarantees it's the user's own row)
await supabase.from('time_entries').update({ hours_worked: 8, notes: '...' }).eq('id', id).select().single()
await supabase.from('time_entries').delete().eq('id', id)
```

### 5.4 Monthly summary
```ts
await supabase.rpc('get_monthly_summary', { p_year: 2026, p_month: 6 })
// → { year, month, target_hours, worked_hours, remaining_hours,
//     percent_complete, goal_reached, is_current_month, daily_breakdown: [...] }
```
- Empty month returns zeros, not an error (SPEC §6).
- Historical months: client treats `is_current_month = false` as read-only (SPEC Story 6).

### 5.5 Alerts
```ts
// Active (non-dismissed) milestone for a month
await supabase.from('alerts')
  .select('*').eq('month', '2026-06-01').eq('dismissed', false).maybeSingle()
// Dismiss
await supabase.from('alerts').update({ dismissed: true }).eq('id', id)
```

### 5.6 Notification preferences
```ts
// Read the user's email preferences (row auto-created on signup)
await supabase.from('notification_settings').select('*').single()
// Update preferences (toggle email types, threshold, reminder cadence)
await supabase.from('notification_settings')
  .update({ behind_target_enabled: true, behind_target_threshold_pct: 60, reminder_frequency: 'daily' })
  .select().single()
```
> `notification_log` is written only by the server-side `notify` function — the client does not
> insert into it (its RLS allows the user to read their own log rows, but not write them).

---

## 6. Frontend Structure & Behaviour

- **Auth gating:** `AuthProvider` exposes the current session; `ProtectedRoute` redirects
  unauthenticated users to `/login`. Auth screens: sign up, log in, forgot/reset password.
- **Optimistic updates** via React Query so the dashboard updates immediately after logging
  hours (SPEC Story 3).
- DB types generated with `supabase gen types typescript` keep `src/types/` in sync with the
  schema (single source of truth).
- Responsive layout for small screens (SPEC §6 "Mobile responsiveness").
- Same session works on any device/browser — log in anywhere, see the same up-to-date data
  (SPEC §6 "Cross-Device Access").
- A **settings/preferences screen** lets the user toggle each email-notification type, set the
  behind-target threshold, and choose reminder cadence (reads/writes `notification_settings`).

---

## 7. Validation & Edge-Case Handling

| Edge case (SPEC ref)                         | Where handled                                                     |
|----------------------------------------------|------------------------------------------------------------------|
| Negative hours / target                      | Postgres `CHECK (... >= 0)` + client form validation → error.     |
| Decimal precision (max 2 places)             | `NUMERIC(_,2)` storage + client input mask.                      |
| Future dates rejected                        | `CHECK (entry_date <= current_date)` + client date picker max.    |
| Zero hours / zero target allowed             | Explicitly permitted; `target=0` → 100% complete in summary RPC.  |
| Exact-target match triggers alert            | `worked >= target` (inclusive) in alert trigger.                  |
| Goal changed mid-month recalculates          | Summary computed live; alert re-evaluated on next mutation.       |
| Calendar-month boundaries / leap years       | Month range computed from year+month in the RPC.                  |
| Year boundaries (Dec→Jan)                    | Queries scoped to a single calendar month.                       |
| Empty month → "0 hours" not error            | Summary RPC returns zeros.                                       |
| Alert dismissed once → no reappear           | `dismissed` flag + unique `(user_id, month)`.                    |
| Precise arithmetic (no float errors)         | `numeric` end-to-end; aggregation in SQL.                        |
| Per-user data isolation                      | **RLS policies** on every table (SPEC §1, NFR §8).               |
| Last-write-wins on concurrent edits          | Plain UPDATE by `id`; no locking required.                       |
| Auth: duplicate email, weak password, reset  | Handled by Supabase Auth (returns typed errors to the client).   |
| Email sent at most once per period           | Unique `(user_id, type, period)` on `notification_log`.          |
| Email opt-out respected                       | `notify` reads `notification_settings` before sending.           |
| Behind-target email skipped when target = 0  | `notify` guards `target > 0` and goal-not-reached.               |
| Email send failure doesn't block app          | Logged as `failed` + retried next run; never on the request path. |

---

## 8. Deployment (Cloud)

- **Backend:** a Supabase project (managed Postgres + Auth + Edge Functions). Schema, RLS
  policies, triggers, and functions are versioned as SQL migrations applied via the Supabase CLI
  (`supabase db push` / CI).
- **Frontend:** static React build deployed to a CDN/static host (e.g. Vercel or Netlify) with a
  public HTTPS URL — reachable from any computer (SPEC NFR §9 "not localhost").
- **Config:** the client is built with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
  (the anon key is public by design — security comes from RLS, not from hiding the key).
- **Auth email:** configure Supabase Auth email templates + redirect URLs for signup
  confirmation and password reset.
- **Notification emails:** the `notify` Edge Function is scheduled via `pg_cron` (e.g. daily) and
  sends through the email provider (Resend/SendGrid) using a server-only API key. The provider's
  sending domain must be verified (SPF/DKIM) for deliverability.
- **HTTPS:** terminated by Supabase and the static host.
- **Local dev:** `supabase start` runs the full stack (Postgres, Auth, Studio) in Docker; the
  Vite dev server points at the local Supabase URL.

### Environment variables (frontend)
| Variable                  | Description                          | Example                                  |
|---------------------------|--------------------------------------|------------------------------------------|
| `VITE_SUPABASE_URL`       | Supabase project URL                 | `https://abcd.supabase.co`               |
| `VITE_SUPABASE_ANON_KEY`  | Public anon key (safe to ship)       | `eyJhbGciOi...`                          |

> The **service-role key is never used in the frontend** — only in trusted server contexts
> (Edge Functions / CI) if ever needed.

### Secrets (server-side only — Edge Function env, never shipped to the client)
| Variable                 | Description                                  | Example                          |
|--------------------------|----------------------------------------------|----------------------------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Service role for the scheduled `notify` sweep | `eyJhbGciOi...`               |
| `EMAIL_API_KEY`          | Transactional email provider API key         | `re_...` (Resend) / `SG....`     |
| `EMAIL_FROM`             | Verified sender address                       | `updates@app.example.com`        |

---

## 9. Testing Strategy

- **RLS / policy tests (critical):** SQL tests (pgTAP) verifying user A cannot read or modify
  user B's `user_settings`, `time_entries`, or `alerts` rows. This is the security backbone.
- **Database logic tests:** `get_monthly_summary` math, alert trigger at/over target, CHECK
  constraint rejections (negative hours, future dates), month-boundary and leap-year ranges.
- **Notification logic tests:** `notify` correctly selects users per condition, respects
  opt-outs and thresholds, and the `notification_log` unique constraint prevents duplicate sends
  (assert a second run for the same period inserts nothing/sends nothing). Email provider call is
  mocked.
- **Frontend (Vitest + RTL):** auth flows (sign up / log in / logout / reset redirect), entry
  form validation, optimistic update behavior, alert banner dismiss, month navigation read-only
  state, protected-route redirects, notification-preferences form.
- Target: cover every edge case listed in SPEC §"Edge Cases" and §7 above, plus per-user
  isolation.

---

## 10. Out of Scope (per SPEC)

Team/shared workspaces, third-party/social login, invoicing/billing, timers, native mobile apps,
external integrations, charts/analytics, SMS/push notifications, dark mode, and offline mode are
**explicitly excluded** (see SPEC "Out of Scope"). Note: registration, login, password reset,
multi-user isolation, cloud hosting, cross-device access, and **email notifications** (progress,
reminders, goal achievement, monthly summary) **are in scope** and are delivered via Supabase
(Auth, Postgres + RLS, scheduled Edge Functions) plus a transactional email provider.
