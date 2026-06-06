-- Add security_question and security_answer to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS security_question TEXT,
ADD COLUMN IF NOT EXISTS security_answer TEXT;
