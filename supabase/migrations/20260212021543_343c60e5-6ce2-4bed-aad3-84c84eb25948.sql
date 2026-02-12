CREATE OR REPLACE FUNCTION public.get_total_training_seconds(target_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(SUM(duration), 0)::bigint
  FROM public.workout_history
  WHERE user_id = target_user_id
$$;