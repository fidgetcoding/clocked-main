import { describe, expect, it } from 'vitest';
import { DEMO_BOX, DEMO_JOINTS, DEMO_KEY_TIMES, DEMO_PEAK_FRAME, demoPoseAt, punchDemoFrames } from '@/lib/punch/punchDemo';
import type { PunchClass } from '@/lib/punch/types';

const PUNCHES: PunchClass[] = ['jab', 'cross', 'lead_hook', 'rear_hook', 'lead_uppercut', 'rear_uppercut'];

describe('punch demo', () => {
  it('has a demo for every calibration punch and none for an unnamed one', () => {
    for (const punch of PUNCHES) expect(punchDemoFrames(punch, 'orthodox')?.frames).toHaveLength(DEMO_KEY_TIMES.length);
    expect(punchDemoFrames('punch', 'orthodox')).toBeNull();
  });

  it('throws with the lead hand on 1, 3 and 5 and the rear hand on 2, 4 and 6', () => {
    expect(PUNCHES.map((punch) => punchDemoFrames(punch, 'orthodox')!.side)).toEqual(['l', 'r', 'l', 'r', 'l', 'r']);
  });

  it('draws a southpaw as the mirror image of an orthodox fighter', () => {
    for (const punch of PUNCHES) {
      const orthodox = punchDemoFrames(punch, 'orthodox')!.frames[DEMO_PEAK_FRAME];
      const southpaw = punchDemoFrames(punch, 'southpaw')!.frames[DEMO_PEAK_FRAME];
      for (const joint of DEMO_JOINTS) {
        // Within the 0.1 rounding step
        expect(Math.abs(southpaw[joint][0] + orthodox[joint][0])).toBeLessThanOrEqual(0.1);
        expect(southpaw[joint][1]).toBe(orthodox[joint][1]);
      }
    }
  });

  it('moves the throwing glove away from guard and brings it back', () => {
    for (const punch of PUNCHES) {
      const { frames, side } = punchDemoFrames(punch, 'orthodox')!;
      const glove = side === 'l' ? 'lWrist' : 'rWrist';
      const [guard, wind, peak] = [frames[0][glove], frames[1][glove], frames[DEMO_PEAK_FRAME][glove]];
      // A hook winds out wide and lands back near the chin, so the travel can be either leg
      expect(Math.max(Math.hypot(peak[0] - guard[0], peak[1] - guard[1]), Math.hypot(wind[0] - guard[0], wind[1] - guard[1]))).toBeGreaterThan(10);
      expect(demoPoseAt(frames, 0)[glove]).toEqual(guard);
      expect(demoPoseAt(frames, 0.999)[glove][0]).toBeCloseTo(guard[0], 1);
    }
  });

  it('straights reach toward the punching side, and uppercuts rise', () => {
    const jab = punchDemoFrames('jab', 'orthodox')!.frames;
    expect(jab[DEMO_PEAK_FRAME].lWrist[0]).toBeGreaterThan(jab[0].lWrist[0]);
    const uppercut = punchDemoFrames('lead_uppercut', 'orthodox')!.frames;
    // Screen y grows downward
    expect(uppercut[DEMO_PEAK_FRAME].lWrist[1]).toBeLessThan(uppercut[1].lWrist[1]);
  });

  it('swings a hook round to the target instead of straight at it', () => {
    for (const punch of ['lead_hook', 'rear_hook'] as PunchClass[]) {
      const { frames, side, arc } = punchDemoFrames(punch, 'orthodox')!;
      const glove = side === 'l' ? 'lWrist' : 'rWrist';
      const [wind, peak] = [frames[1][glove], frames[DEMO_PEAK_FRAME][glove]];
      const mid = demoPoseAt(frames, (DEMO_KEY_TIMES[1] + DEMO_KEY_TIMES[DEMO_PEAK_FRAME]) / 2, arc)[glove];
      // Distance of the mid-swing glove from the straight line between wind-up and landing
      const off = Math.abs((peak[0] - wind[0]) * (wind[1] - mid[1]) - (wind[0] - mid[0]) * (peak[1] - wind[1])) / Math.hypot(peak[0] - wind[0], peak[1] - wind[1]);
      expect(off).toBeGreaterThan(5);
    }
  });

  // The arrow's start, control point and end, from its path
  const arrowCurve = (punch: PunchClass, stance: 'orthodox' | 'southpaw' = 'orthodox') => {
    const [ax, ay, cx, cy, bx, by] = punchDemoFrames(punch, stance)!.arrow.path.match(/-?[\d.]+/g)!.map(Number);
    return { a: [ax, ay], c: [cx, cy], b: [bx, by] };
  };
  const onCurve = ({ a, c, b }: ReturnType<typeof arrowCurve>, u: number) =>
    [0, 1].map((k) => (1 - u) ** 2 * a[k] + 2 * (1 - u) * u * c[k] + u ** 2 * b[k]);

  it('points an arrow the way the glove goes: straight, round under the arm, or up', () => {
    const control = (punch: PunchClass) => {
      const { a, c, b } = arrowCurve(punch);
      return { bend: [c[0] - (a[0] + b[0]) / 2, c[1] - (a[1] + b[1]) / 2].map((v) => Math.round(v) + 0), rise: b[1] - a[1], reach: b[0] - a[0] };
    };
    expect(control('jab').bend).toEqual([0, 0]);
    expect(control('jab').reach).toBeGreaterThan(0);
    // Screen y grows downward: an uppercut's arrow climbs
    expect(control('lead_uppercut').rise).toBeLessThan(0);
    for (const punch of ['lead_hook', 'rear_hook'] as PunchClass[]) {
      expect(Math.hypot(...control(punch).bend)).toBeGreaterThan(5);
      // A hook's arrow runs under the forearm, clear of the glove (10 round, the arrow 4 wide) all through the swing
      const { frames, side, arc } = punchDemoFrames(punch, 'orthodox')!;
      const glove = side === 'l' ? 'lWrist' : 'rWrist';
      const [from, to] = [DEMO_KEY_TIMES[1], DEMO_KEY_TIMES[DEMO_PEAK_FRAME]];
      const lowestGlove = Math.max(...Array.from({ length: 21 }, (_, k) => demoPoseAt(frames, from + ((to - from) * k) / 20, arc)[glove][1]));
      for (let k = 0; k <= 10; k++) expect(onCurve(arrowCurve(punch), k / 10)[1]).toBeGreaterThan(lowestGlove + 12);
    }
    for (const punch of PUNCHES) expect(punchDemoFrames(punch, 'southpaw')!.arrow.head.split(' ')).toHaveLength(6);
  });

  it('keeps every arrow off the head', () => {
    for (const punch of PUNCHES) {
      for (const stance of ['orthodox', 'southpaw'] as const) {
        const { frames, arrow } = punchDemoFrames(punch, stance)!;
        const head = frames[DEMO_PEAK_FRAME].head;
        const curve = arrowCurve(punch, stance);
        const numbers = arrow.head.split(' ').map(Number);
        const points = [...Array.from({ length: 21 }, (_, k) => onCurve(curve, k / 20)), ...[0, 2, 4].map((k) => numbers.slice(k, k + 2))];
        // The head's radius is 13 and the arrow is 4 wide
        for (const [x, y] of points) expect(Math.hypot(x - head[0], y - head[1])).toBeGreaterThan(16);
      }
    }
  });

  it('lands the punch at the peak keyframe time', () => {
    const { frames } = punchDemoFrames('cross', 'orthodox')!;
    const landed = demoPoseAt(frames, DEMO_KEY_TIMES[DEMO_PEAK_FRAME]);
    expect(landed.rWrist[0]).toBeCloseTo(frames[DEMO_PEAK_FRAME].rWrist[0], 5);
  });

  it('frames every punch in the same size box, with the whole arrow inside it', () => {
    for (const punch of PUNCHES) {
      for (const stance of ['orthodox', 'southpaw'] as const) {
        const { viewBox, arrow } = punchDemoFrames(punch, stance)!;
        const [left, top, width, height] = viewBox.split(' ').map(Number);
        expect([width, height]).toEqual([DEMO_BOX.width, DEMO_BOX.height]);
        const numbers = arrow.head.split(' ').map(Number);
        for (let k = 0; k < numbers.length; k += 2) {
          expect(numbers[k]).toBeGreaterThanOrEqual(left);
          expect(numbers[k]).toBeLessThanOrEqual(left + width);
          expect(numbers[k + 1]).toBeGreaterThanOrEqual(top);
        }
      }
    }
  });
});
