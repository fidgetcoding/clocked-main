
-- Drop the overly permissive SELECT policy that exposes sensitive data
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
