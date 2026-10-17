-- Phase 1 (security): clients may no longer write these tables directly with the public key.
-- All writes already go through server actions/routes that use the service role and check permissions.
-- Reads are unchanged.

-- 1. Remove the table write privileges from client roles. This blocks direct writes no matter which
--    policies exist in production (policy names there may differ from the repo).
revoke insert, update, delete on
  public.teams,
  public.team_players,
  public.match_schedule,
  public.goal_events,
  public.match_events,
  public.clean_sheets
from anon, authenticated;

-- Profiles: users could previously update ANY column of their own row (e.g. is_site_admin, is_suspended).
-- Profile edits go through /api/players/[id]/profile (service role, allow-listed columns); new profiles are
-- created by the handle_new_user trigger (security definer).
revoke insert, update, delete on public.profiles from anon, authenticated;

-- 2. Drop the now-pointless write policies so the intent is clear.
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('teams', 'team_players', 'match_schedule', 'goal_events', 'match_events', 'clean_sheets', 'profiles')
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;
