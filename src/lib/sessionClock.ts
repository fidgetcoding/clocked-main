/**
 * Whole seconds since the last tick, and when the next count starts from. The leftover carries over,
 * so a busy page ticking late can't make the clock run slow.
 */
export function wholeSecondsSince(lastTick: number, now: number) {
  const seconds = Math.floor((now - lastTick) / 1000);
  return { seconds, lastTick: lastTick + seconds * 1000 };
}

/** Allocate a delayed tick across preparation and each segment, stopping at the workout's end. */
export function splitSessionTick<T extends { duration: number }>(
  segments: readonly T[],
  index: number,
  remaining: number,
  preparation: boolean,
  seconds: number,
) {
  let pending = Math.max(0, seconds);
  const trained: { segment: T; seconds: number }[] = [];
  if (preparation) pending -= Math.min(pending, Math.max(0, remaining));
  for (let i = index; i < segments.length && pending > 0; i++) {
    // Match the session's existing fallback for a missing/zero duration.
    const available = !preparation && i === index ? remaining : segments[i].duration || 60;
    const spent = Math.min(pending, Math.max(0, available));
    if (spent > 0) trained.push({ segment: segments[i], seconds: spent });
    pending -= spent;
  }
  return { consumedSeconds: seconds - pending, trained };
}
