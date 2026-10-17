-- Production schema baseline (public schema), generated 2026-10-17T09:58:01.883Z
-- PostgreSQL 17.6 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit

-- extension: pg_stat_statements (schema extensions)
-- extension: pgcrypto (schema extensions)
-- extension: plpgsql (schema pg_catalog)
-- extension: supabase_vault (schema vault)
-- extension: uuid-ossp (schema extensions)

create table public.admin_appeals (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  subject text not null,
  message text not null,
  status text default 'pending'::text,
  created_at timestamp with time zone default now()
);
alter table public.admin_appeals enable row level security;

create table public.bookings (
  id uuid default gen_random_uuid() not null,
  group_id uuid,
  created_by uuid,
  match_date date not null,
  match_time time without time zone not null,
  field_name text not null,
  google_maps_url text,
  max_players integer default 21,
  status text default 'upcoming'::text,
  created_at timestamp with time zone default now(),
  reminder_sent boolean default false
);
alter table public.bookings enable row level security;

create table public.broadcast_dismissals (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  broadcast_id uuid not null,
  dismissed_at timestamp with time zone default now()
);
alter table public.broadcast_dismissals enable row level security;

create table public.clean_sheets (
  id uuid default gen_random_uuid() not null,
  match_schedule_id uuid,
  player_id uuid,
  team_id uuid,
  created_at timestamp with time zone default now()
);
alter table public.clean_sheets enable row level security;

create table public.field_ratings (
  id uuid default gen_random_uuid() not null,
  field_id uuid,
  booking_id uuid,
  user_id uuid,
  rating integer not null,
  review text,
  created_at timestamp with time zone default now()
);
alter table public.field_ratings enable row level security;

create table public.fields (
  id uuid default gen_random_uuid() not null,
  name text not null,
  google_maps_url text,
  created_by uuid,
  created_at timestamp with time zone default now()
);
alter table public.fields enable row level security;

create table public.forum_comments (
  id uuid default gen_random_uuid() not null,
  post_id uuid,
  author_id uuid,
  content text not null,
  created_at timestamp with time zone default now()
);
alter table public.forum_comments enable row level security;

create table public.forum_posts (
  id uuid default gen_random_uuid() not null,
  author_id uuid,
  title text not null,
  content text not null,
  category text default 'general'::text,
  created_at timestamp with time zone default now()
);
alter table public.forum_posts enable row level security;

create table public.goal_events (
  id uuid default gen_random_uuid() not null,
  match_schedule_id uuid,
  scorer_id uuid,
  assist_id uuid,
  team_id uuid,
  is_own_goal boolean default false,
  minute integer,
  created_at timestamp with time zone default now(),
  guest_scorer_name text,
  guest_assist_name text
);
alter table public.goal_events enable row level security;

create table public.group_members (
  id uuid default gen_random_uuid() not null,
  group_id uuid,
  player_id uuid,
  role text default 'member'::text,
  joined_at timestamp with time zone default now(),
  last_read_at timestamp with time zone default now(),
  last_unread_email_sent_at timestamp with time zone
);
alter table public.group_members enable row level security;

create table public.group_messages (
  id uuid default gen_random_uuid() not null,
  group_id uuid,
  sender_id uuid,
  content text not null,
  created_at timestamp with time zone default now()
);
alter table public.group_messages enable row level security;

create table public.groups (
  id uuid default gen_random_uuid() not null,
  name text not null,
  invite_code text default substr(md5((random())::text), 1, 8),
  created_by uuid,
  created_at timestamp with time zone default now(),
  custom_scoring_settings jsonb
);
alter table public.groups enable row level security;

create table public.match_events (
  id uuid default gen_random_uuid() not null,
  match_schedule_id uuid not null,
  event_type text not null,
  player_id uuid,
  secondary_player_id uuid,
  team_id uuid,
  minute integer default 0 not null,
  details_json jsonb,
  created_at timestamp with time zone default now()
);
alter table public.match_events enable row level security;

create table public.match_schedule (
  id uuid default gen_random_uuid() not null,
  booking_id uuid,
  home_team_id uuid,
  away_team_id uuid,
  match_number integer,
  leg integer default 1,
  scheduled_order integer,
  home_score integer default 0,
  away_score integer default 0,
  status text default 'scheduled'::text,
  created_at timestamp with time zone default now(),
  dnp_player_ids uuid[] default '{}'::uuid[],
  dnp_guest_names text[] default '{}'::text[],
  motm_player_id uuid,
  motm_guest_name text,
  stage_name text,
  duration_minutes integer default 30,
  mvp_player_id uuid,
  started_at timestamp with time zone,
  period text,
  starting_player_ids text[]
);
alter table public.match_schedule enable row level security;

