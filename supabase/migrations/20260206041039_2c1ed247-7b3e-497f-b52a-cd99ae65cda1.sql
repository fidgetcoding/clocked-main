-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- Create policy for users to view their own full profile
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create a public view with only safe columns (no preferences, equipment, goals, etc.)
CREATE VIEW public.profiles_public AS
SELECT 
  id,
  user_id,
  name,
  handle,
  avatar_url,
  bio,
  role,
  total_xp,
  current_level,
  prestige,
  workouts_completed,
  current_streak,
  total_training_seconds,
  sessions_completed_this_year,
  created_at
FROM public.profiles;

-- Grant access to the view for authenticated users
GRANT SELECT ON public.profiles_public TO authenticated;
GRANT SELECT ON public.profiles_public TO anon;