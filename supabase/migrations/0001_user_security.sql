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

-- Note: production already limits profile reads to the user's own row ("Users can view own profile"),
-- so no read-policy change is needed here.
