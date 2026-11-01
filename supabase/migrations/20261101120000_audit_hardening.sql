-- Security audit fixes. Forward-only.

-- ===== C1: per-user daily quota for generate-workout =====
-- RLS on with no policies: only the service role can reach this table.
CREATE TABLE public.ai_generation_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  request_count integer NOT NULL CHECK (request_count >= 0),
  PRIMARY KEY (user_id, usage_date)
);

ALTER TABLE public.ai_generation_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_generation_usage FROM PUBLIC, anon, authenticated;

-- Counts one request atomically. Returns false, without counting, once the limit is reached.
CREATE FUNCTION public.consume_ai_generation_quota(_user_id uuid, _daily_limit integer)
RETURNS boolean
LANGUAGE sql
SET search_path = ''
AS $$
  WITH counted AS (
    INSERT INTO public.ai_generation_usage AS usage (user_id, usage_date, request_count)
    VALUES (_user_id, (now() AT TIME ZONE 'utc')::date, 1)
    ON CONFLICT (user_id, usage_date) DO UPDATE
      SET request_count = usage.request_count + 1
      WHERE usage.request_count < _daily_limit
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM counted);
$$;

REVOKE EXECUTE ON FUNCTION public.consume_ai_generation_quota(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_generation_quota(uuid, integer) TO service_role;

-- ===== C2: stop exposing who rated what; lock down RPCs; scope avatar listing =====
DROP POLICY IF EXISTS "Anyone can view ratings" ON public.workout_ratings;

CREATE POLICY "Users can view own ratings"
  ON public.workout_ratings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Aggregates only: individual ratings and who gave them stay private.
CREATE FUNCTION public.get_workout_rating_summary(target_workout_id text)
RETURNS TABLE (average_rating numeric, rating_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT round(avg(r.rating), 1), count(*)
  FROM public.workout_ratings r
  WHERE r.workout_id = target_workout_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_workout_rating_summary(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_workout_rating_summary(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_public_profile(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_total_training_seconds(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_tier_user_counts() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_total_training_seconds(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tier_user_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- The bucket stays public, so avatars still load by URL. This only limits listing
-- and API reads to the owner's own folder.
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

CREATE POLICY "Users can view their own avatar files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
