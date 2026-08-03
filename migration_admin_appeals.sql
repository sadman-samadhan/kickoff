-- =============================================
-- KhelaHobe Migration: Admin Appeals for Suspended Accounts
-- =============================================

CREATE TABLE IF NOT EXISTS admin_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE admin_appeals ENABLE ROW LEVEL SECURITY;

-- Suspended users can insert their own appeals
CREATE POLICY "Users can create their own appeals" 
  ON admin_appeals FOR INSERT 
  WITH CHECK (user_id = auth.uid());

-- Users can view their own appeals
CREATE POLICY "Users can view their own appeals" 
  ON admin_appeals FOR SELECT 
  USING (user_id = auth.uid());

-- Site admins can view and update all appeals
CREATE POLICY "Site admins can view all appeals" 
  ON admin_appeals FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_site_admin = TRUE
    )
  );

CREATE POLICY "Site admins can update all appeals" 
  ON admin_appeals FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_site_admin = TRUE
    )
  );
