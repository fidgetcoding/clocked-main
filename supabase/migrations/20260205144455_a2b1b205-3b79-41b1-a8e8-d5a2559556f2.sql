-- Add RLS policy to allow authenticated users to view all profiles for search/discovery
CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Drop the old restrictive policy that only allowed viewing own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;