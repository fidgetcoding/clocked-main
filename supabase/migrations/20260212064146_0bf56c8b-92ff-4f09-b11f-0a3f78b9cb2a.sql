
-- Create table for user's personal exercise library
CREATE TABLE public.custom_exercises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Custom',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint: one exercise name per user
ALTER TABLE public.custom_exercises ADD CONSTRAINT unique_user_exercise UNIQUE (user_id, name);

-- Enable RLS
ALTER TABLE public.custom_exercises ENABLE ROW LEVEL SECURITY;

-- Users can only see their own exercises
CREATE POLICY "Users can view their own custom exercises"
ON public.custom_exercises FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own custom exercises"
ON public.custom_exercises FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom exercises"
ON public.custom_exercises FOR DELETE
USING (auth.uid() = user_id);
