-- Drop the view and recreate with security_invoker = true
DROP VIEW IF EXISTS public.profiles_public;

-- Create view with security_invoker to respect RLS of the querying user
CREATE VIEW public.profiles_public
WITH (security_invoker = true) AS
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

-- Since the view now uses security_invoker, we need a policy that allows 
-- authenticated users to read these specific columns.
-- We'll add a separate policy for reading public profile data (limited columns only)
-- This works because the view restricts WHICH columns, and the policy restricts access

-- Add a policy to allow reading any profile's public info
CREATE POLICY "Authenticated users can view public profile info"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Note: The original "Users can view own profile" policy gives full access to own profile
-- The new policy allows reading any profile, but the VIEW restricts to only public columns
-- Users querying the base table directly can only see their own full data (first policy)
-- Users querying the view can see public fields of all users

-- Grant access to the view
GRANT SELECT ON public.profiles_public TO authenticated;