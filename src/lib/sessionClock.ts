/**
 * Whole seconds since the last tick, and when the next count starts from. The leftover carries over,
 * so a busy page ticking late can't make the clock run slow.
 */
export function wholeSecondsSince(lastTick: number, now: number) {
  const seconds = Math.floor((now - lastTick) / 1000);
  return { seconds, lastTick: lastTick + seconds * 1000 };
}
