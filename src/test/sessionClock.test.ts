import { describe, expect, it } from 'vitest';
import { splitSessionTick, wholeSecondsSince } from '@/lib/sessionClock';

describe('wholeSecondsSince', () => {
  it('counts whole seconds and carries the rest', () => {
    expect(wholeSecondsSince(0, 999)).toEqual({ seconds: 0, lastTick: 0 });
    expect(wholeSecondsSince(0, 1250)).toEqual({ seconds: 1, lastTick: 1000 });
    expect(wholeSecondsSince(1000, 3100)).toEqual({ seconds: 2, lastTick: 3000 });
  });

  it('keeps time when every tick is late', () => {
    let lastTick = 0;
    let total = 0;
    // A timer due every 250 ms that keeps firing 40 ms late, for ten minutes
    for (let now = 290; now <= 600000; now += 290) {
      const tick = wholeSecondsSince(lastTick, now);
      lastTick = tick.lastTick;
      total += tick.seconds;
    }
    expect(total).toBeGreaterThanOrEqual(599);
    expect(total).toBeLessThanOrEqual(600);
  });
});

describe('delayed session ticks', () => {
  const segments = [{ duration: 10 }, { duration: 10 }, { duration: 30 }];

  it('excludes preparation and stops awarding seconds at the workout end', () => {
    const tick = splitSessionTick(segments, 0, 5, true, 300);
    expect(tick.consumedSeconds).toBe(55);
    expect(tick.trained.map((entry) => entry.seconds)).toEqual([10, 10, 30]);
    expect(splitSessionTick(segments, 0, 5, true, 3)).toEqual({ consumedSeconds: 3, trained: [] });
    expect(splitSessionTick(segments, 2, 0, false, 300)).toEqual({ consumedSeconds: 0, trained: [] });
  });

  it('allocates only the remaining part of the current segment, then later segments', () => {
    const tick = splitSessionTick(segments, 0, 3, false, 18);
    expect(tick.trained).toEqual([
      { segment: segments[0], seconds: 3 },
      { segment: segments[1], seconds: 10 },
      { segment: segments[2], seconds: 5 },
    ]);
    expect(tick.consumedSeconds).toBe(18);
  });
});
