-- Phase 4: matchday auction. Captains bid imaginary money for the players confirmed for a matchday.
-- New tables only; the auction writes the final squads into the existing teams / team_players /
-- teams.guest_members when it is finalised, so the rest of the matchday works exactly as before.
-- All access goes through server code (service role): RLS on, no client privileges.

-- ─────────────── Remembered skill tiers per group ───────────────
create table if not exists public.group_tiers (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  color text not null default '#64748b',
  created_at timestamptz not null default now(),
  unique (group_id, name)
);

create table if not exists public.group_player_tiers (
  group_id uuid not null references public.groups(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  tier_id uuid not null references public.group_tiers(id) on delete cascade,
  primary key (group_id, player_id)
);

-- Auction defaults remembered per group (budget, step, base price).
alter table public.groups add column if not exists auction_settings jsonb;

-- ─────────────── One auction per matchday ───────────────
create table if not exists public.auctions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'live', 'paused', 'done')),
  phase text not null default 'main' check (phase in ('main', 'reauction', 'done')),
  budget int not null default 8000 check (budget > 0),
  squad_size int not null default 8 check (squad_size between 1 and 30),
  bid_increment int not null default 25 check (bid_increment > 0),
  base_price int not null default 50 check (base_price >= 0),
  -- Each team must end up with at least one player from every tier that has players.
  require_each_tier boolean not null default true,
  current_entry_id uuid,
  call_state text not null default 'none' check (call_state in ('none', 'once', 'twice')),
  finalized_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.auction_tiers (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  group_tier_id uuid references public.group_tiers(id) on delete set null,
  name text not null,
  sort_order int not null default 0,
  base_price int check (base_price >= 0),
  color text not null default '#64748b',
  unique (auction_id, name)
);

-- Which of the matchday's teams take part (teams are created with their captains at setup).
create table if not exists public.auction_teams (
  team_id uuid primary key references public.teams(id) on delete cascade,
  auction_id uuid not null references public.auctions(id) on delete cascade,
  sort_order int not null default 0,
  budget_adjustment int not null default 0
);
create index if not exists auction_teams_auction_idx on public.auction_teams (auction_id);

-- The pool: one row per confirmed RSVP (registered player or guest).
create table if not exists public.auction_entries (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  rsvp_id uuid not null references public.rsvps(id) on delete cascade,
  player_id uuid references public.profiles(id) on delete set null,
  display_name text not null,
  position text,
  tier_id uuid references public.auction_tiers(id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'on_block', 'sold', 'unsold')),
  queue_order int,
  sold_team_id uuid references public.teams(id) on delete set null,
  sold_price int check (sold_price >= 0),
  sold_at timestamptz,
  sold_via text check (sold_via in ('bid', 'auto_assign', 'manual')),
  created_at timestamptz not null default now(),
  unique (auction_id, rsvp_id)
);
create index if not exists auction_entries_auction_idx on public.auction_entries (auction_id, status);

