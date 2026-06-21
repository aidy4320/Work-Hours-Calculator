# Tasks — Work Hours Calculator

> SDD **Tasks** phase. Breaks [PLAN.md](PLAN.md) (which implements [SPEC.md](SPEC.md)) into
> numbered, ordered tasks with explicit dependencies.

**Version:** 4.2 (consolidated — 16 tasks: TASK-00 … TASK-15; scaffold moved into TASK-00)
**Last Updated:** 2026-06-18
**Status:** Ready for Implementation

---

## Task Format — every task MUST carry these 7 fields
A task missing any of these does **not** enter work:

| # | Field | Meaning |
|---|-------|---------|
| 1 | **Goal** | What the task achieves — one sentence. |
| 2 | **Spec** | Link to the matching section in SPEC.md / PLAN.md (context). |
| 3 | **In / Out** | Exact input and output types/format. |
| 4 | **Edge** | Edge cases & errors: invalid values, empty input, nulls, etc. |
| 5 | **DoD** | Definition of Done — acceptance criteria / tests that prove it works. |
| 6 | **Deps** | Tasks that must be complete first (`—` = none). |
| 7 | **Out of scope** | What this task explicitly does NOT do. |

> **About size (v4):** these are 15 *coarse* tasks. Each bundles its sub-steps inside the **DoD**
> checklist, so coverage of SPEC is unchanged — only the granularity is coarser. `[P]` = can run
> in parallel with other `[P]` tasks once dependencies are met.

---

### TASK-00 — Open the project (repo + folder skeleton + app scaffold)
```
Goal:         Create the repo, the directory skeleton, and a booting Vite+React+TS app scaffold.
Spec:         PLAN §1, §1.1, §2, §8
In:           none (fresh directory) + project name
Out:          Git repo (initial commit, .gitignore, README at root) + SDD docs under docs/
              (SPEC.md, PLAN.md, TASKS.md) + folder skeleton (.gitkeep) +
              Vite+React+TS scaffold: package.json, tsconfig(.node).json, vite.config.ts,
              index.html, src/main.tsx, src/App.tsx, src/index.css, src/vite-env.d.ts,
              ESLint + Prettier config, one sample test
Edge:         Node version mismatch → documented prereq; empty dirs → .gitkeep;
              existing repo → don't clobber history; .env git-ignored from the start;
              tool config files MUST stay at root (moving them breaks the build)
DoD:          • `git init` + skeleton committed • docs/ holds the 3 SDD files • `npm install` resolves
              • `npm run dev` boots the page • `npm run lint` green • `npm test` (1 sample) green
Deps:         —
Out of scope: Supabase setup, env vars, shared client, schema, auth, features
```

### TASK-01 — Supabase setup & shared client
```
Goal:         Connect the app to a Supabase local stack via a single shared client.
Spec:         PLAN §1, §2 (lib/supabase.ts), §8
In:           env vars VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
Out:          supabase/ config (`supabase init`); .env + .env.example; src/lib/supabase.ts client; `supabase start` works
Edge:         Docker missing → documented prereq; missing env → clear startup error; one shared client only
DoD:          • `supabase start` exposes local Postgres + Studio • importing the client connects in a smoke test
              • .env git-ignored, .env.example committed
Deps:         TASK-00
Out of scope: Schema, auth, features
```

### TASK-02 — Database schema & generated types
```
Goal:         Create all tables, the shared updated_at trigger, signup seed, and TS types.
Spec:         PLAN §3, §6; SPEC §2/§3/§5/§7
In:           SQL migrations
Out:          Tables user_settings, time_entries (+idx), alerts, notification_settings,
              notification_log; set_updated_at(); handle_new_user seed; src/types/db.ts
Edge:         CHECKs: hours/target ≥0, entry_date ≤ today, threshold 0–100, freq in {daily,weekly};
              unique(user,month) on alerts; unique(user,type,period) on notification_log
DoD:          • all migrations apply • CHECKs reject bad values • signup seeds settings rows
              • generated types compile and import
Deps:         TASK-01
Out of scope: RLS policies, business logic
```

### TASK-03 — Row Level Security & isolation tests
```
Goal:         Enforce per-user data isolation on every table at the DB level.
Spec:         PLAN §3 (RLS), §5.6; SPEC §1, NFR §8
In:           SQL policies
Out:          RLS enabled on all 5 tables; full-CRUD own-rows policies on 4 tables;
              SELECT-only policy on notification_log
Edge:         Cross-user access denied; client writes to notification_log denied
DoD:          • pgTAP tests: User A cannot read/modify User B's rows on any table
              • owner CRUD works • notification_log writable only by service role
Deps:         TASK-02
Out of scope: Business logic, UI
```

