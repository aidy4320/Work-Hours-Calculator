-- TASK-04 — get_monthly_summary edge-case tests (pgTAP)
-- Runs via `supabase test db` (Docker) or CI. Uses supabase_test_helpers.
-- Not executed in the Docker-less dev workflow; the function is live-smoke-tested
-- against the cloud during TASK-04.

begin;
select plan(9);

select tests.create_supabase_user('u');
select tests.authenticate_as('u');

-- Target = 100h, standard daily hours = 8
update public.user_settings set monthly_target_hours = 100, standard_daily_hours = 8
  where user_id = tests.get_supabase_uid('u');

-- Two entries in June 2026 totalling 65h
insert into public.time_entries (entry_date, hours_worked) values
  ('2026-06-01', 30),
  ('2026-06-02', 35);

select is((public.get_monthly_summary(2026, 6) ->> 'worked_hours')::numeric, 65::numeric,
  'worked_hours sums the month');
select is((public.get_monthly_summary(2026, 6) ->> 'remaining_hours')::numeric, 35::numeric,
  'remaining = target - worked');
select is((public.get_monthly_summary(2026, 6) ->> 'percent_complete')::numeric, 65::numeric,
  'percent_complete = 65');
select is((public.get_monthly_summary(2026, 6) ->> 'goal_reached')::boolean, false,
  'goal not reached below target');
select is(jsonb_array_length(public.get_monthly_summary(2026, 6) -> 'daily_breakdown'), 2,
  'daily_breakdown has one entry per day');

-- A vacation day credits the standard daily hours (8) -> worked 65 + 8 = 73
insert into public.time_entries (entry_date, entry_type) values ('2026-06-03', 'vacation');
select is((public.get_monthly_summary(2026, 6) ->> 'worked_hours')::numeric, 73::numeric,
  'vacation day credits standard daily hours');

-- Empty month -> zeros
select is((public.get_monthly_summary(2026, 5) ->> 'worked_hours')::numeric, 0::numeric,
  'empty month -> worked 0');

-- Target 0 -> 100% and goal reached immediately
update public.user_settings set monthly_target_hours = 0
  where user_id = tests.get_supabase_uid('u');
select is((public.get_monthly_summary(2026, 6) ->> 'percent_complete')::numeric, 100::numeric,
  'target 0 -> 100%');
select is((public.get_monthly_summary(2026, 6) ->> 'goal_reached')::boolean, true,
  'target 0 -> goal reached');

select * from finish();
rollback;