create table public.mvp_votes (
  id uuid default gen_random_uuid() not null,
  group_id uuid not null,
  booking_id uuid,
  voter_id uuid not null,
  nominee_id uuid not null,
  created_at timestamp with time zone default now()
);
alter table public.mvp_votes enable row level security;

create table public.notifications (
  id uuid default gen_random_uuid() not null,
  player_id uuid,
  booking_id uuid,
  group_id uuid,
  message text not null,
  is_read boolean default false,
  created_at timestamp with time zone default now()
);
alter table public.notifications enable row level security;

create table public.profiles (
  id uuid not null,
  username text,
  full_name text not null,
  email text,
  preferred_position text,
  secondary_position text,
  avatar_url text,
  created_at timestamp with time zone default now(),
  security_question text,
  security_answer text,
  push_msg_enabled boolean default true,
  push_notif_enabled boolean default true,
  push_forum_enabled boolean default true,
  is_site_admin boolean default false,
  is_suspended boolean default false,
  email_notifications boolean default true
);
alter table public.profiles enable row level security;

create table public.push_subscriptions (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  subscription_json jsonb not null,
  created_at timestamp with time zone default now()
);
alter table public.push_subscriptions enable row level security;

create table public.rsvps (
  id uuid default gen_random_uuid() not null,
  booking_id uuid,
  player_id uuid,
  status text default 'pending'::text,
  responded_at timestamp with time zone,
  waitlist_position integer,
  guest_name text,
  guest_position text,
  selected_position text
);
alter table public.rsvps enable row level security;

create table public.system_broadcasts (
  id uuid default gen_random_uuid() not null,
  title text not null,
  message text not null,
  created_by uuid,
  created_at timestamp with time zone default now()
);
alter table public.system_broadcasts enable row level security;

create table public.team_players (
  id uuid default gen_random_uuid() not null,
  team_id uuid,
  player_id uuid
);
alter table public.team_players enable row level security;

create table public.teams (
  id uuid default gen_random_uuid() not null,
  booking_id uuid,
  name text,
  jersey_color text,
  captain_id uuid,
  created_at timestamp with time zone default now(),
  guest_members jsonb
);
alter table public.teams enable row level security;