### TASK-04 — Monthly summary RPC
```
Goal:         Compute monthly worked/remaining/percent/breakdown for the caller.
Spec:         PLAN §4, §5.4; SPEC §4, Edge Cases §3/§4/§6
In:           p_year int, p_month int
Out:          {target,worked,remaining,percent_complete,goal_reached,is_current_month,daily_breakdown[]}
Edge:         target=0 → 100%; empty month → zeros; leap year; Dec→Jan; no float drift
DoD:          • SECURITY INVOKER (RLS applies) • unit tests assert all edge cases
Deps:         TASK-03
Out of scope: Alerts, emailing, UI
```

### TASK-05 — Alert-detection trigger
```
Goal:         Create one alert per user-month when total reaches/exceeds target.
Spec:         PLAN §4; SPEC §5, Edge Cases §7
In:           insert/update/delete on time_entries
Out:          alerts row (achieved_at) at threshold, once per user-month
Edge:         Exact match (inclusive); single large entry; two entries summing to goal;
              later drop below target keeps the row; target=0
DoD:          • tests produce exactly one correct alert per scenario • survives drop below target
Deps:         TASK-04
Out of scope: Email sending, dismissal UI
```

### TASK-06 — Email notification engine (`notify`)
```
Goal:         Server-only function that decides and sends all 4 email types, once per period.
Spec:         PLAN §4, §1 (Email delivery); SPEC §7, Edge Cases §9
In:           Per user: summary + notification_settings + auth email status + entries + alerts
Out:          Emails for behind_target / reminder / goal_achieved / monthly_summary;
              notification_log rows (sent/failed); runs with service role
Edge:         Opt-out respected; threshold & target>0 for behind; unverified email skipped;
              duplicate period → unique skips; send failure → mark failed + retry; not client-callable
DoD:          • tests (provider mocked): correct selection, no duplicate on re-run, opt-out & unverified excluded
Deps:         TASK-04, TASK-05
Out of scope: pg_cron scheduling & provider domain setup (TASK-14), templates
```

### TASK-07 — Frontend auth (provider, routing, screens)
```
Goal:         Session context, route gating, and sign-up/login/logout/reset UI.
Spec:         PLAN §2/§6, §5.1; SPEC §1, Story 0a/0b
In:           email:string, password:string (+ newPassword on reset)
Out:          AuthProvider + ProtectedRoute + Router; working auth screens
Edge:         Duplicate email; weak/invalid password; wrong credentials; expired reset link;
              no email enumeration; deep link while logged out → redirect
DoD:          • protected routes blocked without session • tests: signup/login/logout/reset/redirect
Deps:         TASK-01
Out of scope: Social login, MFA, email templates (Supabase config)
```

### TASK-08 — Client data layer (wrappers + hooks)
```
Goal:         Typed Supabase wrappers and React Query hooks for all entities.
Spec:         PLAN §5.2–§5.6, §6
In:           Typed args per entity (settings, entries, summary, alerts, prefs)
Out:          useSettings, useEntries, useSummary, useAlert, useNotificationPrefs (cached, optimistic)
Edge:         Values<0 rejected; future/2-decimal limits on entries; client never writes notification_log;
              rollback on mutation error
DoD:          • reads return typed rows • mutations update UI immediately and reconcile with server
Deps:         TASK-02, TASK-04
Out of scope: Visual components
```

### TASK-09 — Dashboard & progress view
```
Goal:         Show worked / remaining / percentage with a progress bar.
Spec:         SPEC Story 3, §4; PLAN §6
In:           Summary (useSummary)
Out:          Rendered progress UI
Edge:         Empty month → "0 hours" not error; >100% capped display
DoD:          • numbers match summary • updates immediately after logging hours
Deps:         TASK-08
Out of scope: Editing, navigation
```

### TASK-10 — Time entries UI (form + list)
```
Goal:         Add/edit/delete hours+notes and list a month's entries.
Spec:         SPEC Story 2/5, §3, Edge Cases §1/§2; PLAN §6
In:           {entry_date, hours_worked, notes?}; month for list
Out:          Created/updated/deleted entries; interactive list
Edge:         Negative/future rejected with message; 2-decimal cap; 0 allowed; empty-list state;
              delete confirm; multiple entries per day
DoD:          • valid submit saves • invalid blocked with clear errors • edit/delete refresh the list
Deps:         TASK-08
Out of scope: Month navigation, alerts
```

