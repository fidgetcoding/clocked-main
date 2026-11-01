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

-- ===== C3/C4: club membership and club-only posts =====
-- Definer so policies can check membership without re-entering club_members RLS.
CREATE FUNCTION public.is_club_member(_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = _club_id
      AND cm.user_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_club_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_club_member(uuid) TO authenticated;

-- The old policy queried club_members from inside its own policy, so every read
-- failed with "infinite recursion detected".
DROP POLICY IF EXISTS "Members visible for public clubs or own clubs" ON public.club_members;
CREATE POLICY "Members visible for public clubs or own clubs"
  ON public.club_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_members.club_id AND c.type = 'public')
    OR public.is_club_member(club_id)
  );

DROP POLICY IF EXISTS "Users can join clubs" ON public.club_members;
CREATE POLICY "Users can join public clubs as members"
  ON public.club_members FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'member'
    AND EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_members.club_id AND c.type = 'public')
  );

-- Enforces member_cap at the database. Locking the club row makes concurrent joins
-- take turns, so the last spot can't be taken twice.
CREATE FUNCTION public.enforce_club_member_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  cap integer;
BEGIN
  SELECT c.member_cap INTO cap
  FROM public.clubs c
  WHERE c.id = NEW.club_id
  FOR NO KEY UPDATE;

  IF cap IS NOT NULL
     AND (SELECT count(*) FROM public.club_members cm WHERE cm.club_id = NEW.club_id) >= cap THEN
    RAISE EXCEPTION 'This club has reached its member limit';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_club_member_cap() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER enforce_club_member_cap
  BEFORE INSERT ON public.club_members
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_club_member_cap();

DROP POLICY IF EXISTS "Authenticated users can view all community posts" ON public.community_posts;
CREATE POLICY "Users can view feed posts and their clubs' posts"
  ON public.community_posts FOR SELECT
  TO authenticated
  USING (destination IS DISTINCT FROM 'club' OR public.is_club_member(club_id));

DROP POLICY IF EXISTS "Users can insert their own posts" ON public.community_posts;
CREATE POLICY "Users can insert their own posts"
  ON public.community_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (destination IS DISTINCT FROM 'club' OR public.is_club_member(club_id))
  );

-- Without this, an UPDATE could move an existing post into a club the author isn't in,
-- getting around the INSERT check above.
DROP POLICY IF EXISTS "Users can update their own posts" ON public.community_posts;
CREATE POLICY "Users can update their own posts"
  ON public.community_posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (destination IS DISTINCT FROM 'club' OR public.is_club_member(club_id))
  );

-- ===== C5: limit what can be uploaded as an avatar =====
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = '{image/jpeg,image/png,image/webp}'
WHERE id = 'avatars';

-- ===== C8: profiles_public only returns the caller's own row =====
-- It's a security_invoker view over own-row-only profiles RLS, which breaks feed authors,
-- follower lists and search. These definer RPCs return safe columns for other users without
-- any USING (true) on profiles. The view stays for now: it's harmless and unused by the app.
CREATE FUNCTION public.get_public_profiles(target_user_ids uuid[])
RETURNS TABLE (id uuid, user_id uuid, name text, handle text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.user_id, p.name, p.handle, p.avatar_url
  FROM public.profiles p
  WHERE p.user_id = ANY (target_user_ids[1:500]);
$$;

-- Matches literally, so % and _ in the query aren't wildcards. Excludes the caller.
CREATE FUNCTION public.search_public_profiles(search_query text)
RETURNS TABLE (id uuid, user_id uuid, name text, handle text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.user_id, p.name, p.handle, p.avatar_url
  FROM public.profiles p
  WHERE char_length(btrim(search_query)) >= 2
    AND p.user_id IS DISTINCT FROM auth.uid()
    AND position(lower(btrim(search_query)) IN lower(p.name)) > 0
  ORDER BY p.name
  LIMIT 20;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.search_public_profiles(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_public_profiles(text) TO authenticated;

REVOKE ALL ON TABLE public.profiles_public FROM anon;
