-- =============================================
-- KhelaHobe Migration: Fix Missing Profile Settings Columns
-- =============================================

-- Add missing email and push notification preferences columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_msg_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_notif_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_forum_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS security_question TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS security_answer TEXT;
