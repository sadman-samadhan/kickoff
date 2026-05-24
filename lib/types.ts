// ─── Profile ───
export interface Profile {
  id: string
  full_name: string
  username: string
  email: string | null
  avatar_url: string | null
  preferred_position: 'GK' | 'DEF' | 'MID' | 'ATT' | null
  secondary_position: 'GK' | 'DEF' | 'MID' | 'ATT' | null
  email_notifications: boolean
  created_at: string
}

// ─── Group ───
export interface Group {
  id: string
  name: string
  invite_code: string
  admin_id: string
  created_at: string
}

export interface GroupMember {
  id: string
  group_id: string
  player_id: string
  role: 'admin' | 'member'
  joined_at: string
}

// ─── Booking ───
export interface Booking {
  id: string
  group_id: string
  match_date: string
  match_time: string
  field_name: string
  google_maps_url: string | null
  max_players: number
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled'
  created_by: string
  created_at: string
  confirmed_count?: number
  groups?: Pick<Group, 'id' | 'name'>
}

// ─── RSVP ───
export interface RSVP {
  id: string
  booking_id: string
  player_id: string
  status: 'in' | 'out' | 'waitlist'
  waitlist_position: number | null
  created_at: string
}

// ─── Team ───
export interface Team {
  id: string
  booking_id: string
  name: string | null
  jersey_color: string | null
  captain_id: string | null
}

export interface TeamPlayer {
  id: string
  team_id: string
  player_id: string
}

// ─── Match Schedule ───
export interface MatchSchedule {
  id: string
  booking_id: string
  home_team_id: string
  away_team_id: string
  match_number: number
  leg: number
  scheduled_order: number
  home_score: number | null
  away_score: number | null
  status: 'scheduled' | 'ongoing' | 'completed'
  home?: Pick<Team, 'id' | 'name'>
  away?: Pick<Team, 'id' | 'name'>
}

// ─── Goal Event ───
export interface GoalEvent {
  id: string
  match_schedule_id: string
  team_id: string
  scorer_id: string
  assist_id: string | null
  minute: number | null
  is_own_goal: boolean
  created_at: string
}

// ─── Clean Sheet ───
export interface CleanSheet {
  id: string
  match_schedule_id: string
  team_id: string
  player_id: string
}

// ─── Notification ───
export interface Notification {
  id: string
  player_id: string
  booking_id: string | null
  group_id: string | null
  message: string
  is_read: boolean
  created_at: string
  // Joined fields
  group_name?: string
  match_date?: string
  match_time?: string
  field_name?: string
}

// ─── Stats ───
export interface PlayerStats {
  goals: number
  assists: number
  clean_sheets: number
  matches_played: number
  groups: GroupStats[]
}

export interface GroupStats {
  group_id: string
  group_name: string
  goals: number
  assists: number
  clean_sheets: number
  matches_played: number
}

export interface LeaderboardEntry {
  player_id: string
  full_name: string
  username: string
  avatar_url: string | null
  preferred_position: string | null
  goals: number
  assists: number
  clean_sheets: number
  matches_played: number
}

export interface TopPerformers {
  top_scorer: { player: Pick<Profile, 'full_name' | 'avatar_url'>; goals: number } | null
  top_playmaker: { player: Pick<Profile, 'full_name' | 'avatar_url'>; assists: number } | null
  top_defender: { player: Pick<Profile, 'full_name' | 'avatar_url'>; clean_sheets: number } | null
}

// ─── Group Message ───
export interface GroupMessage {
  id: string
  group_id: string
  sender_id: string
  content: string
  created_at: string
  // Joined
  sender?: Pick<Profile, 'full_name' | 'avatar_url'>
}

// ─── Forum ───
export interface ForumPost {
  id: string
  author_id: string
  title: string
  content: string
  category: 'general' | 'looking_for_players' | 'match_invite' | 'question' | 'announcement'
  created_at: string
  // Joined
  author?: Pick<Profile, 'full_name' | 'avatar_url'>
  comment_count?: number
}

export interface ForumComment {
  id: string
  post_id: string
  author_id: string
  content: string
  created_at: string
  // Joined
  author?: Pick<Profile, 'full_name' | 'avatar_url'>
}

// ─── Field ───
export interface Field {
  id: string
  name: string
  google_maps_url: string | null
  created_by: string | null
  created_at: string
  avg_rating?: number
  rating_count?: number
}

// ─── Field Rating ───
export interface FieldRating {
  id: string
  field_id: string
  booking_id: string
  user_id: string
  rating: number
  review: string | null
  created_at: string
}