alter table public.admin_appeals add constraint admin_appeals_pkey PRIMARY KEY (id);
alter table public.admin_appeals add constraint admin_appeals_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'resolved'::text])));
alter table public.bookings add constraint bookings_pkey PRIMARY KEY (id);
alter table public.bookings add constraint bookings_status_check CHECK ((status = ANY (ARRAY['upcoming'::text, 'ongoing'::text, 'completed'::text, 'cancelled'::text])));
alter table public.broadcast_dismissals add constraint broadcast_dismissals_pkey PRIMARY KEY (id);
alter table public.broadcast_dismissals add constraint broadcast_dismissals_user_id_broadcast_id_key UNIQUE (user_id, broadcast_id);
alter table public.clean_sheets add constraint clean_sheets_match_schedule_id_player_id_key UNIQUE (match_schedule_id, player_id);
alter table public.clean_sheets add constraint clean_sheets_pkey PRIMARY KEY (id);
alter table public.field_ratings add constraint field_ratings_field_id_booking_id_user_id_key UNIQUE (field_id, booking_id, user_id);
alter table public.field_ratings add constraint field_ratings_pkey PRIMARY KEY (id);
alter table public.field_ratings add constraint field_ratings_rating_check CHECK (((rating >= 1) AND (rating <= 5)));
alter table public.fields add constraint fields_name_key UNIQUE (name);
alter table public.fields add constraint fields_pkey PRIMARY KEY (id);
alter table public.forum_comments add constraint forum_comments_pkey PRIMARY KEY (id);
alter table public.forum_posts add constraint forum_posts_category_check CHECK ((category = ANY (ARRAY['general'::text, 'looking_for_players'::text, 'match_invite'::text, 'question'::text, 'announcement'::text])));
alter table public.forum_posts add constraint forum_posts_pkey PRIMARY KEY (id);
alter table public.goal_events add constraint goal_events_pkey PRIMARY KEY (id);
alter table public.group_members add constraint group_members_group_id_player_id_key UNIQUE (group_id, player_id);
alter table public.group_members add constraint group_members_pkey PRIMARY KEY (id);
alter table public.group_members add constraint group_members_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text])));
alter table public.group_messages add constraint group_messages_pkey PRIMARY KEY (id);
alter table public.groups add constraint groups_invite_code_key UNIQUE (invite_code);
alter table public.groups add constraint groups_pkey PRIMARY KEY (id);
alter table public.match_events add constraint match_events_event_type_check CHECK ((event_type = ANY (ARRAY['goal'::text, 'card'::text, 'sub'::text, 'penalty_save'::text])));
alter table public.match_events add constraint match_events_pkey PRIMARY KEY (id);
alter table public.match_schedule add constraint match_schedule_pkey PRIMARY KEY (id);
alter table public.match_schedule add constraint match_schedule_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'ongoing'::text, 'completed'::text])));
alter table public.mvp_votes add constraint mvp_votes_group_id_voter_id_key UNIQUE (group_id, voter_id);
alter table public.mvp_votes add constraint mvp_votes_pkey PRIMARY KEY (id);
alter table public.notifications add constraint notifications_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_preferred_position_check CHECK ((preferred_position = ANY (ARRAY['GK'::text, 'DEF'::text, 'MID'::text, 'ATT'::text])));
alter table public.profiles add constraint profiles_secondary_position_check CHECK ((secondary_position = ANY (ARRAY['GK'::text, 'DEF'::text, 'MID'::text, 'ATT'::text])));
alter table public.profiles add constraint profiles_username_key UNIQUE (username);
alter table public.push_subscriptions add constraint push_subscriptions_pkey PRIMARY KEY (id);
alter table public.push_subscriptions add constraint push_subscriptions_user_id_subscription_json_key UNIQUE (user_id, subscription_json);
alter table public.rsvps add constraint rsvps_booking_id_player_id_key UNIQUE (booking_id, player_id);
alter table public.rsvps add constraint rsvps_pkey PRIMARY KEY (id);
alter table public.rsvps add constraint rsvps_status_check CHECK ((status = ANY (ARRAY['in'::text, 'out'::text, 'pending'::text, 'waitlist'::text])));
alter table public.system_broadcasts add constraint system_broadcasts_pkey PRIMARY KEY (id);
alter table public.team_players add constraint team_players_pkey PRIMARY KEY (id);
alter table public.team_players add constraint team_players_team_id_player_id_key UNIQUE (team_id, player_id);
alter table public.teams add constraint teams_pkey PRIMARY KEY (id);
alter table public.admin_appeals add constraint admin_appeals_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.bookings add constraint bookings_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);
alter table public.bookings add constraint bookings_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
alter table public.broadcast_dismissals add constraint broadcast_dismissals_broadcast_id_fkey FOREIGN KEY (broadcast_id) REFERENCES system_broadcasts(id) ON DELETE CASCADE;
alter table public.broadcast_dismissals add constraint broadcast_dismissals_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.clean_sheets add constraint clean_sheets_match_schedule_id_fkey FOREIGN KEY (match_schedule_id) REFERENCES match_schedule(id) ON DELETE CASCADE;
alter table public.clean_sheets add constraint clean_sheets_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id);
alter table public.clean_sheets add constraint clean_sheets_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id);
alter table public.field_ratings add constraint field_ratings_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
alter table public.field_ratings add constraint field_ratings_field_id_fkey FOREIGN KEY (field_id) REFERENCES fields(id) ON DELETE CASCADE;
alter table public.field_ratings add constraint field_ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.fields add constraint fields_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);
alter table public.forum_comments add constraint forum_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.forum_comments add constraint forum_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE;
alter table public.forum_posts add constraint forum_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.goal_events add constraint goal_events_assist_id_fkey FOREIGN KEY (assist_id) REFERENCES profiles(id);
alter table public.goal_events add constraint goal_events_match_schedule_id_fkey FOREIGN KEY (match_schedule_id) REFERENCES match_schedule(id) ON DELETE CASCADE;
alter table public.goal_events add constraint goal_events_scorer_id_fkey FOREIGN KEY (scorer_id) REFERENCES profiles(id);
alter table public.goal_events add constraint goal_events_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id);
alter table public.group_members add constraint group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
alter table public.group_members add constraint group_members_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.group_messages add constraint group_messages_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
alter table public.group_messages add constraint group_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.groups add constraint groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);
alter table public.match_events add constraint match_events_match_schedule_id_fkey FOREIGN KEY (match_schedule_id) REFERENCES match_schedule(id) ON DELETE CASCADE;
alter table public.match_events add constraint match_events_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.match_events add constraint match_events_secondary_player_id_fkey FOREIGN KEY (secondary_player_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.match_events add constraint match_events_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
alter table public.match_schedule add constraint match_schedule_away_team_id_fkey FOREIGN KEY (away_team_id) REFERENCES teams(id);
alter table public.match_schedule add constraint match_schedule_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
alter table public.match_schedule add constraint match_schedule_home_team_id_fkey FOREIGN KEY (home_team_id) REFERENCES teams(id);
alter table public.match_schedule add constraint match_schedule_motm_player_id_fkey FOREIGN KEY (motm_player_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.match_schedule add constraint match_schedule_mvp_player_id_fkey FOREIGN KEY (mvp_player_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.mvp_votes add constraint mvp_votes_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
alter table public.mvp_votes add constraint mvp_votes_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
alter table public.mvp_votes add constraint mvp_votes_nominee_id_fkey FOREIGN KEY (nominee_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.mvp_votes add constraint mvp_votes_voter_id_fkey FOREIGN KEY (voter_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id);
alter table public.notifications add constraint notifications_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.push_subscriptions add constraint push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.rsvps add constraint rsvps_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
alter table public.rsvps add constraint rsvps_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.system_broadcasts add constraint system_broadcasts_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.team_players add constraint team_players_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.team_players add constraint team_players_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
alter table public.teams add constraint teams_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
alter table public.teams add constraint teams_captain_id_fkey FOREIGN KEY (captain_id) REFERENCES profiles(id);


CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  default_username TEXT;
BEGIN
  -- Generate a unique default username if not provided (e.g. Google SSO signup)
  IF new.raw_user_meta_data->>'username' IS NULL OR new.raw_user_meta_data->>'username' = '' THEN
    default_username := 'player_' || substr(md5(random()::text), 1, 8);
  ELSE
    default_username := new.raw_user_meta_data->>'username';
  END IF;

  INSERT INTO public.profiles (id, full_name, email, username, preferred_position, secondary_position, avatar_url)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), 
    new.email,
    default_username,
    new.raw_user_meta_data->>'preferred_position',
    new.raw_user_meta_data->>'secondary_position',
    COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', '')
  );
  RETURN new;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_group_member(target_group_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = target_group_id
    AND player_id = auth.uid()
  );
END;
$function$
;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

create policy "Site admins can update all appeals" on public.admin_appeals as permissive for update to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_site_admin = true)))));
create policy "Site admins can view all appeals" on public.admin_appeals as permissive for select to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_site_admin = true)))));
create policy "Users can create their own appeals" on public.admin_appeals as permissive for insert to public with check ((user_id = auth.uid()));
create policy "Users can submit appeals" on public.admin_appeals as permissive for insert to public with check ((user_id = auth.uid()));
create policy "Users can view their appeals" on public.admin_appeals as permissive for select to public using ((user_id = auth.uid()));
create policy "Users can view their own appeals" on public.admin_appeals as permissive for select to public using ((user_id = auth.uid()));
create policy "Members can create bookings" on public.bookings as permissive for insert to public with check ((group_id IN ( SELECT group_members.group_id
   FROM group_members
  WHERE (group_members.player_id = auth.uid()))));
