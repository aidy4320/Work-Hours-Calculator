-- TASK-02 — Database schema (PLAN §3)
-- Tables, shared updated_at trigger, and signup-seed trigger.
-- NOTE: Row Level Security policies are added separately in TASK-03.

-- ---------------------------------------------------------------------------
-- Shared trigger function: stamp updated_at = now() on every UPDATE
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- user_settings — one row per user (SPEC §2)
-- ---------------------------------------------------------------------------
create table public.user_settings (
  user_id              uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  monthly_target_hours numeric(7,2) not null default 0  check (monthly_target_hours >= 0),
  standard_daily_hours numeric(5,2) not null default 8  check (standard_daily_hours >= 0),
  created_at           timestamptz  not null default now(),
  updated_at           timestamptz  not null default now()
);

create trigger trg_user_settings_updated
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- time_entries — many per user/day (SPEC §3)
-- ---------------------------------------------------------------------------
create table public.time_entries (
  id           bigint generated always as identity primary key,
  user_id      uuid        not null references auth.users (id) on delete cascade default auth.uid(),
  entry_date   date        not null check (entry_date <= current_date),
  hours_worked numeric(7,2) not null check (hours_worked >= 0),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index ix_time_entries_user_date on public.time_entries (user_id, entry_date);

create trigger trg_time_entries_updated
  before update on public.time_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- alerts — one milestone row per user-month (SPEC §5)
-- ---------------------------------------------------------------------------
create table public.alerts (
  id          bigint generated always as identity primary key,
  user_id     uuid        not null references auth.users (id) on delete cascade default auth.uid(),
  month       date        not null,
  achieved_at timestamptz not null default now(),
  dismissed   boolean     not null default false,
  constraint uq_alerts_user_month unique (user_id, month)
);

-- ---------------------------------------------------------------------------
-- notification_settings — per-user email preferences (SPEC §7)
-- ---------------------------------------------------------------------------
create table public.notification_settings (
  user_id                      uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  behind_target_enabled        boolean      not null default true,
  behind_target_threshold_pct  numeric(5,2) not null default 50 check (behind_target_threshold_pct between 0 and 100),
  reminder_enabled             boolean      not null default true,
  reminder_frequency           text         not null default 'weekly' check (reminder_frequency in ('daily', 'weekly')),
  goal_achieved_email_enabled  boolean      not null default true,
  monthly_summary_enabled      boolean      not null default true,
  created_at                   timestamptz  not null default now(),
  updated_at                   timestamptz  not null default now()
);

create trigger trg_notification_settings_updated
  before update on public.notification_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- notification_log — once-per-period guard for sent emails (SPEC §7, Edge §9)
-- Written only by the server-side `notify` function (service role); TASK-03
-- restricts client access to SELECT-only.
-- ---------------------------------------------------------------------------
create table public.notification_log (
  id      bigint generated always as identity primary key,
  user_id uuid        not null references auth.users (id) on delete cascade default auth.uid(),
  type    text        not null check (type in ('behind_target', 'reminder', 'goal_achieved', 'monthly_summary')),
  period  text        not null,
  sent_at timestamptz not null default now(),
  status  text        not null check (status in ('sent', 'failed')),
  constraint uq_notif_user_type_period unique (user_id, type, period)
);

-- ---------------------------------------------------------------------------
-- handle_new_user — seed default settings rows when a user signs up (PLAN §3)
-- SECURITY DEFINER so it can insert on behalf of the new user.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_settings (user_id) values (new.id)
    on conflict (user_id) do nothing;
  insert into public.notification_settings (user_id) values (new.id)
    on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
