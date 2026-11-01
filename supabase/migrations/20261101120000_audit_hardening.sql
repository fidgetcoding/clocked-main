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
