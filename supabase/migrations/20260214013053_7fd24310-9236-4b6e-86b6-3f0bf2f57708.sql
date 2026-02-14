
-- Create tier_presets table for canonical tier-based workout loadouts
CREATE TABLE public.tier_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tier TEXT NOT NULL,
  equipment_mode TEXT NOT NULL CHECK (equipment_mode IN ('shadow', 'bag')),
  name TEXT NOT NULL,
  description TEXT,
  loadout JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tier, equipment_mode)
);

-- Enable RLS
ALTER TABLE public.tier_presets ENABLE ROW LEVEL SECURITY;

-- Public read access for authenticated users
CREATE POLICY "Authenticated users can read tier presets"
  ON public.tier_presets
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Create function to get user counts per tier
CREATE OR REPLACE FUNCTION public.get_tier_user_counts()
RETURNS TABLE(tier TEXT, user_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COALESCE(prestige, 'rookie') as tier,
    COUNT(*)::bigint as user_count
  FROM public.profiles
  GROUP BY COALESCE(prestige, 'rookie');
$$;