create policy "Members can view bookings" on public.bookings as permissive for select to public using ((group_id IN ( SELECT group_members.group_id
   FROM group_members
  WHERE (group_members.player_id = auth.uid()))));
create policy "Users can insert dismissals" on public.broadcast_dismissals as permissive for insert to public with check ((user_id = auth.uid()));
create policy "Users can insert their own broadcast dismissals" on public.broadcast_dismissals as permissive for insert to public with check ((user_id = auth.uid()));
create policy "Users can view dismissals" on public.broadcast_dismissals as permissive for select to public using ((user_id = auth.uid()));
create policy "Users can view their own broadcast dismissals" on public.broadcast_dismissals as permissive for select to public using ((user_id = auth.uid()));
create policy "Members can insert clean sheets" on public.clean_sheets as permissive for insert to public with check ((auth.role() = 'authenticated'::text));
create policy "Members can view clean sheets" on public.clean_sheets as permissive for select to public using (true);
create policy "Authenticated users can add field ratings" on public.field_ratings as permissive for insert to public with check ((user_id = auth.uid()));
create policy "Authenticated users can view field ratings" on public.field_ratings as permissive for select to public using ((auth.role() = 'authenticated'::text));
create policy "Authenticated users can create fields" on public.fields as permissive for insert to public with check ((auth.role() = 'authenticated'::text));
create policy "Authenticated users can view fields" on public.fields as permissive for select to public using ((auth.role() = 'authenticated'::text));
create policy "Authenticated users can add forum comments" on public.forum_comments as permissive for insert to public with check ((author_id = auth.uid()));
create policy "Authenticated users can view forum comments" on public.forum_comments as permissive for select to public using ((auth.role() = 'authenticated'::text));
create policy "Authors can delete own comments" on public.forum_comments as permissive for delete to public using ((author_id = auth.uid()));
create policy "Authenticated users can create forum posts" on public.forum_posts as permissive for insert to public with check ((author_id = auth.uid()));
create policy "Authenticated users can view forum posts" on public.forum_posts as permissive for select to public using ((auth.role() = 'authenticated'::text));
create policy "Authors can delete own forum posts" on public.forum_posts as permissive for delete to public using ((author_id = auth.uid()));
create policy "Authors can update own forum posts" on public.forum_posts as permissive for update to public using ((author_id = auth.uid()));
create policy "Members can insert goals" on public.goal_events as permissive for insert to public with check ((auth.role() = 'authenticated'::text));
create policy "Members can view goals" on public.goal_events as permissive for select to public using (true);
create policy "Members can view group members" on public.group_members as permissive for select to public using (is_group_member(group_id));
create policy "Users can join groups" on public.group_members as permissive for insert to public with check ((player_id = auth.uid()));
create policy "Members can send group messages" on public.group_messages as permissive for insert to public with check (((sender_id = auth.uid()) AND (group_id IN ( SELECT group_members.group_id
   FROM group_members
  WHERE (group_members.player_id = auth.uid())))));
