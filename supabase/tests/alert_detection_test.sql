-- TASK-05 — Alert-detection trigger tests (pgTAP)
-- Runs via `supabase test db` (Docker) or CI. Uses supabase_test_helpers.
-- Not run in the Docker-less dev workflow (needs an authenticated user + data);
-- the migration is applied and validated against the cloud during TASK-05.

begin;
select plan(6);

select tests.create_supabase_user('u');
select tests.authenticate_as('u');

update public.user_settings set monthly_target_hours = 10
  where user_id = tests.get_supabase_uid('u');

-- Below target -> no alert
insert into public.time_entries (entry_date, hours_worked) values ('2026-06-01', 4);
select is((select count(*)::int from public.alerts where month = '2026-06-01'), 0,
  'no alert while below target');

-- Two entries summing to the exact target -> alert at the completing entry
insert into public.time_entries (entry_date, hours_worked) values ('2026-06-02', 6); -- total 10
select is((select count(*)::int from public.alerts where month = '2026-06-01'), 1,
  'alert created at exact target (sum of entries)');

-- Further entries do not duplicate the alert
insert into public.time_entries (entry_date, hours_worked) values ('2026-06-03', 5);
select is((select count(*)::int from public.alerts where month = '2026-06-01'), 1,
  'no duplicate alert for the same month');

-- Deleting back below target keeps the alert
delete from public.time_entries where entry_date in ('2026-06-02', '2026-06-03');
select is((select count(*)::int from public.alerts where month = '2026-06-01'), 1,
  'alert survives a drop below target');

-- Single large entry meeting the target in another month -> alert
insert into public.time_entries (entry_date, hours_worked) values ('2026-05-15', 50);
select is((select count(*)::int from public.alerts where month = '2026-05-01'), 1,
  'single large entry triggers an alert');

-- target 0 -> reached immediately (April, fresh month)
update public.user_settings set monthly_target_hours = 0
  where user_id = tests.get_supabase_uid('u');
insert into public.time_entries (entry_date, hours_worked) values ('2026-04-10', 1);
select is((select count(*)::int from public.alerts where month = '2026-04-01'), 1,
  'target 0 -> goal reached, alert created');

select * from finish();
rollback;
