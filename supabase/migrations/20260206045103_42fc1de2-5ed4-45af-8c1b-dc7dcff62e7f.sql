-- Drop the overly permissive policy that exposes all columns
DROP POLICY IF EXISTS "Authenticated users can view public profile info" ON public.profiles;

-- The "Users can view own profile" policy remains for owner access
-- For public profile viewing, we'll keep the view but it needs proper RLS

-- Enable RLS on the view by using a function
-- Create a security definer function to fetch public profile data
CREATE OR REPLACE FUNCTION public.get_public_profile(target_user_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  name text,
  handle text,
  bio text,
  avatar_url text,
  role text,
  total_xp integer,
  current_level integer,
  prestige text,
  workouts_completed integer,
  current_streak integer,
  total_training_seconds integer,
  sessions_completed_this_year integer,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.user_id,
    p.name,
    p.handle,
    p.bio,
    p.avatar_url,
    p.role,
    p.total_xp,
    p.current_level,
    p.prestige,
    p.workouts_completed,
    p.current_streak,
    p.total_training_seconds,
    p.sessions_completed_this_year,
    p.created_at
  FROM public.profiles p
  WHERE p.user_id = target_user_id
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO authenticated;