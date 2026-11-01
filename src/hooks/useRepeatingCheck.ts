import { useEffect } from 'react';
import { useLatest } from './useLatest';

// Runs the newest version of `check` on a steady beat. Values the check reads can change as often as
// they like without restarting the timer, which is what kept a 5-second check from ever firing
// when it depended on a clock ticking every second.
export function useRepeatingCheck(check: () => void, intervalMs: number, active: boolean) {
  const latestCheck = useLatest(check);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => latestCheck.current(), intervalMs);
    return () => clearInterval(interval);
  }, [active, intervalMs, latestCheck]);
}
