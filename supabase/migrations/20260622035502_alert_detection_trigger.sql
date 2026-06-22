-- TASK-05 — Alert-detection trigger (PLAN §4; SPEC §5, Edge Cases §7)
-- After any change to time_entries, recompute the affected month's total for
-- the user. If total >= target, ensure exactly one alert row exists for that
-- (user, month). The trigger only ever INSERTS (never deletes), so an alert
-- survives a later edit that drops the total below target.
--
-- target = 0 counts as reached (consistent with get_monthly_summary).
-- SECURITY INVOKER: the alerts INSERT passes the owner-only RLS check
-- (auth.uid() = user_id), since the user can only mutate their own entries.

create or replace function public.detect_goal_reached()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid         uuid;
  v_month_start date;
  v_month_end   date;
  v_target      numeric := 0;
  v_worked      numeric := 0;
begin
  -- Deletions only reduce a month's total -> can never newly reach the goal.
  if TG_OP = 'DELETE' then
    return old;
  end if;

  v_uid         := new.user_id;
  v_month_start := date_trunc('month', new.entry_date)::date;
  v_month_end   := (v_month_start + interval '1 month')::date;

  select coalesce(monthly_target_hours, 0)
    into v_target
    from public.user_settings
   where user_id = v_uid;
  v_target := coalesce(v_target, 0);

  select coalesce(sum(hours_worked), 0)
    into v_worked
    from public.time_entries
   where user_id = v_uid
     and entry_date >= v_month_start
     and entry_date <  v_month_end;

  if v_worked >= v_target then
    insert into public.alerts (user_id, month, achieved_at)
      values (v_uid, v_month_start, now())
      on conflict (user_id, month) do nothing;
  end if;

  return new;
end;
$$;

create trigger trg_time_entries_goal
  after insert or update or delete on public.time_entries
  for each row execute function public.detect_goal_reached();
