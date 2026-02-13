
-- Add lifetime stats columns for badge tracking
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS total_pushups integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_burpees integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_curlups integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_jog_run_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS complex_combos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS defense_combos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS counter_combos integer NOT NULL DEFAULT 0;
