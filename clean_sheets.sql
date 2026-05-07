CREATE TABLE IF NOT EXISTS clean_sheets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_schedule_id UUID REFERENCES match_schedule(id) ON DELETE CASCADE,
  player_id UUID REFERENCES profiles(id),
  team_id UUID REFERENCES teams(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_schedule_id, player_id)
);

ALTER TABLE clean_sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view clean sheets" ON clean_sheets FOR SELECT USING (true);
CREATE POLICY "Members can insert clean sheets" ON clean_sheets FOR INSERT WITH CHECK (auth.role() = 'authenticated');
