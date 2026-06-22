-- TASK-04 — Monthly summary RPC (PLAN §4, §5.4; SPEC §4)
-- Returns the caller's progress for a given calendar month.
-- SECURITY INVOKER: runs as the caller, so RLS scopes all reads to their rows.
-- All arithmetic uses numeric (no float drift).

create or replace function public.get_monthly_summary(p_year int, p_month int)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid         uuid    := auth.uid();
  v_month_start date    := make_date(p_year, p_month, 1);
  v_month_end   date    := (make_date(p_year, p_month, 1) + interval '1 month')::date; -- exclusive
  v_target      numeric := 0;
  v_worked      numeric := 0;
  v_remaining   numeric := 0;
  v_percent     numeric := 0;
  v_goal        boolean := false;
  v_breakdown   jsonb   := '[]'::jsonb;
begin
  -- Monthly target (0 if no settings row yet)
  select coalesce(monthly_target_hours, 0)
    into v_target
    from public.user_settings
   where user_id = v_uid;
  v_target := coalesce(v_target, 0);

  -- Hours worked within the calendar month
  select coalesce(sum(hours_worked), 0)
    into v_worked
    from public.time_entries
   where user_id = v_uid
     and entry_date >= v_month_start
     and entry_date <  v_month_end;

  v_remaining := greatest(v_target - v_worked, 0);

  -- Percent: target 0 means the goal is met immediately (100%)
  if v_target > 0 then
    v_percent := round(v_worked / v_target * 100, 2);
  else
    v_percent := 100;
  end if;

  -- Goal reached when worked >= target (inclusive); target 0 -> true
  v_goal := v_worked >= v_target;

  -- Per-day breakdown (empty array for an empty month)
  select coalesce(
           jsonb_agg(
             jsonb_build_object('date', d.entry_date, 'total_hours', d.total)
             order by d.entry_date
           ),
           '[]'::jsonb
         )
    into v_breakdown
    from (
      select entry_date, sum(hours_worked) as total
        from public.time_entries
       where user_id = v_uid
         and entry_date >= v_month_start
         and entry_date <  v_month_end
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
