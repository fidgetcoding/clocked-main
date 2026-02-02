-- Phase 1: Add new gamification columns to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS prestige text DEFAULT 'rookie';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_level integer DEFAULT 1;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS combos_landed integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_training_seconds integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sessions_completed_this_year integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_workout_date date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak_multiplier decimal(3,2) DEFAULT 1.0;

-- Create badges table for tracking earned achievements
CREATE TABLE IF NOT EXISTS public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_id text NOT NULL,
  earned_at timestamptz DEFAULT now(),
  xp_rewarded integer DEFAULT 0,
  UNIQUE(user_id, badge_id)
);

-- Enable RLS on badges table
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

-- RLS policies for badges
CREATE POLICY "Users can view their own badges" 
ON public.badges 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own badges" 
ON public.badges 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create personal_records table for tracking PRs
CREATE TABLE IF NOT EXISTS public.personal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  record_type text NOT NULL,
  value numeric NOT NULL,
  achieved_at timestamptz DEFAULT now(),
  UNIQUE(user_id, record_type)
);

-- Enable RLS on personal_records table
ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;

-- RLS policies for personal_records
CREATE POLICY "Users can view their own personal records" 
ON public.personal_records 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own personal records" 
ON public.personal_records 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own personal records" 
ON public.personal_records 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Update the handle_new_user function to set prestige based on experience_level
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, name, prestige, current_level)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'name', 'Fighter'),
    'rookie',
    1
  );
  RETURN NEW;
END;
$function$;