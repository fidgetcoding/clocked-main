-- Restrict app_config to authenticated users only (defense-in-depth)
DROP POLICY IF EXISTS "Anyone can read app config" ON public.app_config;

CREATE POLICY "Authenticated users can read app config"
ON public.app_config
FOR SELECT
USING (auth.uid() IS NOT NULL);