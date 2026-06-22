-- TASK-03 — Row Level Security (PLAN §3, §5.6; SPEC §1, NFR §8)
-- Per-user isolation enforced in the database: every request is scoped to
-- auth.uid(). notification_log is READ-ONLY for clients (only the server-side
-- `notify` function, running as service_role, writes it — service_role bypasses RLS).

-- ---------------------------------------------------------------------------
-- Enable RLS on all application tables
-- ---------------------------------------------------------------------------
alter table public.user_settings         enable row level security;
alter table public.time_entries          enable row level security;
alter table public.alerts                enable row level security;
alter table public.notification_settings enable row level security;
alter table public.notification_log      enable row level security;

-- ---------------------------------------------------------------------------
-- Full-CRUD own-rows policies: user_settings
-- ---------------------------------------------------------------------------
create policy "own rows - select" on public.user_settings
  for select using (auth.uid() = user_id);
create policy "own rows - insert" on public.user_settings
  for insert with check (auth.uid() = user_id);
create policy "own rows - update" on public.user_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows - delete" on public.user_settings
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Full-CRUD own-rows policies: time_entries
-- ---------------------------------------------------------------------------
create policy "own rows - select" on public.time_entries
  for select using (auth.uid() = user_id);
create policy "own rows - insert" on public.time_entries
  for insert with check (auth.uid() = user_id);
create policy "own rows - update" on public.time_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows - delete" on public.time_entries
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Full-CRUD own-rows policies: alerts
-- ---------------------------------------------------------------------------
create policy "own rows - select" on public.alerts
  for select using (auth.uid() = user_id);
create policy "own rows - insert" on public.alerts
  for insert with check (auth.uid() = user_id);
create policy "own rows - update" on public.alerts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows - delete" on public.alerts
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Full-CRUD own-rows policies: notification_settings
-- ---------------------------------------------------------------------------
create policy "own rows - select" on public.notification_settings
  for select using (auth.uid() = user_id);
create policy "own rows - insert" on public.notification_settings
  for insert with check (auth.uid() = user_id);
create policy "own rows - update" on public.notification_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows - delete" on public.notification_settings
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- READ-ONLY policy: notification_log
-- Users may read their own log rows but never write them; only the server-side
-- `notify` function (service_role, which bypasses RLS) inserts here.
-- ---------------------------------------------------------------------------
create policy "own log - select" on public.notification_log
  for select using (auth.uid() = user_id);
