-- ============================================
-- MIGRATION: Chat, Forum, Fields & Ratings
-- ============================================

-- 1. GROUP MESSAGES (real-time group chat)
CREATE TABLE group_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

-- Members can view messages in their groups
CREATE POLICY "Members can view group messages" ON group_messages FOR SELECT USING (
  group_id IN (SELECT group_id FROM group_members WHERE player_id = auth.uid())
);

-- Members can send messages to their groups
CREATE POLICY "Members can send group messages" ON group_messages FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND
  group_id IN (SELECT group_id FROM group_members WHERE player_id = auth.uid())
);

-- 2. FORUM POSTS
CREATE TABLE forum_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general' CHECK (category IN ('general', 'looking_for_players', 'match_invite', 'question', 'announcement')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view forum posts
CREATE POLICY "Authenticated users can view forum posts" ON forum_posts FOR SELECT USING (auth.role() = 'authenticated');

-- Authenticated users can create forum posts
CREATE POLICY "Authenticated users can create forum posts" ON forum_posts FOR INSERT WITH CHECK (author_id = auth.uid());

-- Authors can update their own posts
CREATE POLICY "Authors can update own forum posts" ON forum_posts FOR UPDATE USING (author_id = auth.uid());

-- Authors can delete their own posts
CREATE POLICY "Authors can delete own forum posts" ON forum_posts FOR DELETE USING (author_id = auth.uid());

-- 3. FORUM COMMENTS
CREATE TABLE forum_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES forum_posts(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE forum_comments ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view comments
CREATE POLICY "Authenticated users can view forum comments" ON forum_comments FOR SELECT USING (auth.role() = 'authenticated');

-- Authenticated users can add comments
CREATE POLICY "Authenticated users can add forum comments" ON forum_comments FOR INSERT WITH CHECK (author_id = auth.uid());

-- Authors can delete their own comments
CREATE POLICY "Authors can delete own comments" ON forum_comments FOR DELETE USING (author_id = auth.uid());

-- 4. FIELDS (unique playing fields)
CREATE TABLE fields (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  google_maps_url TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE fields ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view fields
CREATE POLICY "Authenticated users can view fields" ON fields FOR SELECT USING (auth.role() = 'authenticated');

-- Authenticated users can create fields
CREATE POLICY "Authenticated users can create fields" ON fields FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 5. FIELD RATINGS
CREATE TABLE field_ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  field_id UUID REFERENCES fields(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(field_id, booking_id, user_id)
);

ALTER TABLE field_ratings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view ratings
CREATE POLICY "Authenticated users can view field ratings" ON field_ratings FOR SELECT USING (auth.role() = 'authenticated');

-- Authenticated users can submit ratings
CREATE POLICY "Authenticated users can add field ratings" ON field_ratings FOR INSERT WITH CHECK (user_id = auth.uid());

-- Enable realtime for group_messages
ALTER PUBLICATION supabase_realtime ADD TABLE group_messages;
