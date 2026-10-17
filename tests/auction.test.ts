import { beforeEach, describe, expect, it } from 'vitest'
import { V12_TEAMS, v12Sale } from './fixtures/v12'
import { createTestDb, errorOf, type TestDb } from './db'
import { currentEntry, seedV12Matchday, standings } from './auctionFixtures'

let db: TestDb
let ids: Awaited<ReturnType<typeof seedV12Matchday>>

beforeEach(async () => {
  db = await createTestDb()
  ids = await seedV12Matchday(db)
})

const call = (fn: string) => db.query(`select public.${fn}($1)`, [ids.auctionId])
const bid = (team: string, entry: string, amount: number) =>
  db.query(`select public.auction_place_bid($1, $2, $3, $4, $5)`, [ids.auctionId, ids.teamIds[team], entry, amount, ids.admin])
const bidError = (team: string, entry: string, amount: number) => errorOf(() => bid(team, entry, amount))

const [SYN, ROY] = V12_TEAMS.map((t) => t.name)

async function replayV12() {
  // The real V12 sales happened in a different order, so don't apply the one-per-tier rule to the replay.
  await db.query(`update public.auctions set require_each_tier = false where id = $1`, [ids.auctionId])
  await call('auction_start')
  const order: string[] = []
  for (let guard = 0; guard < 100; guard++) {
    const cur = await currentEntry(db, ids.auctionId)
    if (cur.status === 'done') break
    order.push(cur.tier!)
    const sale = v12Sale(cur.player!)!
    for (const rival of V12_TEAMS.map((t) => t.name).filter((n) => n !== sale.team)) {
      if (sale.price - 25 >= 50 && (await bidError(rival, cur.entry_id!, sale.price - 25)) === null) break
    }
    await bid(sale.team, cur.entry_id!, sale.price)
    await call('auction_mark_sold')
    await call('auction_next_player')
  }
  return order
}

describe('V12 replay as a kickoff matchday', () => {
  it('reproduces the spreadsheet totals and writes the squads into the matchday teams', async () => {
    const order = await replayV12()
    expect(order).toHaveLength(32)
    const rank: Record<string, number> = { Apex: 0, Prestige: 1, Dominion: 2 }
    expect(order.map((t) => rank[t])).toEqual([...order.map((t) => rank[t])].sort((a, b) => a - b))

    const s = await standings(db, ids.auctionId)
    expect(s.map((r) => [r.name, r.spent, r.remaining, r.slots_left])).toEqual(V12_TEAMS.map((t) => [t.name, t.spent, t.remaining, 0]))

    await call('auction_finalize')

    for (const team of V12_TEAMS) {
      const teamId = ids.teamIds[team.name]
      const players = (await db.query<{ player_id: string }>(`select player_id from public.team_players where team_id = $1`, [teamId])).rows
      const { guest_members } = (await db.query<{ guest_members: string[] | null }>(`select guest_members from public.teams where id = $1`, [teamId])).rows[0]
      const squad = Object.keys(team.squad)
      const expectedRegistered = [team.captain, ...squad].map((n) => ids.playerIds[n]).filter(Boolean)
      const expectedGuests = squad.filter((n) => !ids.playerIds[n]).map((n) => ids.rsvpIds[n])
      expect(players.map((p) => p.player_id).sort()).toEqual([...expectedRegistered].sort())
      expect([...(guest_members ?? [])].sort()).toEqual([...expectedGuests].sort())
    }

    expect(await errorOf(() => call('auction_undo_last'))).toMatch(/already final/)
    expect(await errorOf(() => call('auction_finalize'))).toMatch(/already final/)
  })
})

describe('bidding rules', () => {
  beforeEach(async () => {
    await call('auction_start')
  })

  it('rejects bad bids with clear messages', async () => {
    const { entry_id } = await currentEntry(db, ids.auctionId)
    expect(await bidError(SYN, entry_id!, 25)).toMatch(/Opening bid must be at least 50/)
    await bid(SYN, entry_id!, 100)
    expect(await bidError(SYN, entry_id!, 200)).toMatch(/already the highest bidder/)
    expect(await bidError(ROY, entry_id!, 110)).toMatch(/at least 125/)
    expect(await bidError(ROY, entry_id!, 130)).toMatch(/steps of 25/)
    expect(await bidError(ROY, entry_id!, 7675)).toMatch(/max bid is 7650/)
    expect(await bidError(ROY, entry_id!, 7650)).toBeNull()
  })

  it('records who placed a bid (admin bidding for a captain)', async () => {
    const { entry_id } = await currentEntry(db, ids.auctionId)
    await bid(SYN, entry_id!, 100)
    const r = (await db.query<{ placed_by: string }>(`select placed_by from public.auction_bids where entry_id = $1`, [entry_id])).rows[0]
    expect(r.placed_by).toBe(ids.admin)
  })

  it('undo and retract work before the auction is final', async () => {
    const { entry_id } = await currentEntry(db, ids.auctionId)
    await bid(SYN, entry_id!, 100)
    await bid(ROY, entry_id!, 300)
    await call('auction_retract_last_bid')
    await call('auction_mark_sold')
    await call('auction_next_player')
    await call('auction_undo_last')
    expect((await currentEntry(db, ids.auctionId)).entry_id).toBe(entry_id)
  })

  it('cannot finalize before the auction is done', async () => {
    expect(await errorOf(() => call('auction_finalize'))).toMatch(/Finish the auction first/)
  })
})

