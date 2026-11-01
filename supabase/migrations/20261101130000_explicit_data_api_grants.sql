-- Supabase no longer grants Data API access on new public tables automatically (new projects
-- since 2026-05-30, all projects since 2026-10-30). Without these grants every query fails with
-- 42501, whatever the RLS policies say. Older projects went the other way and granted everything,
-- including TRUNCATE, which RLS doesn't cover. Starting from nothing makes both end up the same,
-- with each role holding only what its policies can use.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- Guests read the club list and nothing else.
GRANT SELECT ON TABLE public.clubs TO anon;

GRANT SELECT ON TABLE public.profiles_public TO authenticated;
GRANT SELECT ON TABLE public.app_config TO authenticated;
GRANT SELECT ON TABLE public.tier_presets TO authenticated;
GRANT SELECT ON TABLE public.user_roles TO authenticated;
GRANT SELECT, INSERT ON TABLE public.badges TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.personal_records TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.club_members TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.custom_exercises TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.follows TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clubs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.community_posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workout_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workout_ratings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workouts TO authenticated;

-- Edge functions use the service role, including for the AI quota table.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
