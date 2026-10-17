-- Fixes from the Phase 5/6 review (all tightening; the app works with or without this applied).
--  • log_match_event: a retry id only counts as "already logged" for the same match.
--  • update_match_event: can't edit a deleted (voided) event.
--  • match_clock('start'): only from not-started, so a second Kick off can't reset a running match.
--  • Old matches whose goals only live in goal_events (or only in the stored score) are converted to
--    match_events the first time someone edits them, so a new goal doesn't wipe the old ones.
--  • Match events, goals and clean sheets are only read through the server (members-checked);
--    signed-in users can no longer read every group's rows directly through the public API.

-- Convert a legacy match before the first new event touches it. Goals from goal_events become events
-- (guests by name, as on very old teams); any part of the stored score not covered by goal_events becomes
-- unknown-scorer goals, so the score stays exactly what it was.
create or replace function public._adopt_legacy_goals(p_match uuid)
returns void language plpgsql as $$
declare
  m public.match_schedule;
  v_home int;
  v_away int;
begin
  if exists (select 1 from public.match_events where match_schedule_id = p_match and event_type = 'goal') then
    return;
  end if;
  select * into m from public.match_schedule where id = p_match;
  if not exists (select 1 from public.goal_events where match_schedule_id = p_match)
     and coalesce(m.home_score, 0) + coalesce(m.away_score, 0) = 0 then
    return;
  end if;

  insert into public.match_events (match_schedule_id, event_type, team_id, player_id, secondary_player_id, minute, details_json, created_at)
  select p_match, 'goal', g.team_id, g.scorer_id, g.assist_id, coalesce(g.minute, 0),
         jsonb_build_object('is_own_goal', coalesce(g.is_own_goal, false), 'adopted_legacy', true)
           || case when g.scorer_id is null and g.guest_scorer_name is not null then jsonb_build_object('guest_player_id', 'guest_' || g.guest_scorer_name) else '{}'::jsonb end
           || case when g.assist_id is null and g.guest_assist_name is not null then jsonb_build_object('guest_secondary_player_id', 'guest_' || g.guest_assist_name) else '{}'::jsonb end,
         coalesce(g.created_at, now())
  from public.goal_events g
  where g.match_schedule_id = p_match and g.team_id in (m.home_team_id, m.away_team_id);

  select
    count(*) filter (where (team_id = m.home_team_id) <> coalesce((details_json->>'is_own_goal')::boolean, false)),
    count(*) filter (where (team_id = m.away_team_id) <> coalesce((details_json->>'is_own_goal')::boolean, false))
  into v_home, v_away
  from public.match_events where match_schedule_id = p_match and event_type = 'goal';

  insert into public.match_events (match_schedule_id, event_type, team_id, minute, details_json)
  select p_match, 'goal', m.home_team_id, 0, '{"is_own_goal": false, "adopted_legacy": true}'::jsonb
  from generate_series(1, greatest(0, coalesce(m.home_score, 0) - v_home));
  insert into public.match_events (match_schedule_id, event_type, team_id, minute, details_json)
  select p_match, 'goal', m.away_team_id, 0, '{"is_own_goal": false, "adopted_legacy": true}'::jsonb
  from generate_series(1, greatest(0, coalesce(m.away_score, 0) - v_away));
end $$;

