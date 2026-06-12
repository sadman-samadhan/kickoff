-- ============================================
-- MIGRATION: Push Notifications & Reminders
-- ============================================

-- 1. Create push_subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  subscription_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, subscription_json)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists to make it re-runnable
DROP POLICY IF EXISTS "Users can manage own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can manage own push subscriptions" ON push_subscriptions
  FOR ALL USING (user_id = auth.uid());

-- 2. Add preference columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_msg_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_notif_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_forum_enabled BOOLEAN DEFAULT TRUE;

-- 3. Add tracking fields to group_members and bookings
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS last_unread_email_sent_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE;