create policy "Members can view group messages" on public.group_messages as permissive for select to public using ((group_id IN ( SELECT group_members.group_id
   FROM group_members
  WHERE (group_members.player_id = auth.uid()))));
create policy "Authenticated users can create groups" on public.groups as permissive for insert to public with check ((auth.role() = 'authenticated'::text));
create policy "Members can view their groups" on public.groups as permissive for select to public using ((is_group_member(id) OR (created_by = auth.uid())));
create policy "Anyone authenticated can delete match events" on public.match_events as permissive for delete to public using ((auth.role() = 'authenticated'::text));
create policy "Anyone authenticated can insert match events" on public.match_events as permissive for insert to public with check ((auth.role() = 'authenticated'::text));
create policy "Anyone authenticated can view match events" on public.match_events as permissive for select to public using ((auth.role() = 'authenticated'::text));
create policy "Members can insert schedules" on public.match_schedule as permissive for insert to public with check ((auth.role() = 'authenticated'::text));
create policy "Members can update schedules" on public.match_schedule as permissive for update to public using ((auth.role() = 'authenticated'::text));
create policy "Members can view schedules" on public.match_schedule as permissive for select to public using ((booking_id IN ( SELECT bookings.id
   FROM bookings
  WHERE (bookings.group_id IN ( SELECT group_members.group_id
           FROM group_members
          WHERE (group_members.player_id = auth.uid()))))));
create policy "Anyone authenticated can view MVP votes" on public.mvp_votes as permissive for select to public using ((auth.role() = 'authenticated'::text));
create policy "Users can cast MVP votes" on public.mvp_votes as permissive for insert to public with check ((voter_id = auth.uid()));
create policy "Users can update own notifications" on public.notifications as permissive for update to public using ((player_id = auth.uid()));
create policy "Users can view own notifications" on public.notifications as permissive for select to public using ((player_id = auth.uid()));
create policy "Users can insert own profile" on public.profiles as permissive for insert to public with check ((auth.uid() = id));
create policy "Users can update own profile" on public.profiles as permissive for update to public using ((auth.uid() = id));
create policy "Users can view own profile" on public.profiles as permissive for select to public using ((auth.uid() = id));
create policy "Users can manage own push subscriptions" on public.push_subscriptions as permissive for all to public using ((user_id = auth.uid()));
create policy "Members can view RSVPs" on public.rsvps as permissive for select to public using ((booking_id IN ( SELECT bookings.id
   FROM bookings
  WHERE (bookings.group_id IN ( SELECT group_members.group_id
           FROM group_members
          WHERE (group_members.player_id = auth.uid()))))));
