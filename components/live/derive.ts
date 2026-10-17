import type { LiveEvent, LiveMatchState, LivePlayer } from '@/lib/live/types'

/** The player key ("profile id" or "guest_…") an event is about, and its second player (assist / sub on). */
export const keyOf = (e: Pick<LiveEvent, 'player_id' | 'details_json'>) => e.player_id || e.details_json?.guest_player_id || null
export const secondKeyOf = (e: Pick<LiveEvent, 'secondary_player_id' | 'details_json'>) =>
  e.secondary_player_id || e.details_json?.guest_secondary_player_id || null

export const isOwnGoal = (e: LiveEvent) => e.event_type === 'goal' && e.details_json?.is_own_goal === true

/** Which side a goal counts for. */
export function goalFor(e: LiveEvent, homeId: string | undefined): 'home' | 'away' {
  const byHome = e.team_id === homeId
  return byHome !== isOwnGoal(e) ? 'home' : 'away'
}

/**
 * Score shown on screen. Normally counted from the events (so optimistic goals show instantly); very old
 * matches whose goals were never logged as events keep their stored score.
 */
export function scoreOf(state: LiveMatchState, events: LiveEvent[]) {
  const goals = events.filter((e) => e.event_type === 'goal')
  if (goals.length === 0) return { home: state.match.home_score, away: state.match.away_score }
  let home = 0
  let away = 0
  for (const g of goals) {
    if (goalFor(g, state.home?.id) === 'home') home++
    else away++
  }
  return { home, away }
}

export type Tally = { goals: number; assists: number; ownGoals: number; yellow: number; red: number; saves: number; subbedOff: boolean }

export function tallies(events: LiveEvent[]) {
  const t = new Map<string, Tally>()
  const get = (k: string) => {
    if (!t.has(k)) t.set(k, { goals: 0, assists: 0, ownGoals: 0, yellow: 0, red: 0, saves: 0, subbedOff: false })
    return t.get(k)!
  }
  for (const e of events) {
    const k = keyOf(e)
    const k2 = secondKeyOf(e)
    if (e.event_type === 'goal') {
      if (k) get(k)[isOwnGoal(e) ? 'ownGoals' : 'goals']++
      if (k2 && !isOwnGoal(e)) get(k2).assists++
    } else if (e.event_type === 'card' && k) {
      get(k)[e.details_json?.card_type === 'red' ? 'red' : 'yellow']++
    } else if (e.event_type === 'penalty_save' && k) {
      get(k).saves++
    }
  }
  // Currently off the pitch after subs (in order of minute, then time logged).
  for (const e of [...events].filter((x) => x.event_type === 'sub').sort(byMinute)) {
    const off = keyOf(e)
    const on = secondKeyOf(e)
    if (off) get(off).subbedOff = true
    if (on) get(on).subbedOff = false
  }
  return t
}

export const byMinute = (a: LiveEvent, b: LiveEvent) => a.minute - b.minute || a.created_at.localeCompare(b.created_at)

/** Who is on the pitch right now for one team, given the starting lineup and subs so far. */
export function onPitch(players: LivePlayer[], starters: string[] | null, events: LiveEvent[]) {
  const on = new Set(starters ?? players.map((p) => p.id))
  for (const e of [...events].filter((x) => x.event_type === 'sub').sort(byMinute)) {
    const off = keyOf(e)
    const inn = secondKeyOf(e)
    if (off) on.delete(off)
    if (inn) on.add(inn)
  }
  return { pitch: players.filter((p) => on.has(p.id)), bench: players.filter((p) => !on.has(p.id)) }
}

/** Merges server events with this phone's not-yet-confirmed changes. */
export function mergeEvents(server: LiveEvent[], pending: LiveEvent[], hidden: Set<string>, overrides: Record<string, Partial<LiveEvent>>) {
  const ids = new Set(server.map((e) => e.id))
  return [...server, ...pending.filter((p) => !ids.has(p.id))]
    .filter((e) => !hidden.has(e.id))
    .map((e) => (overrides[e.id] ? { ...e, ...overrides[e.id] } : e))
}

/** The event as it will look after an edit (used for optimistic display; the server applies the same rules). */
export function editedEvent(e: LiveEvent, scorer: string | null, assist: string | null, minute: number, extra: { is_own_goal?: boolean; card_type?: 'yellow' | 'red' } = {}): Partial<LiveEvent> {
  const p = keyFields(scorer, 'primary')
  const s = keyFields(assist, 'secondary')
  const rest = { ...(e.details_json || {}) }
  delete rest.guest_player_id
  delete rest.guest_secondary_player_id
  return {
    player_id: p.id,
    secondary_player_id: s.id,
    minute,
    details_json: { ...rest, ...p.details, ...s.details, ...extra },
  }
}

/** Builds the fields an event stores for a player key (registered id vs guest key). */
export function keyFields(key: string | null, which: 'primary' | 'secondary'): { id: string | null; details: Record<string, string> } {
  const guest = !!key && key.startsWith('guest_')
  return { id: guest ? null : key, details: guest ? { [which === 'primary' ? 'guest_player_id' : 'guest_secondary_player_id']: key! } : {} }
}

export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
