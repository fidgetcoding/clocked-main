-- Add combos column to workouts table to store combo data
ALTER TABLE public.workouts 
ADD COLUMN combos jsonb DEFAULT '[]'::jsonb;