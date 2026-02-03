-- Create community_posts table for shared workouts and feed posts
CREATE TABLE public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL, -- 'workout_complete', 'preset_shared', 'rank_up', 'streak_milestone'
  workout_id text, -- References the workout being shared
  workout_name text,
  workout_data jsonb, -- Full workout structure for shared presets
  message text, -- Optional message from the user
  likes integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view all posts (community is public)
CREATE POLICY "Authenticated users can view all community posts"
ON public.community_posts
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Users can only insert their own posts
CREATE POLICY "Users can insert their own posts"
ON public.community_posts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own posts
CREATE POLICY "Users can delete their own posts"
ON public.community_posts
FOR DELETE
USING (auth.uid() = user_id);

-- Users can update their own posts (for likes, etc.)
CREATE POLICY "Users can update their own posts"
ON public.community_posts
FOR UPDATE
USING (auth.uid() = user_id);