-- Allow authenticated users to read all profiles (public data only via the profiles_public view)
CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);