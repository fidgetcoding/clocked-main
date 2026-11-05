-- Two more writes the browser used to piece together.
--
-- The starter workout was seeded after checking "no workouts yet" from the browser, so two tabs (or a
-- profile refresh mid-seed) could both pass the check and add it twice. A run's completion count was
-- written as the browser's copy plus one, so two tabs finishing the same workout kept only one count.

CREATE FUNCTION public.seed_first_workout(seed jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(seed) IS DISTINCT FROM 'object' OR coalesce(seed ->> 'name', '') = '' THEN
    RAISE EXCEPTION 'A starter workout needs a name' USING ERRCODE = '22023';
  END IF;

  -- One seed at a time per account, so the second caller sees the first one's workout
  PERFORM pg_advisory_xact_lock(hashtextextended('seed_first_workout:' || caller::text, 0));
  IF EXISTS (SELECT 1 FROM public.workouts w WHERE w.user_id = caller) THEN
    RETURN false;
  END IF;

  INSERT INTO public.workouts (user_id, name, description, duration, difficulty, phases, combos, tags, is_preset, is_archived, times_completed)
  VALUES (
    caller,
    seed ->> 'name',
    seed ->> 'description',
    coalesce((seed ->> 'duration')::integer, 0),
    coalesce(seed ->> 'difficulty', 'beginner'),
    CASE WHEN jsonb_typeof(seed -> 'phases') = 'array' THEN seed -> 'phases' ELSE '[]'::jsonb END,
    CASE WHEN jsonb_typeof(seed -> 'combos') = 'array' THEN seed -> 'combos' ELSE '[]'::jsonb END,
    CASE WHEN jsonb_typeof(seed -> 'tags') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(seed -> 'tags')) ELSE '{}'::text[] END,
    true,
    false,
    0
  );
  RETURN true;
END;
$$;

CREATE FUNCTION public.count_workout_completion(target_workout_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  completed integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;
  UPDATE public.workouts w
  SET times_completed = coalesce(w.times_completed, 0) + 1, last_used_at = now()
  WHERE w.id = target_workout_id AND w.user_id = auth.uid()
  RETURNING w.times_completed INTO completed;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That workout is not yours' USING ERRCODE = 'P0002';
  END IF;
  RETURN completed;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.seed_first_workout(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.count_workout_completion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_first_workout(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_workout_completion(uuid) TO authenticated;
