
-- Create workout_ratings table
CREATE TABLE public.workout_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workout_id TEXT NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, workout_id)
);

-- Enable RLS
ALTER TABLE public.workout_ratings ENABLE ROW LEVEL SECURITY;

-- Users can view all ratings (for averages)
CREATE POLICY "Anyone can view ratings"
  ON public.workout_ratings FOR SELECT
  USING (true);

-- Users can insert their own ratings
CREATE POLICY "Users can insert own ratings"
  ON public.workout_ratings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own ratings
CREATE POLICY "Users can update own ratings"
  ON public.workout_ratings FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own ratings
CREATE POLICY "Users can delete own ratings"
  ON public.workout_ratings FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_workout_ratings_workout ON public.workout_ratings(workout_id);

-- Trigger for updated_at
CREATE TRIGGER update_workout_ratings_updated_at
  BEFORE UPDATE ON public.workout_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
