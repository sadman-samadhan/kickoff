import { V12_POOL, V12_RULES, V12_TEAMS, V12_TIERS } from './fixtures/v12'
import type { TestDb } from './db'

const one = async <T>(db: TestDb, sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]

async function makeUser(db: TestDb, name: string) {
  const u = await one<{ id: string }>(db, `insert into auth.users (email) values ($1) returning id`, [
    `${name.toLowerCase().replace(/\W+/g, '.')}@test.local`,
  ])
  await db.query(
    `insert into public.profiles (id, full_name, email) values ($1, $2, $3)
     on conflict (id) do update set full_name = excluded.full_name`,
    [u.id, name, `${name}@test.local`],
  )
  return u.id
}

/**
 * The V12 tournament as a kickoff matchday: captains and the 12 Apex players are registered members,
 * everyone else is a guest RSVP (player_id null) — like a real matchday with guests.
 */
export async function seedV12Matchday(db: TestDb) {
  const admin = await makeUser(db, 'Organiser')
  const group = await one<{ id: string }>(db, `insert into public.groups (name, created_by) values ('KF Futsal', $1) returning id`, [admin])
  await db.query(`insert into public.group_members (group_id, player_id, role) values ($1, $2, 'admin')`, [group.id, admin])
  const booking = await one<{ id: string }>(
    db,
    `insert into public.bookings (group_id, created_by, match_date, match_time, field_name, max_players)
     values ($1, $2, '2026-10-17', '20:00', 'Khulna Turf', 40) returning id`,
    [group.id, admin],
  )

  const registered = new Set([...V12_TEAMS.map((t) => t.captain), ...V12_POOL.Apex])
  const rsvpIds: Record<string, string> = {}
  const playerIds: Record<string, string | null> = {}
  for (const name of [...V12_TEAMS.map((t) => t.captain), ...Object.values(V12_POOL).flat()]) {
    let playerId: string | null = null
    if (registered.has(name)) {
      playerId = await makeUser(db, name)
      await db.query(`insert into public.group_members (group_id, player_id, role) values ($1, $2, 'member')`, [group.id, playerId])
    }
    const r = await one<{ id: string }>(
      db,
      `insert into public.rsvps (booking_id, player_id, status, guest_name) values ($1, $2, 'in', $3) returning id`,
      [booking.id, playerId, playerId ? null : name],
    )
    rsvpIds[name] = r.id
    playerIds[name] = playerId
  }

  const auction = await one<{ id: string }>(
    db,
    `insert into public.auctions (booking_id, group_id, budget, squad_size, bid_increment, base_price, created_by)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [booking.id, group.id, V12_RULES.budget, V12_RULES.squadSize, V12_RULES.bidIncrement, V12_RULES.basePrice, admin],
  )

  const teamIds: Record<string, string> = {}
  for (let i = 0; i < V12_TEAMS.length; i++) {
    const t = V12_TEAMS[i]
    const team = await one<{ id: string }>(
      db,
      `insert into public.teams (booking_id, name, jersey_color, captain_id) values ($1, $2, $3, $4) returning id`,
      [booking.id, t.name, t.color, playerIds[t.captain]],
    )
    await db.query(`insert into public.auction_teams (team_id, auction_id, sort_order) values ($1, $2, $3)`, [team.id, auction.id, i])
    teamIds[t.name] = team.id
  }

  const tierIds: Record<string, string> = {}
  for (let i = 0; i < V12_TIERS.length; i++) {
    const tier = V12_TIERS[i]
    const t = await one<{ id: string }>(
      db,
      `insert into public.auction_tiers (auction_id, name, sort_order, color) values ($1, $2, $3, $4) returning id`,
      [auction.id, tier.name, i, tier.color],
    )
    tierIds[tier.name] = t.id
  }

  for (const [tier, names] of Object.entries(V12_POOL)) {
    for (const name of names) {
      await db.query(
        `insert into public.auction_entries (auction_id, rsvp_id, player_id, display_name, tier_id) values ($1, $2, $3, $4, $5)`,
        [auction.id, rsvpIds[name], playerIds[name], name, tierIds[tier]],
      )
    }
  }

  return { admin, groupId: group.id, bookingId: booking.id, auctionId: auction.id, teamIds, tierIds, rsvpIds, playerIds }
}

export async function currentEntry(db: TestDb, auctionId: string) {
  return one<{ entry_id: string | null; status: string; phase: string; player: string | null; tier: string | null }>(
    db,
    `select a.current_entry_id as entry_id, a.status, a.phase, e.display_name as player, tr.name as tier
     from public.auctions a
     left join public.auction_entries e on e.id = a.current_entry_id
     left join public.auction_tiers tr on tr.id = e.tier_id
     where a.id = $1`,
    [auctionId],
  )
}

export async function standings(db: TestDb, auctionId: string) {
  return (
    await db.query<{ name: string; spent: number; remaining: number; slots_left: number; max_bid: number }>(
      `select t.name, s.spent, s.remaining, s.slots_left, s.max_bid
       from public.auction_team_standings s
       join public.teams t on t.id = s.team_id
       join public.auction_teams at on at.team_id = s.team_id
       where s.auction_id = $1 order by at.sort_order`,
      [auctionId],
    )
  ).rows
}
