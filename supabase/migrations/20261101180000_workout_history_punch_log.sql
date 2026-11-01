-- The full record of a camera session: every punch, combo, round and form cue. Null when the camera wasn't on.
ALTER TABLE public.workout_history
  ADD COLUMN punch_log jsonb,
  ADD CONSTRAINT workout_history_punch_log_shape CHECK (
    punch_log IS NULL OR (jsonb_typeof(punch_log) = 'object' AND pg_column_size(punch_log) < 2097152)
  );
