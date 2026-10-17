-- Phase 5: easier live scoring.
--  • One write path for match events (log / edit / void) that locks the match row, checks the team and
--    player belong to the match, is idempotent on a client-generated id, and recomputes the score in the
--    same transaction (no more delete/re-insert race).
--  • A shared match clock stored on match_schedule, so every phone shows the same time.
--  • complete_match: finish a match, write clean sheets, and complete the matchday when all are done.
--    Corrections to a finished match keep its score and clean sheets right.
-- Additive: old columns and goal_events stay (goal_events is kept in sync for existing readers).

-- ── match_events ──
alter table public.match_events add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.match_events add column if not exists updated_at timestamptz;
alter table public.match_events add column if not exists voided_at timestamptz;
alter table public.match_events add column if not exists guest_rsvp_id uuid references public.rsvps(id) on delete set null;
alter table public.match_events add column if not exists secondary_guest_rsvp_id uuid references public.rsvps(id) on delete set null;

-- Deleting a profile must not delete (and so rewrite) past goals.
alter table public.match_events drop constraint if exists match_events_player_id_fkey;
alter table public.match_events add constraint match_events_player_id_fkey
  foreign key (player_id) references public.profiles(id) on delete set null;

create index if not exists match_events_live_idx on public.match_events (match_schedule_id, created_at) where voided_at is null;

-- ── shared clock ──
alter table public.match_schedule add column if not exists timing_mode text not null default 'halves';
alter table public.match_schedule add column if not exists half_minutes int;
alter table public.match_schedule add column if not exists clock_running boolean not null default false;
alter table public.match_schedule add column if not exists clock_started_at timestamptz;
alter table public.match_schedule add column if not exists clock_elapsed_ms bigint not null default 0;
do $$ begin
  alter table public.match_schedule add constraint match_schedule_timing_mode_check check (timing_mode in ('halves', 'continuous'));
exception when duplicate_object then null; end $$;

-- ── helpers ──

-- Is this registered player / guest RSVP on this team?
create or replace function public._team_has_participant(p_team uuid, p_player uuid, p_guest uuid)
returns boolean language sql stable as $$
  select case
    when p_player is not null then exists (select 1 from public.team_players where team_id = p_team and player_id = p_player)
    -- guest_members holds bare RSVP ids, sometimes with a " (C)" captain suffix or a "guest_" prefix.
    when p_guest is not null then exists (
      select 1 from public.teams t, jsonb_array_elements_text(coalesce(t.guest_members, '[]'::jsonb)) g(e)
      where t.id = p_team and g.e in (p_guest::text, p_guest::text || ' (C)', 'guest_' || p_guest::text)
    )
    else true
  end;
$$;

-- Score from the (non-voided) goal events, and keep the legacy goal_events table in sync for old readers.
-- Matches whose goals only ever lived in goal_events (very old data) are left alone.
create or replace function public._recompute_match(p_match uuid)
returns void language plpgsql as $$
declare
  m public.match_schedule;
begin
  select * into m from public.match_schedule where id = p_match;
  if not exists (select 1 from public.match_events where match_schedule_id = p_match and event_type = 'goal') then
    return;
  end if;

  update public.match_schedule set
    home_score = (
      select count(*) from public.match_events e
      where e.match_schedule_id = p_match and e.event_type = 'goal' and e.voided_at is null
        and ((e.team_id = m.home_team_id and coalesce((e.details_json->>'is_own_goal')::boolean, false) = false)
          or (e.team_id = m.away_team_id and coalesce((e.details_json->>'is_own_goal')::boolean, false) = true))
    ),
    away_score = (
      select count(*) from public.match_events e
      where e.match_schedule_id = p_match and e.event_type = 'goal' and e.voided_at is null
        and ((e.team_id = m.away_team_id and coalesce((e.details_json->>'is_own_goal')::boolean, false) = false)
          or (e.team_id = m.home_team_id and coalesce((e.details_json->>'is_own_goal')::boolean, false) = true))
    )
  where id = p_match;

  delete from public.goal_events where match_schedule_id = p_match;
  insert into public.goal_events (match_schedule_id, scorer_id, assist_id, team_id, is_own_goal, minute, guest_scorer_name, guest_assist_name)
  select e.match_schedule_id, e.player_id, e.secondary_player_id, e.team_id,
         coalesce((e.details_json->>'is_own_goal')::boolean, false), e.minute,
         (select guest_name from public.rsvps where id = e.guest_rsvp_id),
         (select guest_name from public.rsvps where id = e.secondary_guest_rsvp_id)
  from public.match_events e
  where e.match_schedule_id = p_match and e.event_type = 'goal' and e.voided_at is null;
