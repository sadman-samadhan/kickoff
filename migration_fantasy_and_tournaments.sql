-- Migration: Add Fantasy FPL fields (DNP, MOTM) and stage_name for knockout tournaments to match_schedule
ALTER TABLE match_schedule
ADD COLUMN IF NOT EXISTS dnp_player_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS dnp_guest_names TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS motm_player_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS motm_guest_name TEXT,
ADD COLUMN IF NOT EXISTS stage_name TEXT;
