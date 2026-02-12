-- Drop the broad "anyone can read all profiles" policy
DROP POLICY IF EXISTS "Authenticated users can read public profile data" ON public.profiles;