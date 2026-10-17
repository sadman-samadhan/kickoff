// Snapshot of one match for the live scoring screen (server → client, also returned by the state API).

/** Registered players use their profile id; guests use "guest_<rsvp id>" (or "guest_<name>" on very old teams). */
export type LivePlayer = {
  id: string
  full_name: string
  avatar_url?: string | null
  preferred_position?: string | null
  is_guest?: boolean
}

export type LiveTeam = { id: string; name: string; jersey_color: string | null; captain_id: string | null; players: LivePlayer[] }

export type LiveEvent = {
  id: string
  match_schedule_id: string
  event_type: 'goal' | 'card' | 'sub' | 'penalty_save'
  team_id: string | null
  player_id: string | null
  secondary_player_id: string | null
  minute: number
  details_json: { is_own_goal?: boolean; card_type?: 'yellow' | 'red'; guest_player_id?: string; guest_secondary_player_id?: string } | null
  created_at: string
  created_by: string | null
  created_by_name?: string | null
  /** Set on the client while the server hasn't confirmed the event yet. */
  pending?: boolean
}

export type LiveMatch = {
  id: string
  booking_id: string
  match_number: number | null
  stage_name: string | null
  status: 'scheduled' | 'ongoing' | 'completed'
  period: '1st_half' | 'half_time' | '2nd_half' | 'completed' | null
  home_score: number
  away_score: number
  timing_mode: 'halves' | 'continuous'
  half_minutes: number | null
  duration_minutes: number | null
  clock_running: boolean
  clock_started_at: string | null
  clock_elapsed_ms: number
  starting_player_ids: string[] | null
  mvp_player_id: string | null
  motm_guest_name: string | null
}

export type LiveMatchState = {
  serverNow: number
  match: LiveMatch
  home: LiveTeam | null
  away: LiveTeam | null
  events: LiveEvent[]
}
