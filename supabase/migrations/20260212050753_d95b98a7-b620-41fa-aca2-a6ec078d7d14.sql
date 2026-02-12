
-- Recreate the profiles_public view with SECURITY INVOKER (safe default)
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
WITH (security_invoker = true)
AS
SELECT id, user_id, name, handle, avatar_url, bio, role, total_xp, current_level, prestige, workouts_completed, current_streak, total_training_seconds, sessions_completed_this_year, created_at
FROM profiles;

-- Add RLS policy so authenticated users can read all profiles via this view
-- The profiles table already has RLS enabled; we need a SELECT policy for authenticated users to see others
CREATE POLICY "Authenticated users can read public profile data"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);
