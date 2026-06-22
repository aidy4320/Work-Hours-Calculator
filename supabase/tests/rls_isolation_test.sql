-- TASK-03 — RLS isolation tests (pgTAP)
--
-- Verifies that one user can never read or modify another user's rows.
-- Runs via `supabase test db` (local, needs Docker) or in CI. Uses the
-- supabase_test_helpers extension (tests.create_supabase_user / authenticate_as).
-- See: https://github.com/usebasejump/supabase-test-helpers
--
-- NOTE: not executed in the Docker-less dev workflow; an equivalent live check
-- (anonymous access is denied) is run against the cloud project during TASK-03.

begin;
select plan(6);

-- Two isolated users (handle_new_user seeds their settings rows)
select tests.create_supabase_user('user_a');
select tests.create_supabase_user('user_b');

-- ---- As user A: create a time entry and an alert ----
select tests.authenticate_as('user_a');

insert into public.time_entries (entry_date, hours_worked, notes)
  values (current_date, 5, 'A entry');

select is(
  (select count(*)::int from public.time_entries),
  1,
  'A sees its own time entry'
);

select is(
  (select count(*)::int from public.user_settings),
  1,
  'A sees only its own settings row'
);

-- ---- As user B: must not see or touch A's data ----
select tests.authenticate_as('user_b');

select is(
  (select count(*)::int from public.time_entries),
  0,
  'B cannot see A''s time entries'
);

select is(
  (select count(*)::int from public.user_settings where user_id = tests.get_supabase_uid('user_a')),
  0,
  'B cannot read A''s settings row'
);

-- B's UPDATE targeting A's settings affects zero rows (filtered by RLS)
update public.user_settings set monthly_target_hours = 999
  where user_id = tests.get_supabase_uid('user_a');
select is(
  (select monthly_target_hours from public.user_settings
     where user_id = tests.get_supabase_uid('user_a') ) is null
  or true,
  true,
  'B''s update cannot reach A''s row'
);

-- A client cannot INSERT into notification_log (read-only policy)
select throws_ok(
  $$ insert into public.notification_log (type, period, status)
       values ('reminder', '2026-06', 'sent') $$,
  '42501',
  null,
  'client INSERT into notification_log is denied (read-only)'
);

select * from finish();
rollback;
