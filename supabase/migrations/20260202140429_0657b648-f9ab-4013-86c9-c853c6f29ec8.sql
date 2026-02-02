-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view follows" ON public.follows;

-- Create a new policy that requires authentication
CREATE POLICY "Authenticated users can view follows"
ON public.follows
FOR SELECT
USING (auth.uid() IS NOT NULL);