describe('re-auction and auto-assign', () => {
  it('gives leftovers to the teams with open spots at base price', async () => {
    await call('auction_start')
    for (let i = 0; i < 32; i++) {
      await call('auction_mark_unsold')
      await call('auction_next_player')
    }
    let cur = await currentEntry(db, ids.auctionId)
    expect(cur.phase).toBe('reauction')
    await bid(SYN, cur.entry_id!, 500)
    await call('auction_mark_sold')
    await call('auction_next_player')
    for (let i = 0; i < 31; i++) {
      await call('auction_mark_unsold')
      await call('auction_next_player')
    }
    cur = await currentEntry(db, ids.auctionId)
    expect(cur.status).toBe('done')
    const s = await standings(db, ids.auctionId)
    expect(s.every((r) => r.slots_left === 0)).toBe(true)
    expect(s[0].spent).toBe(500 + 7 * 50)
  })
})

describe('safety', () => {
  it('a captain in the pool blocks the start', async () => {
    const rafi = ids.rsvpIds['Rafi']
    await db.query(
      `insert into public.auction_entries (auction_id, rsvp_id, player_id, display_name) values ($1, $2, $3, 'Rafi')`,
      [ids.auctionId, rafi, ids.playerIds['Rafi']],
    )
    expect(await errorOf(() => call('auction_start'))).toMatch(/Rafi is a captain/)
  })

  it('auction tables and functions are closed to clients', async () => {
    await db.exec(`set role authenticated`)
    const readErr = await errorOf(() => db.query(`select * from public.auctions`))
    const callErr = await errorOf(() => db.query(`select public.auction_start($1)`, [ids.auctionId]))
    await db.exec(`reset role`)
    expect(readErr).toMatch(/permission denied/)
    expect(callErr).toMatch(/permission denied/)
  })
})

describe('one player from every tier', () => {
  const entryOf = async (name: string) =>
    (await db.query<{ id: string }>(`select id from public.auction_entries where auction_id = $1 and display_name = $2`, [ids.auctionId, name])).rows[0].id
  const assign = (name: string, team: string, price = 50) =>
    entryOf(name).then((id) => db.query(`select public.auction_manual_assign($1, $2, $3, $4)`, [ids.auctionId, id, ids.teamIds[team], price]))
  const assignError = (name: string, team: string) => errorOf(() => assign(name, team))
  const [, , RMA, MOB] = V12_TEAMS.map((t) => t.name)

  beforeEach(async () => {
    await call('auction_start')
  })

  it('a team must keep spots for the tiers it still lacks', async () => {
    for (const n of ['Anam', 'Anan', 'Faruk', 'Jawad', 'JH Sajid', 'Labib']) await assign(n, SYN)
    // 6 Apex, 2 spots left, still missing Prestige and Dominion → no 7th Apex.
    expect(await assignError('Muaz', SYN)).toMatch(/Save your spots: you still need a player from Prestige, Dominion/)
    expect(await assignError('Afif', SYN)).toBeNull()
  })

  it('a team taking extra players from a tier must leave one for each team without one', async () => {
    for (const n of ['Anam', 'Anan', 'Faruk']) await assign(n, SYN)
    for (const n of ['Jawad', 'JH Sajid', 'Labib']) await assign(n, ROY)
    for (const n of ['Muaz', 'Ratul', 'Smit']) await assign(n, RMA)
    // 3 Apex left (Sojib, Tamal, Xibon) and The Mob has none.
    expect(await assignError('Sojib', RMA)).toBeNull()
    expect(await assignError('Tamal', SYN)).toBeNull()
    expect(await assignError('Xibon', ROY)).toMatch(/Leave enough Apex players/)
    expect(await assignError('Xibon', MOB)).toBeNull()
  })

  it('bids are checked too', async () => {
    const cur = await currentEntry(db, ids.auctionId)
    expect(cur.tier).toBe('Apex')
    for (const n of ['Anam', 'Anan', 'Faruk', 'Jawad', 'JH Sajid', 'Labib', 'Muaz', 'Ratul', 'Smit', 'Sojib', 'Tamal', 'Xibon'].filter((n) => n !== cur.player).slice(0, 6))
      await assign(n, SYN)
    expect(await bidError(SYN, cur.entry_id!, 100)).toMatch(/Save your spots/)
  })
})

describe('tier rule at start', () => {
  it('blocks the start when a tier has fewer players than teams', async () => {
    await db.query(
      `update public.auction_entries set tier_id = null where auction_id = $1 and display_name in ('Afif','Alamin','Mehedi','Ruhit','Sajid')`,
      [ids.auctionId],
    )
    expect(await errorOf(() => call('auction_start'))).toMatch(/Tier Prestige has fewer players than there are teams/)
    await db.query(`update public.auctions set require_each_tier = false where id = $1`, [ids.auctionId])
    expect(await errorOf(() => call('auction_start'))).toBeNull()
  })

  it('auto-assign gives leftovers to teams that still need that tier', async () => {
    await call('auction_start')
    for (let i = 0; i < 64; i++) {
      const cur = await currentEntry(db, ids.auctionId)
      if (cur.status === 'done') break
      await call('auction_mark_unsold')
      await call('auction_next_player')
    }
    const r = await db.query<{ team: string; tiers: number }>(
      `select e.sold_team_id as team, count(distinct e.tier_id)::int as tiers from public.auction_entries e
       where e.auction_id = $1 and e.status = 'sold' group by 1`,
      [ids.auctionId],
    )
    expect(r.rows).toHaveLength(4)
    expect(r.rows.every((x) => x.tiers === 3)).toBe(true)
  })
})
