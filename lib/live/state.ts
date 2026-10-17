/* eslint-disable @typescript-eslint/no-explicit-any */
import 'server-only'
import { createAdminClient } from '@/lib/supabase/server'
import type { LiveEvent, LiveMatchState, LivePlayer, LiveTeam } from './types'

const PLAYER_FIELDS = 'id, full_name, avatar_url, preferred_position, is_suspended'
const MATCH_FIELDS =
  'id, booking_id, match_number, stage_name, status, period, home_score, away_score, home_team_id, away_team_id, timing_mode, half_minutes, duration_minutes, clock_running, clock_started_at, clock_elapsed_ms, starting_player_ids, mvp_player_id, motm_guest_name'

/** Loads everything the live scoring screen needs. Callers check access first. */
export async function loadLiveMatch(matchId: string): Promise<LiveMatchState | null> {
  const admin = createAdminClient()
  const { data: m } = await admin.from('match_schedule').select(MATCH_FIELDS).eq('id', matchId).maybeSingle()
  if (!m) return null

  const teamIds = [m.home_team_id, m.away_team_id].filter(Boolean)
  const [{ data: teams }, { data: rsvps }, { data: teamPlayers }, { data: events }] = await Promise.all([
    teamIds.length ? admin.from('teams').select('id, name, jersey_color, captain_id, guest_members').in('id', teamIds) : Promise.resolve({ data: [] as any[] }),
    admin.from('rsvps').select('id, guest_name, guest_position').eq('booking_id', m.booking_id).is('player_id', null),
    teamIds.length ? admin.from('team_players').select(`team_id, player_id, profiles(${PLAYER_FIELDS})`).in('team_id', teamIds) : Promise.resolve({ data: [] as any[] }),
    admin
      .from('match_events')
      .select('id, match_schedule_id, event_type, team_id, player_id, secondary_player_id, minute, details_json, created_at, created_by, creator:profiles!created_by(full_name)')
      .eq('match_schedule_id', matchId)
      .is('voided_at', null)
      .order('created_at', { ascending: true }),
  ])

  const guestRsvps = new Map((rsvps || []).map((r: any) => [r.id, r]))
  const guestsOf = (guestMembers: unknown): LivePlayer[] => {
    const out: LivePlayer[] = []
    const seen = new Set<string>()
    for (const raw of Array.isArray(guestMembers) ? guestMembers : []) {
      const clean = String(raw).replace(/^guest_/, '').replace(' (C)', '').trim()
      const r: any = guestRsvps.get(clean)
      const name = r?.guest_name || (clean && !clean.includes('-') ? clean : null)
      if (!name || seen.has(name.toLowerCase())) continue
      seen.add(name.toLowerCase())
      out.push({ id: `guest_${r?.id || clean}`, full_name: name, preferred_position: r?.guest_position || null, is_guest: true })
    }
    return out.sort((a, b) => a.full_name.localeCompare(b.full_name))
  }
  const team = (id: string | null): LiveTeam | null => {
    const t: any = (teams || []).find((x: any) => x.id === id)
    if (!t) return null
    const registered: LivePlayer[] = (teamPlayers || [])
      .filter((tp: any) => tp.team_id === id && tp.profiles && !tp.profiles.is_suspended)
      .map((tp: any) => ({ id: tp.player_id, full_name: tp.profiles.full_name || 'Player', avatar_url: tp.profiles.avatar_url, preferred_position: tp.profiles.preferred_position }))
      .sort((a: LivePlayer, b: LivePlayer) => a.full_name.localeCompare(b.full_name))
    return { id: t.id, name: t.name, jersey_color: t.jersey_color, captain_id: t.captain_id, players: [...registered, ...guestsOf(t.guest_members)] }
  }

  return {
    serverNow: Date.now(),
    match: {
      ...m,
      home_score: m.home_score ?? 0,
      away_score: m.away_score ?? 0,
      timing_mode: m.timing_mode === 'continuous' ? 'continuous' : 'halves',
      clock_elapsed_ms: Number(m.clock_elapsed_ms || 0),
    } as LiveMatchState['match'],
    home: team(m.home_team_id),
    away: team(m.away_team_id),
    events: (events || []).map(({ creator, ...e }: any) => ({ ...e, created_by_name: creator?.full_name || null }) as LiveEvent),
  }
}
