-- Phase 1 (security): hashed security answers in a private table.
-- Additive: the old profiles.security_answer column stays until the next release, but the backfill
-- script (scripts/backfill-security-answers.ts) hashes every answer into this table and blanks the column.

create table if not exists public.user_security (
  user_id uuid primary key references auth.users(id) on delete cascade,
  answer_hash text not null,               -- scrypt "salt:hash" of the trimmed, lower-cased answer
  failed_attempts int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

-- Server code (service role) only: RLS on with no policies, and no table privileges for clients.
alter table public.user_security enable row level security;
revoke all on public.user_security from anon, authenticated;

-- Profiles are no longer readable without logging in.
-- (Name from supabase_schema.sql; confirm against the production baseline before running.)
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Profiles are viewable by signed-in users" on public.profiles;
create policy "Profiles are viewable by signed-in users"
  on public.profiles for select to authenticated using (true);
