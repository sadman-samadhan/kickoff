-- 1. PROFILES (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT,
  preferred_position TEXT CHECK (preferred_position IN ('GK', 'DEF', 'MID', 'ATT')),
  secondary_position TEXT CHECK (secondary_position IN ('GK', 'DEF', 'MID', 'ATT')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. GROUPS
CREATE TABLE groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. GROUP MEMBERS
CREATE TABLE group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, player_id)
);

-- 4. BOOKINGS (match slots)
CREATE TABLE bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id),
  match_date DATE NOT NULL,
  match_time TIME NOT NULL,
  field_name TEXT NOT NULL,
  google_maps_url TEXT,
  max_players INT DEFAULT 21,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. RSVPS
CREATE TABLE rsvps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('in', 'out', 'pending', 'waitlist')),
  responded_at TIMESTAMPTZ,
  waitlist_position INT,
  UNIQUE(booking_id, player_id)
);

-- 6. TEAMS
CREATE TABLE teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  name TEXT,
  jersey_color TEXT,
  captain_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TEAM PLAYERS
CREATE TABLE team_players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE(team_id, player_id)
);

-- 8. MATCH SCHEDULE
CREATE TABLE match_schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  home_team_id UUID REFERENCES teams(id),
  away_team_id UUID REFERENCES teams(id),
  match_number INT,
  leg INT DEFAULT 1,
  scheduled_order INT,
  home_score INT DEFAULT 0,
  away_score INT DEFAULT 0,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. GOAL EVENTS
CREATE TABLE goal_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_schedule_id UUID REFERENCES match_schedule(id) ON DELETE CASCADE,
  scorer_id UUID REFERENCES profiles(id),
  assist_id UUID REFERENCES profiles(id),
  team_id UUID REFERENCES teams(id),
  is_own_goal BOOLEAN DEFAULT FALSE,
  minute INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. NOTIFICATIONS
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 11. TRIGGER FOR NEW USER PROFILES
-- This function runs with SECURITY DEFINER, bypassing RLS to ensure profiles are created.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, username, preferred_position, secondary_position, avatar_url)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', ''), 
    new.email,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'preferred_position',
    new.raw_user_meta_data->>'secondary_position',
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- BASIC RLS POLICIES (read access for authenticated users)

-- PROFILES
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
-- Insert is handled by the trigger (SECURITY DEFINER)
-- We keep a strict insert policy just in case someone tries to insert manually
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- GROUPS
CREATE POLICY "Members can view their groups" ON groups FOR SELECT USING (
  id IN (SELECT group_id FROM group_members WHERE player_id = auth.uid())
);
CREATE POLICY "Authenticated users can create groups" ON groups FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- GROUP MEMBERS
CREATE POLICY "Members can view group members" ON group_members FOR SELECT USING (
  group_id IN (SELECT group_id FROM group_members WHERE player_id = auth.uid())
);
CREATE POLICY "Users can join groups" ON group_members FOR INSERT WITH CHECK (player_id = auth.uid());

-- BOOKINGS
CREATE POLICY "Members can view bookings" ON bookings FOR SELECT USING (
  group_id IN (SELECT group_id FROM group_members WHERE player_id = auth.uid())
);
CREATE POLICY "Members can create bookings" ON bookings FOR INSERT WITH CHECK (
  group_id IN (SELECT group_id FROM group_members WHERE player_id = auth.uid())
);

-- RSVPS
CREATE POLICY "Players can manage own RSVPs" ON rsvps FOR ALL USING (player_id = auth.uid());
CREATE POLICY "Members can view RSVPs" ON rsvps FOR SELECT USING (
  booking_id IN (SELECT id FROM bookings WHERE group_id IN (
    SELECT group_id FROM group_members WHERE player_id = auth.uid()
  ))
);

-- TEAMS
CREATE POLICY "Members can view teams" ON teams FOR SELECT USING (
  booking_id IN (SELECT id FROM bookings WHERE group_id IN (
    SELECT group_id FROM group_members WHERE player_id = auth.uid()
  ))
);
CREATE POLICY "Members can create teams" ON teams FOR INSERT WITH CHECK (
  booking_id IN (SELECT id FROM bookings WHERE group_id IN (
    SELECT group_id FROM group_members WHERE player_id = auth.uid()
  ))
);

-- SCHEDULES
CREATE POLICY "Members can view schedules" ON match_schedule FOR SELECT USING (
  booking_id IN (SELECT id FROM bookings WHERE group_id IN (
    SELECT group_id FROM group_members WHERE player_id = auth.uid()
  ))
);

-- NOTIFICATIONS
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (player_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (player_id = auth.uid());

-- TEAM PLAYERS & GOALS
CREATE POLICY "Members can view team players" ON team_players FOR SELECT USING (true);
CREATE POLICY "Members can view goals" ON goal_events FOR SELECT USING (true);
CREATE POLICY "Members can insert goals" ON goal_events FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Members can insert team players" ON team_players FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Members can insert schedules" ON match_schedule FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Members can update schedules" ON match_schedule FOR UPDATE USING (auth.role() = 'authenticated');
