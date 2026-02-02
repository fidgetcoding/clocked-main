-- Create app_config table to store version and other settings
CREATE TABLE public.app_config (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    key text NOT NULL UNIQUE,
    value text NOT NULL,
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read config (version is public info)
CREATE POLICY "Anyone can read app config"
ON public.app_config
FOR SELECT
USING (true);

-- Insert initial version
INSERT INTO public.app_config (key, value) VALUES ('version', '1.31');