end $$;

-- ── public API (service role only) ──

-- Logs one event. p_id is generated by the phone, so a retry or double tap can't create a duplicate.
-- Returns the event plus "possible_duplicate" when someone else logged the same thing in the last 20s.
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
  select * into ev from public.match_events where id = p_event and match_schedule_id = p_match;
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

create or replace function public.void_match_event(p_event uuid, p_match uuid)
returns public.match_events language plpgsql security definer set search_path = public as $$
declare
  m public.match_schedule;
  ev public.match_events;
begin
  select * into m from public.match_schedule where id = p_match for update;
  update public.match_events set voided_at = coalesce(voided_at, now()), updated_at = now()
  where id = p_event and match_schedule_id = p_match returning * into ev;
  if ev.id is null then raise exception 'Event not found'; end if;
  if ev.event_type = 'goal' then
    perform public._recompute_match(p_match);
    if m.status = 'completed' then perform public._write_clean_sheets(p_match); end if;
  end if;
  return ev;
end $$;

-- Clean sheets for a finished match: players of a side that conceded nothing, minus DNP.
create or replace function public._write_clean_sheets(p_match uuid)
returns void language plpgsql as $$
declare m public.match_schedule;
begin
  select * into m from public.match_schedule where id = p_match;
  delete from public.clean_sheets where match_schedule_id = p_match;
  if m.status <> 'completed' then return; end if;
  insert into public.clean_sheets (match_schedule_id, player_id, team_id)
  select p_match, tp.player_id, tp.team_id
  from public.team_players tp
  where ((tp.team_id = m.home_team_id and coalesce(m.away_score, 0) = 0)
      or (tp.team_id = m.away_team_id and coalesce(m.home_score, 0) = 0))
    and not (tp.player_id = any(coalesce(m.dnp_player_ids, '{}'::uuid[])))
  on conflict (match_schedule_id, player_id) do nothing;
end $$;

-- Finishes a match: stops the clock, writes clean sheets, and marks the matchday completed once every
-- fixture is done.
create or replace function public.complete_match(p_match uuid)
returns public.match_schedule language plpgsql security definer set search_path = public as $$
declare
  m public.match_schedule;
begin
  select * into m from public.match_schedule where id = p_match for update;
  if not found then raise exception 'Match not found'; end if;
  perform public._recompute_match(p_match);
  update public.match_schedule set
    status = 'completed', period = 'completed', clock_running = false, clock_started_at = null,
    clock_elapsed_ms = clock_elapsed_ms + case when clock_running and clock_started_at is not null
      then (extract(epoch from (now() - clock_started_at)) * 1000)::bigint else 0 end
  where id = p_match returning * into m;
  perform public._write_clean_sheets(p_match);

  if not exists (select 1 from public.match_schedule where booking_id = m.booking_id and status <> 'completed') then
    update public.bookings set status = 'completed' where id = m.booking_id and status in ('upcoming', 'ongoing');
  end if;
  return m;
end $$;

-- The shared match clock. clock_elapsed_ms is time banked in the current period; while running, phones add
-- (server now - clock_started_at). The 2nd half's minutes start at half_minutes.
--   start(mode, half_minutes) / pause / resume / half_time / second_half / adjust(delta_ms) / reset
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

do $$
declare f text;
begin
  foreach f in array array[
    'log_match_event(uuid,uuid,text,uuid,uuid,uuid,uuid,uuid,int,jsonb,uuid)',
    'update_match_event(uuid,uuid,uuid,uuid,uuid,uuid,int,jsonb)',
    'void_match_event(uuid,uuid)', 'complete_match(uuid)', 'match_clock(uuid,text,text,int,bigint)',
    '_team_has_participant(uuid,uuid,uuid)', '_recompute_match(uuid)', '_write_clean_sheets(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
