-- Phase 2a (speed): indexes for the columns the app filters and joins on.
-- Safe to run any time: every statement is "if not exists". (Unique constraints already index
-- group_members(group_id, player_id), rsvps(booking_id, player_id) and team_players(team_id, player_id).)

create index if not exists group_members_player_idx   on public.group_members (player_id);
create index if not exists bookings_group_date_idx    on public.bookings (group_id, match_date);
create index if not exists rsvps_player_status_idx    on public.rsvps (player_id, status);
create index if not exists teams_booking_idx          on public.teams (booking_id);
create index if not exists team_players_player_idx    on public.team_players (player_id);
create index if not exists match_schedule_booking_idx on public.match_schedule (booking_id, scheduled_order);
create index if not exists match_schedule_home_idx    on public.match_schedule (home_team_id);
create index if not exists match_schedule_away_idx    on public.match_schedule (away_team_id);
create index if not exists match_events_match_idx     on public.match_events (match_schedule_id, minute);
create index if not exists match_events_player_idx    on public.match_events (player_id);
create index if not exists match_events_secondary_idx on public.match_events (secondary_player_id);
create index if not exists goal_events_match_idx      on public.goal_events (match_schedule_id);
create index if not exists goal_events_scorer_idx     on public.goal_events (scorer_id);
create index if not exists goal_events_assist_idx     on public.goal_events (assist_id);
create index if not exists clean_sheets_player_idx    on public.clean_sheets (player_id);
create index if not exists notifications_player_idx   on public.notifications (player_id, created_at desc);
create index if not exists group_messages_group_idx   on public.group_messages (group_id, created_at desc);
create index if not exists forum_comments_post_idx    on public.forum_comments (post_id);
create index if not exists forum_posts_category_idx   on public.forum_posts (category, created_at desc);
create index if not exists field_ratings_booking_idx  on public.field_ratings (booking_id, user_id);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
