-- From the November 5 security review. None of these exposed private data rows; each closes a smaller leak.

-- has_role answered for any user id, so a signed-in user could find out who the admins are. Every caller
-- (the clubs write policies and the admin-users function, which calls it with the caller's own token)
-- only ever asks about themselves.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT _user_id = auth.uid() AND EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Private clubs were listed to anyone, signed in or not. Now they show only to their members and admins.
-- Two policies, because Postgres checks function permissions when it plans a query: a single policy naming
-- is_club_member would refuse anonymous visitors outright, even for public clubs.
DROP POLICY IF EXISTS "Anyone can view clubs" ON public.clubs;
CREATE POLICY "Anyone can view public clubs"
  ON public.clubs FOR SELECT
  USING (type = 'public');
CREATE POLICY "Members and admins can view private clubs"
  ON public.clubs FOR SELECT
  TO authenticated
  USING (public.is_club_member(id) OR public.has_role(auth.uid(), 'admin'));

-- explicit_data_api_grants tightened the tables that existed then. These keep tables and functions
-- created by later migrations closed until a migration grants them on purpose.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
