DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker = false)
AS SELECT
  id, user_id, name, handle, avatar_url, bio, role,
  total_xp, current_level, prestige,
  workouts_completed, current_streak,
  total_training_seconds, sessions_completed_this_year,
  created_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated;