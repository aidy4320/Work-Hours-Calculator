-- Vacation/holiday entries credit hours (SPEC §3/§4; PLAN §3/§4)
-- Adds time_entries.entry_type and makes vacation/holiday days credit the
-- user's standard daily hours toward the monthly total. A shared helper
-- (monthly_worked) is reused by get_monthly_summary and the alert trigger.

-- 1) entry_type on time_entries (existing rows default to 'work')
alter table public.time_entries
  add column if not exists entry_type text not null default 'work'
    check (entry_type in ('work', 'vacation', 'holiday'));

-- hours_worked is optional for day-off entries
alter table public.time_entries
  alter column hours_worked set default 0;

-- 2) Shared monthly total: work hours + (vacation/holiday days × standard daily hours)
create or replace function public.monthly_worked(p_uid uuid, p_year int, p_month int)
returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce((
      select sum(hours_worked)
        from public.time_entries
       where user_id = p_uid
         and entry_type = 'work'
         and entry_date >= make_date(p_year, p_month, 1)
         and entry_date <  (make_date(p_year, p_month, 1) + interval '1 month')::date
    ), 0)
    + coalesce((
        select count(distinct entry_date)
          from public.time_entries
         where user_id = p_uid
           and entry_type in ('vacation', 'holiday')
           and entry_date >= make_date(p_year, p_month, 1)
           and entry_date <  (make_date(p_year, p_month, 1) + interval '1 month')::date
      ), 0)
      * coalesce((select standard_daily_hours from public.user_settings where user_id = p_uid), 0);
$$;

-- 3) Monthly summary now uses the combined total + day-off-aware breakdown
create or replace function public.get_monthly_summary(p_year int, p_month int)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid       uuid    := auth.uid();
  v_ms        date    := make_date(p_year, p_month, 1);
  v_me        date    := (make_date(p_year, p_month, 1) + interval '1 month')::date;
  v_target    numeric := 0;
  v_std       numeric := 0;
  v_worked    numeric := 0;
  v_remaining numeric := 0;
  v_percent   numeric := 0;
  v_goal      boolean := false;
  v_breakdown jsonb   := '[]'::jsonb;
begin
  select coalesce(monthly_target_hours, 0), coalesce(standard_daily_hours, 0)
    into v_target, v_std
    from public.user_settings
   where user_id = v_uid;
  v_target := coalesce(v_target, 0);
  v_std    := coalesce(v_std, 0);

  v_worked    := public.monthly_worked(v_uid, p_year, p_month);
  v_remaining := greatest(v_target - v_worked, 0);
  if v_target > 0 then
    v_percent := round(v_worked / v_target * 100, 2);
  else
    v_percent := 100;
  end if;
  v_goal := v_worked >= v_target;

  -- Per-day breakdown: a day-off day shows the credited standard hours; otherwise summed work hours.
  select coalesce(
           jsonb_agg(jsonb_build_object('date', d.entry_date, 'total_hours', d.total) order by d.entry_date),
           '[]'::jsonb
         )
    into v_breakdown
    from (
      select entry_date,
             case when bool_or(entry_type in ('vacation', 'holiday')) then v_std
                  else sum(hours_worked) end as total
        from public.time_entries
       where user_id = v_uid
         and entry_date >= v_ms
         and entry_date <  v_me
       group by entry_date
    ) d;

  return jsonb_build_object(
    'year',             p_year,
    'month',            p_month,
    'target_hours',     v_target,
    'worked_hours',     v_worked,
    'remaining_hours',  v_remaining,
    'percent_complete', v_percent,
    'goal_reached',     v_goal,
    'is_current_month', (
      p_year  = extract(year  from (now() at time zone 'utc'))::int and
      p_month = extract(month from (now() at time zone 'utc'))::int
    ),
    'daily_breakdown',  v_breakdown
  );
end;
$$;

-- 4) Alert detection uses the same combined total (a day off can also complete the goal)
create or replace function public.detect_goal_reached()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid    uuid;
  v_ms     date;
  v_year   int;
  v_month  int;
  v_target numeric := 0;
  v_worked numeric := 0;
begin
  if TG_OP = 'DELETE' then
    return old;
  end if;

  v_uid   := new.user_id;
  v_ms    := date_trunc('month', new.entry_date)::date;
  v_year  := extract(year  from new.entry_date)::int;
  v_month := extract(month from new.entry_date)::int;

  select coalesce(monthly_target_hours, 0) into v_target
    from public.user_settings where user_id = v_uid;
  v_target := coalesce(v_target, 0);

  v_worked := public.monthly_worked(v_uid, v_year, v_month);

  if v_worked >= v_target then
    insert into public.alerts (user_id, month, achieved_at)
      values (v_uid, v_ms, now())
      on conflict (user_id, month) do nothing;
  end if;

  return new;
end;
$$;
