import { useCallback, useRef } from 'react';
import type { DbWorkout } from '@/hooks/useWorkouts';

type CompletionUpdate = { id: string; times_completed: number; last_used_at: string };

/**
 * A workout's times_completed goes up once per run: when the run reaches the end, or when a run that ended
 * early is saved. Ending early and never saving, as Leave Without Saving does, doesn't count.
 */
export function useTimesCompleted(workout: Pick<DbWorkout, 'id' | 'times_completed'> | null | undefined, update: (patch: CompletionUpdate) => void) {
  const counted = useRef(false);

  const count = useCallback(() => {
    if (counted.current || !workout) return;
    counted.current = true;
    update({ id: workout.id, times_completed: (workout.times_completed || 0) + 1, last_used_at: new Date().toISOString() });
  }, [workout, update]);

  /** For a restart: the next run can count again. */
  const reset = useCallback(() => {
    counted.current = false;
  }, []);

  return { ranToEnd: count, saved: count, reset };
}
