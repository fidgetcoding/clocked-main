import { useCallback, useRef } from 'react';
import type { DbWorkout } from '@/hooks/useWorkouts';

/**
 * A workout's times_completed goes up once per run: when the run reaches the end, or when a run that ended
 * early is saved. Ending early and never saving, as Leave Without Saving does, doesn't count. A count that
 * fails to save (offline, say) isn't marked done, so saving the run later tries again.
 */
export function useTimesCompleted(workout: Pick<DbWorkout, 'id'> | null | undefined, countRun: (id: string) => Promise<unknown>) {
  const counted = useRef(false);

  const count = useCallback(async () => {
    if (counted.current || !workout) return;
    counted.current = true;
    try {
      await countRun(workout.id);
    } catch (error) {
      counted.current = false;
      console.error('Failed to count the run:', error);
    }
  }, [workout, countRun]);

  /** For a restart: the next run can count again. */
  const reset = useCallback(() => {
    counted.current = false;
  }, []);

  return { ranToEnd: count, saved: count, reset };
}
