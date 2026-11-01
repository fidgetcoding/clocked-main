import { describe, expect, it } from 'vitest';
import { wholeSecondsSince } from '@/lib/sessionClock';

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