create or replace function public.log_match_event(
  p_id uuid, p_match uuid, p_type text, p_team uuid,
  p_player uuid, p_guest uuid, p_secondary uuid, p_secondary_guest uuid,
  p_minute int, p_details jsonb, p_created_by uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m public.match_schedule;
  ev public.match_events;
  v_dup uuid;
begin
  select * into m from public.match_schedule where id = p_match for update;
  if not found then raise exception 'Match not found'; end if;

  select * into ev from public.match_events where id = p_id;
  if found then
    if ev.match_schedule_id <> p_match then raise exception 'Event id already used'; end if;
    return jsonb_build_object('event', to_jsonb(ev), 'possible_duplicate', null);
  end if;

  if p_type not in ('goal', 'card', 'sub', 'penalty_save') then raise exception 'Unknown event type'; end if;
  if p_team is null or p_team not in (m.home_team_id, m.away_team_id) then
    raise exception 'That team is not playing in this match';
  end if;
  -- (very old teams list guests by name only; those arrive as details.guest_player_id with no RSVP id)
  if p_type <> 'goal' and p_player is null and p_guest is null and not (coalesce(p_details, '{}'::jsonb) ? 'guest_player_id') then
    raise exception 'Pick a player';
  end if;
  if not public._team_has_participant(p_team, p_player, p_guest) then raise exception 'That player is not on this team'; end if;
  if (p_secondary is not null or p_secondary_guest is not null)
     and not public._team_has_participant(p_team, p_secondary, p_secondary_guest) then
    raise exception 'That player is not on this team';
  end if;

  if p_type = 'goal' then perform public._adopt_legacy_goals(p_match); end if;

  select id into v_dup from public.match_events
  where match_schedule_id = p_match and voided_at is null and event_type = p_type and team_id = p_team
    and player_id is not distinct from p_player and guest_rsvp_id is not distinct from p_guest
    and created_by is distinct from p_created_by and created_at > now() - interval '20 seconds'
  order by created_at desc limit 1;

  insert into public.match_events (
    id, match_schedule_id, event_type, team_id, player_id, guest_rsvp_id, secondary_player_id, secondary_guest_rsvp_id,
    minute, details_json, created_by
  ) values (
    p_id, p_match, p_type, p_team, p_player, p_guest, p_secondary, p_secondary_guest, greatest(0, coalesce(p_minute, 0)),
    coalesce(p_details, '{}'::jsonb)
      || case when p_guest is not null then jsonb_build_object('guest_player_id', 'guest_' || p_guest) else '{}'::jsonb end
      || case when p_secondary_guest is not null then jsonb_build_object('guest_secondary_player_id', 'guest_' || p_secondary_guest) else '{}'::jsonb end,
    p_created_by
  ) returning * into ev;

  if p_type = 'goal' then
    perform public._recompute_match(p_match);
    if m.status = 'completed' then perform public._write_clean_sheets(p_match); end if;
  end if;
  return jsonb_build_object('event', to_jsonb(ev), 'possible_duplicate', v_dup);
end $$;

create or replace function public.update_match_event(
  p_event uuid, p_match uuid, p_player uuid, p_guest uuid, p_secondary uuid, p_secondary_guest uuid,
  p_minute int, p_details jsonb
) returns public.match_events language plpgsql security definer set search_path = public as $$
declare
  m public.match_schedule;
  ev public.match_events;
begin
  select * into m from public.match_schedule where id = p_match for update;
  select * into ev from public.match_events where id = p_event and match_schedule_id = p_match and voided_at is null;
  if ev.id is null then raise exception 'Event not found'; end if;
  if not public._team_has_participant(ev.team_id, p_player, p_guest) then raise exception 'That player is not on this team'; end if;
  if (p_secondary is not null or p_secondary_guest is not null)
     and not public._team_has_participant(ev.team_id, p_secondary, p_secondary_guest) then
    raise exception 'That player is not on this team';
  end if;

  update public.match_events set
    player_id = p_player,
    guest_rsvp_id = p_guest,
    secondary_player_id = p_secondary,
    secondary_guest_rsvp_id = p_secondary_guest,
    minute = greatest(0, coalesce(p_minute, minute)),
    details_json = (coalesce(details_json, '{}'::jsonb) - 'guest_player_id' - 'guest_secondary_player_id')
      || coalesce(p_details, '{}'::jsonb)
      || case when p_guest is not null then jsonb_build_object('guest_player_id', 'guest_' || p_guest) else '{}'::jsonb end
      || case when p_secondary_guest is not null then jsonb_build_object('guest_secondary_player_id', 'guest_' || p_secondary_guest) else '{}'::jsonb end,
    updated_at = now()
  where id = p_event returning * into ev;

  if ev.event_type = 'goal' then perform public._recompute_match(p_match); end if;
  if m.status = 'completed' then perform public._write_clean_sheets(p_match); end if;
  return ev;
end $$;

-- Same clock as 0005, but "start" only works on a match that hasn't started.
create or replace function public.match_clock(p_match uuid, p_cmd text, p_timing_mode text default null, p_half_minutes int default null, p_delta_ms bigint default 0)
returns public.match_schedule language plpgsql security definer set search_path = public as $$
declare
  m public.match_schedule;
  v_now timestamptz := now();
  v_run bigint;
  v_half int;
  v_mode text;
begin
  select * into m from public.match_schedule where id = p_match for update;
  if not found then raise exception 'Match not found'; end if;
  if m.status = 'completed' then raise exception 'This match is already finished'; end if;
  v_run := case when m.clock_running and m.clock_started_at is not null
    then (extract(epoch from (v_now - m.clock_started_at)) * 1000)::bigint else 0 end;

  if p_cmd = 'start' then
    if m.status <> 'scheduled' then raise exception 'The match has already kicked off'; end if;
    v_mode := coalesce(p_timing_mode, m.timing_mode, 'halves');
    v_half := greatest(1, coalesce(p_half_minutes, m.half_minutes, 15));
    update public.match_schedule set
      status = 'ongoing', period = '1st_half', timing_mode = v_mode, half_minutes = v_half,
      duration_minutes = case when v_mode = 'halves' then v_half * 2 else v_half end,
      started_at = v_now, clock_running = true, clock_started_at = v_now, clock_elapsed_ms = 0
    where id = p_match returning * into m;
  elsif m.status <> 'ongoing' and p_cmd <> 'reset' then
    raise exception 'Start the match first';
  elsif p_cmd = 'pause' then
    update public.match_schedule set clock_running = false, clock_started_at = null, clock_elapsed_ms = clock_elapsed_ms + v_run
    where id = p_match returning * into m;
  elsif p_cmd = 'resume' then
    if coalesce(m.period, '') not in ('1st_half', '2nd_half') then raise exception 'The clock only runs during a half'; end if;
    update public.match_schedule set clock_running = true, clock_started_at = case when clock_running then clock_started_at else v_now end
    where id = p_match returning * into m;
  elsif p_cmd = 'half_time' then
    if coalesce(m.period, '') <> '1st_half' or m.timing_mode <> 'halves' then raise exception 'Not in the first half'; end if;
    update public.match_schedule set period = 'half_time', clock_running = false, clock_started_at = null, clock_elapsed_ms = 0
    where id = p_match returning * into m;
  elsif p_cmd = 'second_half' then
    if coalesce(m.period, '') <> 'half_time' then raise exception 'Not at half-time'; end if;
    update public.match_schedule set period = '2nd_half', clock_running = true, clock_started_at = v_now, clock_elapsed_ms = 0
    where id = p_match returning * into m;
  elsif p_cmd = 'adjust' then
    update public.match_schedule set
      clock_elapsed_ms = greatest(0, clock_elapsed_ms + v_run + coalesce(p_delta_ms, 0)),
      clock_started_at = case when clock_running then v_now else null end
    where id = p_match returning * into m;
  elsif p_cmd = 'reset' then
    update public.match_schedule set
      status = 'scheduled', period = null, started_at = null, clock_running = false, clock_started_at = null, clock_elapsed_ms = 0
    where id = p_match returning * into m;
  else
    raise exception 'Unknown clock command';
  end if;
  return m;
end $$;

revoke all on function public._adopt_legacy_goals(uuid) from public, anon, authenticated;
grant execute on function public._adopt_legacy_goals(uuid) to service_role;
revoke all on function public.log_match_event(uuid,uuid,text,uuid,uuid,uuid,uuid,uuid,int,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.log_match_event(uuid,uuid,text,uuid,uuid,uuid,uuid,uuid,int,jsonb,uuid) to service_role;
revoke all on function public.update_match_event(uuid,uuid,uuid,uuid,uuid,uuid,int,jsonb) from public, anon, authenticated;
grant execute on function public.update_match_event(uuid,uuid,uuid,uuid,uuid,uuid,int,jsonb) to service_role;
revoke all on function public.match_clock(uuid,text,text,int,bigint) from public, anon, authenticated;
grant execute on function public.match_clock(uuid,text,text,int,bigint) to service_role;

-- Reads go through server routes that check group membership; nothing in the browser reads these tables.
drop policy if exists "Anyone authenticated can view match events" on public.match_events;
drop policy if exists "Members can view goals" on public.goal_events;
drop policy if exists "Members can view clean sheets" on public.clean_sheets;
revoke select on public.match_events, public.goal_events, public.clean_sheets from anon, authenticated;
