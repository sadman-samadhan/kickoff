-- =============================================
-- KhelaHobe Migration: Extended Tournament Scoring, Live Events, Cards & MVP
-- =============================================

-- 1. Add custom_scoring_settings JSONB column to groups
ALTER TABLE groups ADD COLUMN IF NOT EXISTS custom_scoring_settings JSONB;

-- 2. Add duration_minutes, starting_player_ids, mvp_player_id, started_at, period columns to match_schedule, selected_position to rsvps
ALTER TABLE match_schedule ADD COLUMN IF NOT EXISTS duration_minutes INT DEFAULT 30;
ALTER TABLE match_schedule ADD COLUMN IF NOT EXISTS starting_player_ids TEXT[];
ALTER TABLE match_schedule ADD COLUMN IF NOT EXISTS mvp_player_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE match_schedule ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE match_schedule ADD COLUMN IF NOT EXISTS period TEXT;
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS selected_position TEXT;

-- 3. Create match_events table for live match event logging
CREATE TABLE IF NOT EXISTS match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_schedule_id UUID NOT NULL REFERENCES match_schedule(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('goal', 'card', 'sub', 'penalty_save')),
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  secondary_player_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- assist_id or sub_on_player_id
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  minute INT NOT NULL DEFAULT 0,
  details_json JSONB, -- { card_type: 'yellow'|'red', is_own_goal: boolean, guest_name: string }
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create mvp_votes table for tournament MVP voting
CREATE TABLE IF NOT EXISTS mvp_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nominee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, voter_id)
);

-- RLS Policies
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mvp_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view match events" 
  ON match_events FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone authenticated can insert match events" 
  ON match_events FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Anyone authenticated can delete match events" 
  ON match_events FOR DELETE 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone authenticated can view MVP votes" 
  ON mvp_votes FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone authenticated can cast MVP votes" 
  ON mvp_votes FOR INSERT 
  WITH CHECK (voter_id = auth.uid());

CREATE POLICY "Users can update their own MVP vote" 
  ON mvp_votes FOR UPDATE 
  USING (voter_id = auth.uid());
