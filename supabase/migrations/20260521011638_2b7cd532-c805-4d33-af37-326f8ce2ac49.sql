
-- profiles: scope write policies to authenticated role
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- workout_history: scope to authenticated
DROP POLICY IF EXISTS "Users can insert their own history" ON public.workout_history;
DROP POLICY IF EXISTS "Users can update their own history" ON public.workout_history;
DROP POLICY IF EXISTS "Users can delete their own history" ON public.workout_history;
CREATE POLICY "Users can insert their own history" ON public.workout_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own history" ON public.workout_history
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own history" ON public.workout_history
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- follows: only the follower or following can see the row
DROP POLICY IF EXISTS "Authenticated users can view follows" ON public.follows;
CREATE POLICY "Users can view their own follow relationships" ON public.follows
  FOR SELECT TO authenticated
  USING (auth.uid() = follower_id OR auth.uid() = following_id);

-- club_members: only members of public clubs or members of the same club
DROP POLICY IF EXISTS "Authenticated users can view club members" ON public.club_members;
CREATE POLICY "Members visible for public clubs or own clubs" ON public.club_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_members.club_id AND c.type = 'public')
    OR EXISTS (SELECT 1 FROM public.club_members cm WHERE cm.club_id = club_members.club_id AND cm.user_id = auth.uid())
  );
