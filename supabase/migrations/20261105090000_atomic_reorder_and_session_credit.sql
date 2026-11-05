-- Two writes that used to be pieced together in the browser now happen in one statement each.
--
-- Reordering sent one update per workout, so a dropped connection could leave half the list moved.
-- Logging a session wrote totals the browser had added up from its own copy of the profile, so two
-- tabs or devices logging at once kept only the last one. Totals now go up on the server, and each
-- session's history row records that it was counted, so a retry or a second tab can't count it twice.

CREATE FUNCTION public.reorder_workouts(ordered_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  moved integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;
  IF ordered_ids IS NULL OR cardinality(ordered_ids) = 0 THEN
    RETURN;
  END IF;
  IF cardinality(ordered_ids) <> (SELECT count(DISTINCT listed) FROM unnest(ordered_ids) AS listed) THEN
    RAISE EXCEPTION 'Each workout must appear once in the new order' USING ERRCODE = '22023';
  END IF;

  UPDATE public.workouts w
  SET sort_order = o.slot - 1
  FROM unnest(ordered_ids) WITH ORDINALITY AS o(id, slot)
  WHERE w.id = o.id AND w.user_id = auth.uid();

  GET DIAGNOSTICS moved = ROW_COUNT;
  IF moved <> cardinality(ordered_ids) THEN
    -- Raising undoes the whole update, so the old order stays intact
    RAISE EXCEPTION 'Only your own workouts can be reordered' USING ERRCODE = '42501';
  END IF;
END;
$$;

ALTER TABLE public.workout_history ADD COLUMN profile_credited_at timestamptz;

-- totals: whole, non-negative amounts added to counters. fields: values computed for the whole
-- profile (streak, session counts), where the larger or the newer value wins.
CREATE FUNCTION public.credit_session_to_profile(history_id uuid, totals jsonb, fields jsonb DEFAULT '{}'::jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
  counters text[] := ARRAY[
    'total_xp', 'combos_landed', 'total_pushups', 'total_burpees', 'total_curlups', 'total_jog_run_minutes',
    'complex_combos', 'defense_combos', 'counter_combos',
    'morning_workouts', 'night_workouts', 'weekend_workouts', 'weekday_workouts', 'monday_workouts',
    'friday_workouts', 'sunday_workouts', 'double_days', 'holiday_workouts', 'comeback_count',
    'post_l100_sessions', 'overflow_xp',
    'punch_1_count', 'punch_2_count', 'punch_3_count', 'punch_4_count',
    'punch_5_count', 'punch_6_count', 'punch_7_count', 'punch_8_count',
    'slips_count', 'rolls_count', 'pullbacks_count', 'circles_count'
  ];
  settable text[] := ARRAY[
    'current_streak', 'longest_streak', 'last_workout_date', 'workouts_completed',
    'total_training_seconds', 'new_years_workout', 'best_session_xp'
  ];
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(totals) IS DISTINCT FROM 'object' OR jsonb_typeof(fields) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Totals and fields must be objects' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each(totals) t
    WHERE NOT (t.key = ANY (counters))
      OR jsonb_typeof(t.value) <> 'number'
      OR (t.value #>> '{}')::numeric < 0
      OR (t.value #>> '{}')::numeric <> trunc((t.value #>> '{}')::numeric)
  ) THEN
    RAISE EXCEPTION 'Totals must be whole, non-negative amounts of known counters' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(fields) k WHERE NOT (k = ANY (settable))) THEN
    RAISE EXCEPTION 'Unknown profile field' USING ERRCODE = '22023';
  END IF;

  -- Claim the session first. A retry or another tab finds it claimed and changes nothing.
  UPDATE public.workout_history h
  SET profile_credited_at = now()
  WHERE h.id = history_id AND h.user_id = caller AND h.profile_credited_at IS NULL;
  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.workout_history h WHERE h.id = history_id AND h.user_id = caller) THEN
      RETURN false;
    END IF;
    RAISE EXCEPTION 'That session is not in your history' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.profiles p SET
    total_xp = coalesce(p.total_xp, 0) + coalesce((totals ->> 'total_xp')::integer, 0),
    combos_landed = coalesce(p.combos_landed, 0) + coalesce((totals ->> 'combos_landed')::integer, 0),
    total_pushups = coalesce(p.total_pushups, 0) + coalesce((totals ->> 'total_pushups')::integer, 0),
    total_burpees = coalesce(p.total_burpees, 0) + coalesce((totals ->> 'total_burpees')::integer, 0),
    total_curlups = coalesce(p.total_curlups, 0) + coalesce((totals ->> 'total_curlups')::integer, 0),
    total_jog_run_minutes = coalesce(p.total_jog_run_minutes, 0) + coalesce((totals ->> 'total_jog_run_minutes')::integer, 0),
    complex_combos = coalesce(p.complex_combos, 0) + coalesce((totals ->> 'complex_combos')::integer, 0),
    defense_combos = coalesce(p.defense_combos, 0) + coalesce((totals ->> 'defense_combos')::integer, 0),
    counter_combos = coalesce(p.counter_combos, 0) + coalesce((totals ->> 'counter_combos')::integer, 0),
    morning_workouts = coalesce(p.morning_workouts, 0) + coalesce((totals ->> 'morning_workouts')::integer, 0),
    night_workouts = coalesce(p.night_workouts, 0) + coalesce((totals ->> 'night_workouts')::integer, 0),
    weekend_workouts = coalesce(p.weekend_workouts, 0) + coalesce((totals ->> 'weekend_workouts')::integer, 0),
    weekday_workouts = coalesce(p.weekday_workouts, 0) + coalesce((totals ->> 'weekday_workouts')::integer, 0),
    monday_workouts = coalesce(p.monday_workouts, 0) + coalesce((totals ->> 'monday_workouts')::integer, 0),
    friday_workouts = coalesce(p.friday_workouts, 0) + coalesce((totals ->> 'friday_workouts')::integer, 0),
    sunday_workouts = coalesce(p.sunday_workouts, 0) + coalesce((totals ->> 'sunday_workouts')::integer, 0),
    double_days = coalesce(p.double_days, 0) + coalesce((totals ->> 'double_days')::integer, 0),
    holiday_workouts = coalesce(p.holiday_workouts, 0) + coalesce((totals ->> 'holiday_workouts')::integer, 0),
    comeback_count = coalesce(p.comeback_count, 0) + coalesce((totals ->> 'comeback_count')::integer, 0),
    post_l100_sessions = coalesce(p.post_l100_sessions, 0) + coalesce((totals ->> 'post_l100_sessions')::integer, 0),
    overflow_xp = coalesce(p.overflow_xp, 0) + coalesce((totals ->> 'overflow_xp')::integer, 0),
    punch_1_count = coalesce(p.punch_1_count, 0) + coalesce((totals ->> 'punch_1_count')::integer, 0),
    punch_2_count = coalesce(p.punch_2_count, 0) + coalesce((totals ->> 'punch_2_count')::integer, 0),
    punch_3_count = coalesce(p.punch_3_count, 0) + coalesce((totals ->> 'punch_3_count')::integer, 0),
    punch_4_count = coalesce(p.punch_4_count, 0) + coalesce((totals ->> 'punch_4_count')::integer, 0),
    punch_5_count = coalesce(p.punch_5_count, 0) + coalesce((totals ->> 'punch_5_count')::integer, 0),
    punch_6_count = coalesce(p.punch_6_count, 0) + coalesce((totals ->> 'punch_6_count')::integer, 0),
    punch_7_count = coalesce(p.punch_7_count, 0) + coalesce((totals ->> 'punch_7_count')::integer, 0),
    punch_8_count = coalesce(p.punch_8_count, 0) + coalesce((totals ->> 'punch_8_count')::integer, 0),
    slips_count = coalesce(p.slips_count, 0) + coalesce((totals ->> 'slips_count')::integer, 0),
    rolls_count = coalesce(p.rolls_count, 0) + coalesce((totals ->> 'rolls_count')::integer, 0),
    pullbacks_count = coalesce(p.pullbacks_count, 0) + coalesce((totals ->> 'pullbacks_count')::integer, 0),
    circles_count = coalesce(p.circles_count, 0) + coalesce((totals ->> 'circles_count')::integer, 0),
    current_streak = CASE WHEN fields ? 'current_streak' THEN (fields ->> 'current_streak')::integer ELSE p.current_streak END,
    longest_streak = greatest(p.longest_streak, (fields ->> 'longest_streak')::integer),
    last_workout_date = greatest(p.last_workout_date, (fields ->> 'last_workout_date')::date),
    workouts_completed = greatest(p.workouts_completed, (fields ->> 'workouts_completed')::integer),
    total_training_seconds = greatest(p.total_training_seconds, (fields ->> 'total_training_seconds')::integer),
    new_years_workout = coalesce(p.new_years_workout, false) OR coalesce((fields ->> 'new_years_workout')::boolean, false),
    best_session_xp = greatest(p.best_session_xp, (fields ->> 'best_session_xp')::integer)
  WHERE p.user_id = caller;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No profile for this account' USING ERRCODE = 'P0002';
  END IF;
  RETURN true;
END;
$$;

-- XP awarded outside a logged session (a finished Quick Session, a hand-logged workout)
CREATE FUNCTION public.add_profile_xp(amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  updated integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;
  IF amount IS NULL OR amount < 0 THEN
    RAISE EXCEPTION 'XP must be a non-negative whole number' USING ERRCODE = '22023';
  END IF;
  UPDATE public.profiles p SET total_xp = coalesce(p.total_xp, 0) + amount
  WHERE p.user_id = auth.uid()
  RETURNING p.total_xp INTO updated;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No profile for this account' USING ERRCODE = 'P0002';
  END IF;
  RETURN updated;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reorder_workouts(uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.add_profile_xp(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_profile_xp(integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_session_to_profile(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_workouts(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.credit_session_to_profile(uuid, jsonb, jsonb) TO authenticated;