create policy "Players can manage own RSVPs" on public.rsvps as permissive for all to public using ((player_id = auth.uid()));
create policy "Anyone authenticated can view system broadcasts" on public.system_broadcasts as permissive for select to public using ((auth.role() = 'authenticated'::text));
create policy "Site admins can insert system broadcasts" on public.system_broadcasts as permissive for insert to public with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_site_admin = true)))));
create policy "Members can insert team players" on public.team_players as permissive for insert to public with check ((auth.role() = 'authenticated'::text));
create policy "Members can view team players" on public.team_players as permissive for select to public using (true);
create policy "Members can create teams" on public.teams as permissive for insert to public with check ((booking_id IN ( SELECT bookings.id
   FROM bookings
  WHERE (bookings.group_id IN ( SELECT group_members.group_id
           FROM group_members
          WHERE (group_members.player_id = auth.uid()))))));
create policy "Members can view teams" on public.teams as permissive for select to public using ((booking_id IN ( SELECT bookings.id
   FROM bookings
  WHERE (bookings.group_id IN ( SELECT group_members.group_id
           FROM group_members
          WHERE (group_members.player_id = auth.uid()))))));

-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.admin_appeals to anon
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.admin_appeals to authenticated
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.bookings to anon
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.bookings to authenticated
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.broadcast_dismissals to anon
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.broadcast_dismissals to authenticated
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.clean_sheets to anon
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.clean_sheets to authenticated
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.field_ratings to anon
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.field_ratings to authenticated
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.fields to anon
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.fields to authenticated
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.forum_comments to anon
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.forum_comments to authenticated
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.forum_posts to anon
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.forum_posts to authenticated
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.goal_events to anon
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.goal_events to authenticated
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.group_members to anon
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.group_members to authenticated
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.group_messages to anon
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.group_messages to authenticated
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.groups to anon
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.groups to authenticated
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.match_events to anon
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.match_events to authenticated
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.match_schedule to anon
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.match_schedule to authenticated
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.mvp_votes to anon
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.mvp_votes to authenticated
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.notifications to anon
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.notifications to authenticated
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.profiles to anon
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.profiles to authenticated
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.push_subscriptions to anon
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.push_subscriptions to authenticated
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.rsvps to anon
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.rsvps to authenticated
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.system_broadcasts to anon
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.system_broadcasts to authenticated
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.team_players to anon
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.team_players to authenticated
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.teams to anon
-- grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.teams to authenticated

-- publication supabase_realtime: public.group_messages
-- publication supabase_realtime_messages_publication: realtime.messages_2026_10_07
-- publication supabase_realtime_messages_publication: realtime.messages_2026_10_08
-- publication supabase_realtime_messages_publication: realtime.messages_2026_10_09
-- publication supabase_realtime_messages_publication: realtime.messages_2026_10_10
-- publication supabase_realtime_messages_publication: realtime.messages_2026_10_11
-- publication supabase_realtime_messages_publication: realtime.messages_2026_10_12
-- publication supabase_realtime_messages_publication: realtime.messages_2026_10_13
-- storage bucket: avatars (public=true)

-- rows ~ admin_appeals: -1
-- rows ~ bookings: 20
-- rows ~ broadcast_dismissals: -1
-- rows ~ clean_sheets: 177
-- rows ~ field_ratings: -1
-- rows ~ fields: -1
-- rows ~ forum_comments: -1
-- rows ~ forum_posts: -1
-- rows ~ goal_events: 119
-- rows ~ group_members: 51
-- rows ~ group_messages: -1
-- rows ~ groups: -1
-- rows ~ match_events: 60
-- rows ~ match_schedule: 80
-- rows ~ mvp_votes: -1
-- rows ~ notifications: 456
-- rows ~ profiles: 85
-- rows ~ push_subscriptions: -1
-- rows ~ rsvps: 300
-- rows ~ system_broadcasts: -1
-- rows ~ team_players: 162
-- rows ~ teams: 47