do $$ begin
  alter table public.auctions add constraint auctions_current_entry_fk
    foreign key (current_entry_id) references public.auction_entries(id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists public.auction_bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  entry_id uuid not null references public.auction_entries(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  amount int not null check (amount >= 0),
  placed_by uuid references public.profiles(id) on delete set null,
  voided boolean not null default false,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists auction_bids_entry_idx on public.auction_bids (entry_id, amount desc);

create table if not exists public.auction_events (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  type text not null check (type in (
    'sold', 'unsold', 'auto_assign', 'manual_assign', 'undo', 'bid_retracted',
    'pause', 'resume', 'phase_change', 'skip', 'finalized'
  )),
  entry_id uuid references public.auction_entries(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  amount int,
  payload jsonb not null default '{}'::jsonb,
  undone boolean not null default false,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists auction_events_auction_idx on public.auction_events (auction_id, created_at desc);

-- Max-bid rule: a team must always keep base_price for every other open slot.
create or replace view public.auction_team_standings with (security_invoker = true) as
select
  at.team_id,
  at.auction_id,
  (a.budget + at.budget_adjustment)::int as total_budget,
  coalesce(sum(e.sold_price), 0)::int as spent,
  (a.budget + at.budget_adjustment - coalesce(sum(e.sold_price), 0))::int as remaining,
  (a.squad_size - count(e.id))::int as slots_left,
  (case
     when a.squad_size - count(e.id) <= 0 then 0
     else greatest(0, a.budget + at.budget_adjustment - coalesce(sum(e.sold_price), 0)
                      - (a.squad_size - count(e.id) - 1) * a.base_price)
   end)::int as max_bid
from public.auction_teams at
join public.auctions a on a.id = at.auction_id
left join public.auction_entries e on e.auction_id = at.auction_id and e.sold_team_id = at.team_id and e.status = 'sold'
group by at.team_id, at.auction_id, a.id;

alter table public.group_tiers enable row level security;
alter table public.group_player_tiers enable row level security;
alter table public.auctions enable row level security;
alter table public.auction_tiers enable row level security;
alter table public.auction_teams enable row level security;
alter table public.auction_entries enable row level security;
alter table public.auction_bids enable row level security;
alter table public.auction_events enable row level security;
revoke all on public.group_tiers, public.group_player_tiers, public.auctions, public.auction_tiers, public.auction_teams,
  public.auction_entries, public.auction_bids, public.auction_events, public.auction_team_standings
  from anon, authenticated;

-- Housekeeping from phase 1: TRUNCATE isn't reachable through the API, but clients have no business with it.
revoke truncate on all tables in schema public from anon, authenticated;

-- ─────────────── Engine (ported from KF Auction) ───────────────
-- Every public function locks the auction row first, so simultaneous bids/actions run one at a time.

create or replace function public._auction_lock(p_auction uuid)
returns public.auctions language plpgsql as $$
declare a public.auctions;
begin
  select * into a from public.auctions where id = p_auction for update;
  if not found then raise exception 'Auction not found'; end if;
  return a;
end $$;

create or replace function public._auction_entry_min_price(p_entry uuid)
returns int language sql stable as $$
  select coalesce(tr.base_price, a.base_price)
  from public.auction_entries e
  join public.auctions a on a.id = e.auction_id
  left join public.auction_tiers tr on tr.id = e.tier_id
  where e.id = p_entry;
$$;

create or replace function public._auction_top_bid(p_entry uuid)
returns public.auction_bids language sql stable as $$
  select * from public.auction_bids
  where entry_id = p_entry and not voided
  order by amount desc, created_at asc
  limit 1;
$$;

create or replace function public._auction_require_live(a public.auctions)
returns void language plpgsql as $$
begin
  if a.status = 'paused' then raise exception 'The auction is paused'; end if;
  if a.status <> 'live' then raise exception 'The auction is not running'; end if;
end $$;

create or replace function public._auction_log(
  p_auction uuid, p_type text, p_entry uuid default null, p_team uuid default null,
  p_amount int default null, p_payload jsonb default '{}'::jsonb
) returns void language sql as $$
  insert into public.auction_events (auction_id, type, entry_id, team_id, amount, payload)
  values (p_auction, p_type, p_entry, p_team, p_amount, coalesce(p_payload, '{}'::jsonb));
$$;

create or replace function public._auction_finish(p_auction uuid)
returns void language plpgsql as $$
begin
  update public.auction_entries set status = 'unsold'
  where auction_id = p_auction and status in ('queued', 'on_block');
  update public.auctions
  set status = 'done', phase = 'done', current_entry_id = null, call_state = 'none'
  where id = p_auction;
  perform public._auction_log(p_auction, 'phase_change', null, null, null, jsonb_build_object('phase', 'done'));
end $$;

-- ── "At least one player from every tier" rule ──
-- Returns null when team p_team may buy entry p_entry, otherwise the reason it may not:
--  • room:   every tier the team still lacks needs one of its open spots;
--  • supply: a team taking a second player from a tier must leave enough of that tier for the
--            teams that don't have one yet.
create or replace function public._auction_tier_problem(p_auction uuid, p_team uuid, p_entry uuid)
returns text language plpgsql stable as $$
declare
  a public.auctions;
  e public.auction_entries;
  v_slots int;
  v_missing text[];
  v_entry_missing boolean;
  v_available int;
  v_others_missing int;
  v_tier_name text;
begin
  select * into a from public.auctions where id = p_auction;
  select * into e from public.auction_entries where id = p_entry;
  if not a.require_each_tier or e.tier_id is null then return null; end if;

  select slots_left into v_slots from public.auction_team_standings where team_id = p_team and auction_id = p_auction;

  -- Tiers (that have players) this team has no player from yet.
  select coalesce(array_agg(tr.name order by tr.sort_order), '{}') into v_missing
  from public.auction_tiers tr
  where tr.auction_id = p_auction
    and exists (select 1 from public.auction_entries x where x.auction_id = p_auction and x.tier_id = tr.id)
    and not exists (
      select 1 from public.auction_entries x
      where x.auction_id = p_auction and x.tier_id = tr.id and x.status = 'sold' and x.sold_team_id = p_team
    );
  select name into v_tier_name from public.auction_tiers where id = e.tier_id;
  v_entry_missing := v_tier_name = any(v_missing);

  if not v_entry_missing and v_slots - 1 < coalesce(array_length(v_missing, 1), 0) then
    return format('Save your spots: you still need a player from %s', array_to_string(v_missing, ', '));
  end if;

  if not v_entry_missing then
    select count(*) into v_available from public.auction_entries x
    where x.auction_id = p_auction and x.tier_id = e.tier_id and x.id <> e.id and x.status in ('queued', 'on_block', 'unsold');
    select count(*) into v_others_missing
    from public.auction_team_standings ts
    where ts.auction_id = p_auction and ts.team_id <> p_team and ts.slots_left > 0
      and not exists (
        select 1 from public.auction_entries x
        where x.auction_id = p_auction and x.tier_id = e.tier_id and x.status = 'sold' and x.sold_team_id = ts.team_id
      );
    if v_available < v_others_missing then
      return format('Leave enough %s players for the teams that don''t have one yet', v_tier_name);
    end if;
  end if;
  return null;
end $$;

create or replace function public._auction_check_tier_rule(p_auction uuid, p_team uuid, p_entry uuid)
returns void language plpgsql as $$
declare v_problem text;
begin
  v_problem := public._auction_tier_problem(p_auction, p_team, p_entry);
  if v_problem is not null then raise exception '%', v_problem; end if;
end $$;

-- Leftovers go at base price to the team with the most open slots that can afford them
-- (teams that still need the player's tier first, and never breaking the tier rule).
create or replace function public._auction_auto_assign(p_auction uuid)
returns void language plpgsql as $$
declare
  e record;
  v_price int;
  v_team uuid;
begin
  for e in
    select en.id from public.auction_entries en
    left join public.auction_tiers tr on tr.id = en.tier_id
    where en.auction_id = p_auction and en.status in ('unsold', 'queued')
    order by tr.sort_order nulls last, en.queue_order nulls last, en.created_at
  loop
    v_price := public._auction_entry_min_price(e.id);
    select ts.team_id into v_team
    from public.auction_team_standings ts
    join public.auction_teams at on at.team_id = ts.team_id
    join public.teams t on t.id = ts.team_id
    where ts.auction_id = p_auction and ts.slots_left > 0 and ts.max_bid >= v_price
      and public._auction_tier_problem(p_auction, ts.team_id, e.id) is null
    order by
      (exists (
        select 1 from public.auction_entries x
        where x.auction_id = p_auction and x.status = 'sold' and x.sold_team_id = ts.team_id
          and x.tier_id = (select tier_id from public.auction_entries where id = e.id)
      )) asc,
      ts.slots_left desc, ts.remaining desc, at.sort_order, t.created_at
    limit 1;
    if v_team is null then continue; end if;
    update public.auction_entries
    set status = 'sold', sold_team_id = v_team, sold_price = v_price, sold_at = now(), sold_via = 'auto_assign'
    where id = e.id;
    perform public._auction_log(p_auction, 'auto_assign', e.id, v_team, v_price, '{"phase":"reauction"}'::jsonb);
  end loop;
  perform public._auction_finish(p_auction);
end $$;

create or replace function public._auction_put_next(p_auction uuid, p_entry uuid)
returns uuid language plpgsql as $$
declare
  a public.auctions;
  v_entry uuid;
begin
  select * into a from public.auctions where id = p_auction;

  if not exists (select 1 from public.auction_team_standings where auction_id = p_auction and slots_left > 0) then
    perform public._auction_finish(p_auction);
    return null;
  end if;

  if p_entry is not null then
    select id into v_entry from public.auction_entries
    where id = p_entry and auction_id = p_auction and status in ('queued', 'unsold');
    if v_entry is null then raise exception 'That player is not available'; end if;
  else
    select id into v_entry from public.auction_entries
    where auction_id = p_auction and status = 'queued'
    order by queue_order nulls last, created_at limit 1;

    if v_entry is null and a.phase = 'main'
       and exists (select 1 from public.auction_entries where auction_id = p_auction and status = 'unsold') then
      update public.auction_entries en set status = 'queued', queue_order = q.rn
      from (
        select en2.id, row_number() over (order by tr.sort_order nulls last, en2.queue_order nulls last) as rn
        from public.auction_entries en2
        left join public.auction_tiers tr on tr.id = en2.tier_id
        where en2.auction_id = p_auction and en2.status = 'unsold'
      ) q
      where en.id = q.id;
      update public.auctions set phase = 'reauction' where id = p_auction;
      perform public._auction_log(p_auction, 'phase_change', null, null, null, '{"phase":"reauction"}'::jsonb);

      select id into v_entry from public.auction_entries
      where auction_id = p_auction and status = 'queued'
      order by queue_order limit 1;
    end if;

    if v_entry is null then
      perform public._auction_auto_assign(p_auction);
      return null;
    end if;
  end if;

  update public.auction_entries set status = 'on_block' where id = v_entry;
  update public.auctions set current_entry_id = v_entry, call_state = 'none' where id = p_auction;
  return v_entry;
end $$;

create or replace function public.auction_start(p_auction uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  a public.auctions;
  v_conflict text;
begin
  a := public._auction_lock(p_auction);
  if a.status <> 'draft' then raise exception 'The auction has already started'; end if;
  if (select count(*) from public.auction_teams where auction_id = p_auction) < 2 then
    raise exception 'Add at least two teams first';
  end if;
  if not exists (select 1 from public.auction_entries where auction_id = p_auction) then
    raise exception 'Add players to the pool first';
  end if;
  select e.display_name into v_conflict
  from public.auction_entries e
  join public.auction_teams at on at.auction_id = e.auction_id
  join public.teams t on t.id = at.team_id and t.captain_id = e.player_id
  where e.auction_id = p_auction limit 1;
  if v_conflict is not null then
    raise exception '% is a captain and also in the player pool', v_conflict;
  end if;
  if a.require_each_tier then
    select tr.name into v_conflict
    from public.auction_tiers tr
    where tr.auction_id = p_auction
      and (select count(*) from public.auction_entries x where x.auction_id = p_auction and x.tier_id = tr.id)
          between 1 and (select count(*) - 1 from public.auction_teams where auction_id = p_auction)
    limit 1;
    if v_conflict is not null then
      raise exception 'Tier % has fewer players than there are teams — move players into it or switch off the one-per-tier rule', v_conflict;
    end if;
    if (select count(distinct tier_id) from public.auction_entries where auction_id = p_auction and tier_id is not null) > a.squad_size then
      raise exception 'There are more tiers than players per team — the one-per-tier rule can''t be met';
    end if;
  end if;

  -- Tier by tier, shuffled within each tier.
  update public.auction_entries en
  set status = 'queued', queue_order = q.rn, sold_team_id = null, sold_price = null, sold_at = null, sold_via = null
  from (
    select en2.id, row_number() over (order by tr.sort_order nulls last, random()) as rn
    from public.auction_entries en2
    left join public.auction_tiers tr on tr.id = en2.tier_id
    where en2.auction_id = p_auction
  ) q
  where en.id = q.id;

  update public.auctions set status = 'live', phase = 'main', call_state = 'none' where id = p_auction;
  perform public._auction_log(p_auction, 'phase_change', null, null, null, '{"phase":"main"}'::jsonb);
  return public._auction_put_next(p_auction, null);
end $$;

create or replace function public.auction_place_bid(p_auction uuid, p_team uuid, p_entry uuid, p_amount int, p_placed_by uuid)
returns public.auction_bids language plpgsql security definer set search_path = public as $$
declare
  a public.auctions;
  e public.auction_entries;
  top public.auction_bids;
  st public.auction_team_standings;
  v_min int;
  v_bid public.auction_bids;
begin
  a := public._auction_lock(p_auction);
  perform public._auction_require_live(a);
  if a.current_entry_id is distinct from p_entry then
    raise exception 'This player is no longer up for bidding';
  end if;
  select * into e from public.auction_entries where id = p_entry;
  if e.status <> 'on_block' then raise exception 'Bidding for this player has closed'; end if;

  select * into st from public.auction_team_standings where team_id = p_team and auction_id = p_auction;
  if not found then raise exception 'Team is not in this auction'; end if;

  v_min := public._auction_entry_min_price(p_entry);
  top := public._auction_top_bid(p_entry);

  if top.id is not null then
    if top.team_id = p_team then raise exception 'You are already the highest bidder'; end if;
    if p_amount < top.amount + a.bid_increment then
      raise exception 'Bid must be at least %', top.amount + a.bid_increment;
    end if;
  elsif p_amount < v_min then
    raise exception 'Opening bid must be at least %', v_min;
  end if;
  if (p_amount - v_min) % a.bid_increment <> 0 then
    raise exception 'Bids go up in steps of %', a.bid_increment;
  end if;
  if st.slots_left <= 0 then raise exception 'Your squad is already full'; end if;
  if p_amount > st.max_bid then
    raise exception 'Your max bid is % (you must keep % for each of your other % open spots)',
      st.max_bid, a.base_price, st.slots_left - 1;
  end if;
  perform public._auction_check_tier_rule(p_auction, p_team, p_entry);

  insert into public.auction_bids (auction_id, entry_id, team_id, amount, placed_by)
  values (p_auction, p_entry, p_team, p_amount, p_placed_by)
  returning * into v_bid;
  if a.call_state <> 'none' then
    update public.auctions set call_state = 'none' where id = p_auction;
  end if;
  return v_bid;
end $$;

create or replace function public.auction_mark_sold(p_auction uuid)
returns public.auction_entries language plpgsql security definer set search_path = public as $$
declare
  a public.auctions;
  e public.auction_entries;
  top public.auction_bids;
  st public.auction_team_standings;
begin
  a := public._auction_lock(p_auction);
  perform public._auction_require_live(a);
  select * into e from public.auction_entries where id = a.current_entry_id;
  if e.id is null or e.status <> 'on_block' then raise exception 'No player is up for bidding'; end if;
  top := public._auction_top_bid(e.id);
  if top.id is null then raise exception 'No bids yet — mark UNSOLD instead'; end if;
  select * into st from public.auction_team_standings where team_id = top.team_id and auction_id = p_auction;
  if st.slots_left <= 0 or top.amount > st.max_bid
     or public._auction_tier_problem(p_auction, top.team_id, e.id) is not null then
    raise exception 'The highest bid is no longer valid for that team — retract it first';
  end if;

  update public.auction_entries
  set status = 'sold', sold_team_id = top.team_id, sold_price = top.amount, sold_at = now(), sold_via = 'bid'
  where id = e.id returning * into e;
  update public.auctions set call_state = 'none' where id = p_auction;
  perform public._auction_log(p_auction, 'sold', e.id, top.team_id, top.amount, jsonb_build_object('phase', a.phase));
  return e;
end $$;

create or replace function public.auction_mark_unsold(p_auction uuid)
returns public.auction_entries language plpgsql security definer set search_path = public as $$
declare
  a public.auctions;
  e public.auction_entries;
begin
  a := public._auction_lock(p_auction);
  perform public._auction_require_live(a);
  select * into e from public.auction_entries where id = a.current_entry_id;
  if e.id is null or e.status <> 'on_block' then raise exception 'No player is up for bidding'; end if;
  if (public._auction_top_bid(e.id)).id is not null then
    raise exception 'This player has bids — mark SOLD or retract the bids first';
  end if;
  update public.auction_entries set status = 'unsold' where id = e.id returning * into e;
  update public.auctions set call_state = 'none' where id = p_auction;
  perform public._auction_log(p_auction, 'unsold', e.id, null, null, jsonb_build_object('phase', a.phase));
  return e;
end $$;

create or replace function public.auction_next_player(p_auction uuid, p_entry uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  a public.auctions;
  e public.auction_entries;
begin
  a := public._auction_lock(p_auction);
  perform public._auction_require_live(a);
  select * into e from public.auction_entries where id = a.current_entry_id;
  if e.id is not null and e.status = 'on_block' then
    if (public._auction_top_bid(e.id)).id is not null then
      raise exception 'Mark the current player SOLD or UNSOLD first';
    end if;
    update public.auction_entries set status = 'queued' where id = e.id;
  end if;
  update public.auctions set current_entry_id = null where id = p_auction;
  return public._auction_put_next(p_auction, p_entry);
end $$;

create or replace function public.auction_skip_player(p_auction uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  a public.auctions;
  e public.auction_entries;
begin
  a := public._auction_lock(p_auction);
  perform public._auction_require_live(a);
  select * into e from public.auction_entries where id = a.current_entry_id;
  if e.id is null or e.status <> 'on_block' then raise exception 'No player is up for bidding'; end if;
  if (public._auction_top_bid(e.id)).id is not null then raise exception 'This player has bids — cannot skip'; end if;
  update public.auction_entries
  set status = 'queued',
      queue_order = (select coalesce(max(queue_order), 0) + 1 from public.auction_entries where auction_id = p_auction)
  where id = e.id;
  update public.auctions set current_entry_id = null where id = p_auction;
  perform public._auction_log(p_auction, 'skip', e.id);
  return public._auction_put_next(p_auction, null);
end $$;

create or replace function public.auction_undo_last(p_auction uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  a public.auctions;
  ev public.auction_events;
  cur public.auction_entries;
begin
  a := public._auction_lock(p_auction);
  if a.finalized_at is not null then raise exception 'The teams are already final'; end if;
  if a.status not in ('live', 'paused', 'done') then raise exception 'Nothing to undo'; end if;
  select * into ev from public.auction_events
  where auction_id = p_auction and type in ('sold', 'unsold', 'auto_assign') and not undone
  order by created_at desc limit 1;
  if ev.id is null or ev.entry_id is null then raise exception 'Nothing to undo'; end if;

  select * into cur from public.auction_entries where id = a.current_entry_id;
  if cur.id is not null and cur.status = 'on_block' and cur.id <> ev.entry_id then
    if (public._auction_top_bid(cur.id)).id is not null then
      raise exception 'Resolve the current player first';
    end if;
    update public.auction_entries set status = 'queued' where id = cur.id;
  end if;

  update public.auction_entries
  set status = 'on_block', sold_team_id = null, sold_price = null, sold_at = null, sold_via = null
  where id = ev.entry_id;
  update public.auction_events set undone = true where id = ev.id;
  update public.auctions
  set current_entry_id = ev.entry_id, call_state = 'none',
      status = case when status = 'done' then 'live' else status end,
      phase = coalesce(ev.payload->>'phase', phase)
  where id = p_auction;
  perform public._auction_log(p_auction, 'undo', ev.entry_id, ev.team_id, ev.amount, jsonb_build_object('undid', ev.type));
  return ev.entry_id;
end $$;

create or replace function public.auction_retract_last_bid(p_auction uuid)
returns public.auction_bids language plpgsql security definer set search_path = public as $$
declare
  a public.auctions;
  b public.auction_bids;
begin
  a := public._auction_lock(p_auction);
  if a.current_entry_id is null then raise exception 'No player is up for bidding'; end if;
  if (select status from public.auction_entries where id = a.current_entry_id) <> 'on_block' then
    raise exception 'Bidding for this player has closed';
  end if;
  select * into b from public.auction_bids
  where entry_id = a.current_entry_id and not voided
  order by created_at desc limit 1;
  if b.id is null then raise exception 'There are no bids to retract'; end if;
  update public.auction_bids set voided = true where id = b.id returning * into b;
  update public.auctions set call_state = 'none' where id = p_auction;
  perform public._auction_log(p_auction, 'bid_retracted', b.entry_id, b.team_id, b.amount);
  return b;
end $$;

create or replace function public.auction_set_call_state(p_auction uuid, p_state text)
returns void language plpgsql security definer set search_path = public as $$
declare a public.auctions;
begin
  a := public._auction_lock(p_auction);
  perform public._auction_require_live(a);
  if p_state not in ('none', 'once', 'twice') then raise exception 'Invalid call state'; end if;
  update public.auctions set call_state = p_state where id = p_auction;
end $$;

create or replace function public.auction_set_paused(p_auction uuid, p_paused boolean)
returns void language plpgsql security definer set search_path = public as $$
declare a public.auctions;
begin
  a := public._auction_lock(p_auction);
  if p_paused and a.status = 'live' then
    update public.auctions set status = 'paused' where id = p_auction;
    perform public._auction_log(p_auction, 'pause');
  elsif not p_paused and a.status = 'paused' then
    update public.auctions set status = 'live' where id = p_auction;
    perform public._auction_log(p_auction, 'resume');
  else
    raise exception 'The auction is not %', case when p_paused then 'running' else 'paused' end;
  end if;
end $$;

-- Organiser override: put a player in a team at a price, move them, or (p_team null) release them.
create or replace function public.auction_manual_assign(p_auction uuid, p_entry uuid, p_team uuid, p_price int)
returns public.auction_entries language plpgsql security definer set search_path = public as $$
declare
  a public.auctions;
  e public.auction_entries;
  st public.auction_team_standings;
  v_slots int;
  v_remaining int;
begin
  a := public._auction_lock(p_auction);
  if a.status = 'draft' then raise exception 'Start the auction first'; end if;
  if a.finalized_at is not null then raise exception 'The teams are already final'; end if;
  select * into e from public.auction_entries where id = p_entry and auction_id = p_auction;
  if e.id is null then raise exception 'Player is not in this auction'; end if;
  if e.status = 'on_block' and (public._auction_top_bid(e.id)).id is not null then
    raise exception 'This player has live bids — mark SOLD or retract them first';
  end if;

  if p_team is null then
    update public.auction_entries
    set status = 'unsold', sold_team_id = null, sold_price = null, sold_at = null, sold_via = null
    where id = e.id returning * into e;
  else
    if p_price is null or p_price < 0 then raise exception 'Enter a price'; end if;
    select * into st from public.auction_team_standings where team_id = p_team and auction_id = p_auction;
    if st.team_id is null then raise exception 'Team is not in this auction'; end if;
    v_slots := st.slots_left + case when e.status = 'sold' and e.sold_team_id = p_team then 1 else 0 end;
    v_remaining := st.remaining + case when e.status = 'sold' and e.sold_team_id = p_team then e.sold_price else 0 end;
    if v_slots <= 0 then raise exception 'That team''s squad is full'; end if;
    if p_price > v_remaining then raise exception 'That team only has % left', v_remaining; end if;
    if not (e.status = 'sold' and e.sold_team_id = p_team) then
      perform public._auction_check_tier_rule(p_auction, p_team, e.id);
    end if;
    update public.auction_entries
    set status = 'sold', sold_team_id = p_team, sold_price = p_price, sold_at = now(), sold_via = 'manual'
    where id = e.id returning * into e;
  end if;

  if a.current_entry_id = e.id then
    update public.auctions set current_entry_id = null, call_state = 'none' where id = p_auction;
  end if;
  perform public._auction_log(p_auction, 'manual_assign', e.id, p_team, p_price);
  return e;
end $$;

-- Back to setup: clears every sale and bid.
create or replace function public.auction_reset(p_auction uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a public.auctions;
begin
  a := public._auction_lock(p_auction);
  if a.finalized_at is not null then raise exception 'The teams are already final'; end if;
  update public.auctions
  set status = 'draft', phase = 'main', current_entry_id = null, call_state = 'none'
  where id = p_auction;
  delete from public.auction_bids where auction_id = p_auction;
  delete from public.auction_events where auction_id = p_auction;
  update public.auction_entries
  set status = 'queued', queue_order = null, sold_team_id = null, sold_price = null, sold_at = null, sold_via = null
  where auction_id = p_auction;
end $$;

-- Writes the final squads into the matchday's teams, in one transaction, then locks the auction.
-- Captains and sold registered players → team_players; sold guests → teams.guest_members (bare RSVP ids,
-- the format saveTeamsAction uses).
create or replace function public.auction_finalize(p_auction uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  a public.auctions;
  t record;
  v_guests jsonb;
begin
  a := public._auction_lock(p_auction);
  if a.finalized_at is not null then raise exception 'The teams are already final'; end if;
  if a.status <> 'done' then raise exception 'Finish the auction first'; end if;

  for t in
    select tm.id, tm.captain_id, tm.guest_members from public.auction_teams at
    join public.teams tm on tm.id = at.team_id
    where at.auction_id = p_auction
  loop
    insert into public.team_players (team_id, player_id)
    select t.id, p from (
      select t.captain_id as p where t.captain_id is not null
      union
      select e.player_id from public.auction_entries e
      where e.auction_id = p_auction and e.sold_team_id = t.id and e.status = 'sold' and e.player_id is not null
    ) s
    on conflict (team_id, player_id) do nothing;

    select coalesce(jsonb_agg(distinct x), '[]'::jsonb) into v_guests from (
      select jsonb_array_elements_text(coalesce(t.guest_members, '[]'::jsonb)) as x
      union
      select e.rsvp_id::text from public.auction_entries e
      where e.auction_id = p_auction and e.sold_team_id = t.id and e.status = 'sold' and e.player_id is null
    ) g;
    update public.teams set guest_members = case when jsonb_array_length(v_guests) > 0 then v_guests else null end
    where id = t.id;
  end loop;

  update public.auctions set finalized_at = now() where id = p_auction;
  perform public._auction_log(p_auction, 'finalized');
end $$;

-- Engine functions are callable by the service role only.
do $$
declare f text;
begin
  foreach f in array array[
    'auction_start(uuid)', 'auction_place_bid(uuid,uuid,uuid,int,uuid)', 'auction_mark_sold(uuid)',
    'auction_mark_unsold(uuid)', 'auction_next_player(uuid,uuid)', 'auction_skip_player(uuid)',
    'auction_undo_last(uuid)', 'auction_retract_last_bid(uuid)', 'auction_set_call_state(uuid,text)',
    'auction_set_paused(uuid,boolean)', 'auction_manual_assign(uuid,uuid,uuid,int)', 'auction_reset(uuid)',
    'auction_finalize(uuid)',
    '_auction_lock(uuid)', '_auction_entry_min_price(uuid)', '_auction_top_bid(uuid)',
    '_auction_require_live(auctions)', '_auction_log(uuid,text,uuid,uuid,int,jsonb)', '_auction_finish(uuid)',
    '_auction_auto_assign(uuid)', '_auction_put_next(uuid,uuid)',
    '_auction_tier_problem(uuid,uuid,uuid)', '_auction_check_tier_rule(uuid,uuid,uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
