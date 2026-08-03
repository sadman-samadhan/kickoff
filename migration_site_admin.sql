-- =============================================
-- KhelaHobe Migration: Site Admin, User Suspension, System Broadcasts
-- =============================================

-- 1. Add site admin, suspension, and notification preference columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_site_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_msg_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_notif_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_forum_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS security_question TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS security_answer TEXT;

-- 2. Set initial site admin for sakib.samadhan@gmail.com
UPDATE profiles 
SET is_site_admin = TRUE 
WHERE email = 'sakib.samadhan@gmail.com';

-- 3. Create System Broadcasts table
CREATE TABLE IF NOT EXISTS system_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create Broadcast Dismissals table for tracking popups per user
CREATE TABLE IF NOT EXISTS broadcast_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  broadcast_id UUID NOT NULL REFERENCES system_broadcasts(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, broadcast_id)
);

-- RLS Policies
ALTER TABLE system_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view system broadcasts" 
  ON system_broadcasts FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Site admins can insert system broadcasts" 
  ON system_broadcasts FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_site_admin = TRUE
    )
  );

CREATE POLICY "Users can view their own broadcast dismissals" 
  ON broadcast_dismissals FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own broadcast dismissals" 
  ON broadcast_dismissals FOR INSERT 
  WITH CHECK (user_id = auth.uid());
