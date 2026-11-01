-- Follows and club membership stay private row by row. These hand out only the totals and ranks
-- the app shows, which the row rules alone can't: a fighter only sees follows they're part of, so
-- counting rows on someone else's profile came back wrong.

CREATE FUNCTION public.get_follow_counts(target_user_id uuid)
RETURNS TABLE (followers bigint, following bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (SELECT count(*) FROM public.follows f WHERE f.following_id = target_user_id),
    (SELECT count(*) FROM public.follows f WHERE f.follower_id = target_user_id);
$$;

-- Public clubs, plus any private ones the caller belongs to
CREATE FUNCTION public.get_club_member_counts()
RETURNS TABLE (club_id uuid, member_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.id, count(m.id)
  FROM public.clubs c
  LEFT JOIN public.club_members m ON m.club_id = c.id
  WHERE c.type = 'public' OR public.is_club_member(c.id)
  GROUP BY c.id;
$$;

-- Only a club's own members can see its ranks
CREATE FUNCTION public.get_club_ranks(target_club_id uuid)
RETURNS TABLE (user_id uuid, name text, avatar_url text, total_xp integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.user_id, p.name, p.avatar_url, p.total_xp
  FROM public.club_members m
  JOIN public.profiles p ON p.user_id = m.user_id
  WHERE m.club_id = target_club_id
    AND public.is_club_member(target_club_id)
  ORDER BY p.total_xp DESC, p.name
  LIMIT 100;
$$;

REVOKE EXECUTE ON FUNCTION public.get_follow_counts(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_club_member_counts() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_club_ranks(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_follow_counts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_club_member_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_club_ranks(uuid) TO authenticated;