### TASK-11 — Month navigation & alert banner
```
Goal:         Navigate months (past = read-only) and show a dismissible goal banner.
Spec:         SPEC Story 4/6, §4/§5, Edge Cases §7; PLAN §6
In:           Current year/month; active alert (useAlert)
Out:          Prev/next selection; read-only past months; dismissible banner with achieved time
Edge:         Dec↔Jan boundary; past month not editable; dismissed once → no reappear
DoD:          • navigation works • past months read-only • dismiss persists
Deps:         TASK-08
Out of scope: Email notifications
```

### TASK-12 — Notification preferences screen
```
Goal:         Let users toggle email types, threshold, and reminder cadence.
Spec:         SPEC §7, Story 4b; PLAN §6
In:           Prefs (useNotificationPrefs)
Out:          Updated preferences
Edge:         threshold 0–100 only; frequency daily/weekly; opt-out reflected immediately
DoD:          • changes persist and show on reload
Deps:         TASK-08
Out of scope: Server-side sending
```

### TASK-13 — Compose MonthView + responsive + frontend tests
```
Goal:         Assemble the main screen, make it responsive, and test the UI.
Spec:         PLAN §2/§6, §9; SPEC §6 (mobile)
In:           Dashboard, entry form/list, navigator, banner, prefs
Out:          Working authenticated MonthView; responsive layout
Edge:         Loading/empty/error states; narrow viewport; touch targets
DoD:          • full month workflow usable on desktop & mobile
              • component tests: validation, optimistic rollback, dismiss, read-only past month
Deps:         TASK-09, TASK-10, TASK-11, TASK-12, TASK-07
Out of scope: Native app, dark mode
```

### TASK-14 — Deploy backend (migrations, functions, auth emails, provider, cron)
```
Goal:         Ship the Supabase backend and wire production email + scheduling.
Spec:         PLAN §4/§8; SPEC §1, §7
In:           Migrations + functions; Auth templates/redirects; provider DNS + EMAIL_* secrets; cron schedule
Out:          Live backend; working confirm/reset emails; verified sender; scheduled notify sweep
Edge:         Failed migration blocks CI; wrong redirect → broken link; unverified domain → poor delivery;
              UTC timezone for month-end/reminders; overlapping cron runs
DoD:          • `supabase db push` succeeds, functions deployed, isolation tests green in CI
              • signup/reset + a test notification email all deliver • scheduled notify fires (idempotent)
Deps:         TASK-03, TASK-06
Out of scope: Frontend hosting; SMS/push; per-user timezone
```

### TASK-15 — Deploy frontend & end-to-end smoke test
```
Goal:         Publish the SPA publicly and validate the full cross-device + email journey.
Spec:         SPEC NFR §9, §6, §7; PLAN §8, §9
In:           Production build + env vars; two browsers/devices
Out:          Public HTTPS app URL (Vercel/Netlify); verified end-to-end run
Edge:         Missing build env → fail fast; not localhost
DoD:          • app reachable from any machine over HTTPS
              • E2E: register → login on 2nd device → log hours → see synced data → hit goal → alert + email
Deps:         TASK-13, TASK-14
Out of scope: Load/performance testing
```

---

## Critical Path
`00 → 01 → 02 → 03 → 04 → 05` , `04→06`
`01 → 07` ; `02,04 → 08 → {09,10,11,12} → 13`
`03,06 → 14` ; `13,14 → 15`

> RLS (TASK-03) precedes any trusted client data access. The email engine (TASK-06) can be built
> in parallel with the frontend (07–13) once the schema (02) and summary (04) exist.

## Coverage Check (SPEC → tasks)
| SPEC area | Tasks |
|-----------|-------|
| §1 Registration & Auth | 07, 14 |
| §2 Profile & Settings | 02, 08 |
| §3 Daily Time Tracking | 02, 08, 10 |
| §4 Monthly Tracking & Progress | 04, 08, 09, 11 |
| §5 In-app Alerts | 02, 05, 11 |
| §6 Persistence & Cross-Device | 02, 15 |
| §7 Email Notifications | 02, 06, 12, 14 |
| Per-user isolation (NFR §8) | 03 |
| Edge cases (§1–9) | 04, 05, 06, 10, 13 |
| Security/HTTPS/hosting (NFR §7/§9) | 03, 14, 15 |
