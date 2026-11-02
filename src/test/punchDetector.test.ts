import { describe, expect, it } from 'vitest';
import { classifyPunch, scoreShapes } from '@/lib/punch/classify';
import { PunchDetector } from '@/lib/punch/detector';
import type { FormFlagged, PunchDetected, PunchEvent, Stance } from '@/lib/punch/types';
import { simulate, type HandName, type Shape, type SynthOptions } from './punchSynth';

function run(options: SynthOptions, stance: Stance = options.stance ?? 'orthodox') {
  const detector = new PunchDetector(stance);
  const events: PunchEvent[] = [];
  for (const frame of simulate({ ...options, stance })) events.push(...detector.push(frame));
  return {
    events,
    punches: events.filter((e): e is PunchDetected => e.type === 'punch'),
    form: events.filter((e): e is FormFlagged => e.type === 'form'),
  };
}

const LABELS: [HandName, Shape, string][] = [
  ['lead', 'straight', 'jab'],
  ['rear', 'straight', 'cross'],
  ['lead', 'hook', 'lead_hook'],
  ['rear', 'hook', 'rear_hook'],
  ['lead', 'uppercut', 'lead_uppercut'],
  ['rear', 'uppercut', 'rear_uppercut'],
];

describe.each<Stance>(['orthodox', 'southpaw'])('punch classes, %s', (stance) => {
  const leadSide = stance === 'orthodox' ? 'left' : 'right';

  it.each(LABELS)('labels a %s %s as %s', (hand, shape, label) => {
    const { punches } = run({ stance, punches: [{ hand, shape, at: 2000 }] });
    expect(punches.map((p) => p.punch)).toEqual([label]);
    expect(punches[0].hand).toBe(hand);
    expect(punches[0].side).toBe(hand === 'lead' ? leadSide : leadSide === 'left' ? 'right' : 'left');
    expect(punches[0].confidence).toBeGreaterThan(0.45);
  });

  it.each(LABELS)('labels a %s %s as %s through noise', (hand, shape, label) => {
    const { punches } = run({ stance, noise: 0.006, punches: [{ hand, shape, at: 2000 }] });
    expect(punches.map((p) => p.punch)).toEqual([label]);
  });

  it.each(LABELS)('labels a %s %s as %s at 15 fps', (hand, shape, label) => {
    // At 15 fps the smoothing swallows a quick dip, so this is a slower punch
    const { punches } = run({ stance, fps: 15, punches: [{ hand, shape, at: 2000, dipMs: 300, outMs: 260 }] });
    expect(punches.map((p) => p.punch)).toEqual([label]);
  });

  it.each<[HandName, string]>([
    ['lead', 'lead_uppercut'],
    ['rear', 'rear_uppercut'],
  ])('labels a %s uppercut with a slow dip as %s', (hand, label) => {
    const { punches } = run({ stance, punches: [{ hand, shape: 'uppercut', at: 2000, dipMs: 400 }] });
    expect(punches.map((p) => p.punch)).toEqual([label]);
  });

  it('counts a 1-2-3 in order', () => {
    const { punches } = run({
      stance,
      punches: [
        { hand: 'lead', shape: 'straight', at: 1800 },
        { hand: 'rear', shape: 'straight', at: 2150 },
        { hand: 'lead', shape: 'hook', at: 2550 },
      ],
    });
    expect(punches.map((p) => p.punch)).toEqual(['jab', 'cross', 'lead_hook']);
  });
});

describe('form checks', () => {
  const jab = { hand: 'lead' as const, shape: 'straight' as const, at: 2000 };
  const cross = { hand: 'rear' as const, shape: 'straight' as const, at: 2000 };
  const hook = { hand: 'lead' as const, shape: 'hook' as const, at: 2000 };

  it('passes clean punches of every class', () => {
    for (const [hand, shape] of LABELS) {
      const { punches, form } = run({ punches: [{ hand, shape, at: 2000 }] });
      expect(punches[0].issues).toEqual([]);
      expect(form).toEqual([]);
    }
  });

  it('flags the rear hand leaving guard during a jab', () => {
    const { punches } = run({ punches: [{ ...jab, otherHandDrops: true }] });
    expect(punches[0].issues).toContain('other_hand_left_guard');
    expect(punches[0].hand).toBe('lead');
  });

  it('flags the lead hand leaving guard during a cross', () => {
    const { punches } = run({ punches: [{ ...cross, otherHandDrops: true }] });
    expect(punches[0].issues).toContain('other_hand_left_guard');
    expect(punches[0].hand).toBe('rear');
  });

  it('flags a hand that does not come back within a beat', () => {
    const { punches, form } = run({ punches: [{ ...jab, neverReturns: true }] });
    expect(punches).toHaveLength(1);
    expect(form).toEqual([expect.objectContaining({ issue: 'slow_return', punchId: punches[0].id, hand: 'lead' })]);
  });

  it('does not flag a hand that comes back in time', () => {
    const { form } = run({ punches: [{ ...jab, backMs: 350 }] });
    expect(form.filter((f) => f.issue === 'slow_return')).toEqual([]);
  });

  it('flags a chin exposed by the other hand already being low', () => {
    const { punches } = run({ lowHands: ['rear'], punches: [jab] });
    expect(punches[0].issues).toContain('chin_exposed');
    expect(punches[0].issues).not.toContain('other_hand_left_guard');
  });

  it('flags hands dropped between punches, but only while punching', () => {
    const active = run({
      durationMs: 4000,
      handOffset: (side, t) => (side === 'right' && t > 3000 ? [0.05, 0.4, 0.05] : [0, 0, 0]),
      punches: [jab],
    });
    expect(active.form.some((f) => f.issue === 'chin_exposed' && f.punchId === null && f.hand === 'rear')).toBe(true);

    const idle = run({ lowHands: ['lead', 'rear'], durationMs: 4000 });
    expect(idle.events).toEqual([]);
  });

  it('flags a straight that stops short', () => {
    const { punches } = run({ punches: [{ ...cross, bentArm: true }] });
    expect(punches[0].punch).toBe('cross');
    expect(punches[0].metrics.elbow).toBeLessThan(140);
    expect(punches[0].issues).toContain('arm_not_extended');
  });

  it('flags a flared elbow on a hook', () => {
    const { punches } = run({ punches: [{ ...hook, flaredElbow: true }] });
    expect(punches[0].punch).toBe('lead_hook');
    expect(punches[0].issues).toContain('elbow_flare');
  });

  it('flags a cross with no rotation', () => {
    const { punches } = run({ punches: [{ ...cross, noRotation: true }] });
    expect(punches[0].punch).toBe('cross');
    expect(punches[0].issues).toContain('no_rotation');
    expect(run({ punches: [cross] }).punches[0].issues).not.toContain('no_rotation');
  });

  it('flags no rotation for a southpaw too, and not when they turn', () => {
    const stance: Stance = 'southpaw';
    expect(run({ stance, punches: [{ ...cross, noRotation: true }] }).punches[0].issues).toContain('no_rotation');
    expect(run({ stance, punches: [cross] }).punches[0].issues).not.toContain('no_rotation');
  });
});

describe('classifier', () => {
  const straightish = {
    reach: 0.6,
    elbow: 80,
    elbowHeldMax: 90,
    elbowOpening: 0,
    forwardShare: 0.1,
    upShare: 0.5,
    armAcross: 0.1,
    armAcrossShare: 0.1,
    outwardShare: 0,
    rise: 0.3,
    startBelowShoulder: 0,
    forearmFromVertical: 40,
    forearmFromLevel: 50,
    upperArmBelowLevel: 50,
    visibility: 0.95,
    pathBend: 0,
    viewYaw: 0,
  };
  const trueUppercut = {
    ...straightish,
    upShare: 0.9,
    rise: 0.9,
    startBelowShoulder: 0.5,
    elbowHeldMax: 100,
    forearmFromVertical: 15,
  };
  const trueHook = {
    ...straightish,
    elbow: 95,
    elbowHeldMax: 105,
    armAcross: 0.9,
    armAcrossShare: 0.8,
    upShare: 0.05,
    rise: 0,
    forearmFromLevel: 15,
    upperArmBelowLevel: 15,
  };

  it('calls a fast punch a straight by default, and marks that depth was not readable', () => {
    const result = classifyPunch('rear', straightish);
    expect(result.punch).toBe('cross');
    expect(result.depthUnreliable).toBe(true);
    expect(classifyPunch('lead', straightish).punch).toBe('jab');
  });

  it('is sure of a straight when it can see a long arm', () => {
    const result = classifyPunch('lead', { ...straightish, reach: 0.95, elbow: 165, elbowHeldMax: 165 });
    expect(result.punch).toBe('jab');
    expect(result.confidence).toBeCloseTo(1);
    expect(result.depthUnreliable).toBe(false);
  });

  it('accepts an uppercut and a hook with all their evidence', () => {
    expect(classifyPunch('lead', trueUppercut).punch).toBe('lead_uppercut');
    expect(classifyPunch('rear', trueUppercut).punch).toBe('rear_uppercut');
    expect(classifyPunch('lead', trueHook).punch).toBe('lead_hook');
    expect(classifyPunch('rear', trueHook).punch).toBe('rear_hook');
  });

  it.each([
    ['started at shoulder height', { startBelowShoulder: 0 }],
    ['elbow opened during the rise', { elbowOpening: 50 }],
    ['elbow straightened on the way', { elbowHeldMax: 155 }],
    ['forearm not vertical at the peak', { forearmFromVertical: 55 }],
    ['barely rose', { rise: 0.3 }],
  ])('rejects an uppercut that %s', (_name, change) => {
    expect(classifyPunch('lead', { ...trueUppercut, ...change }).punch).toBe('jab');
  });

  it.each([
    ['elbow opened during the arc', { elbowOpening: 70 }],
    ['elbow straightened on the way', { elbowHeldMax: 150 }],
    ['elbow folded shut', { elbow: 25 }],
    ['upper arm hanging down', { upperArmBelowLevel: 60 }],
    ['forearm not level', { forearmFromLevel: 55 }],
    ['little sideways travel', { armAcross: 0.15 }],
  ])('rejects a hook whose %s', (_name, change) => {
    expect(classifyPunch('rear', { ...trueHook, ...change }).punch).toBe('cross');
  });

  it('says "punch" for a hand pushed outward, which is not extending', () => {
    expect(classifyPunch('rear', { ...straightish, outwardShare: 0.9 }).punch).toBe('punch');
  });

  it('says "punch" when the arm is hard to see', () => {
    expect(classifyPunch('lead', { ...straightish, visibility: 0.4 }).punch).toBe('punch');
    expect(classifyPunch('lead', { ...trueHook, visibility: 0.3 }).punch).toBe('punch');
  });
});

/**
 * Real-camera failure, 2026-11-01: jabs came in as 5 and crosses as 4. With weak depth the model
 * puts a jab's wrist rising in the image with the elbow reading bent, and turns a cross's hip
 * rotation into a sideways sweep. Coordinates are metres from the middle of the shoulders.
 */
describe('regression: straights read as uppercuts and hooks', () => {
  const lerp = (a: number[], b: number[], k: number) => a.map((v, i) => v + (b[i] - v) * k) as [number, number, number];
  const progress = (t: number, at: number, ms: number) => {
    const out = Math.min(1, Math.max(0, (t - at) / ms));
    const back = Math.min(1, Math.max(0, (t - at - ms) / 260));
    return out * (1 - back);
  };

  // Lead hand: the guard reads level with the shoulder, then the wrist climbs with the elbow bent
  const jabAsFive = (stance: Stance) => (side: 'left' | 'right', t: number) => {
    const leadSide = stance === 'orthodox' ? 'left' : 'right';
    if (side !== leadSide) return null;
    const s = side === 'left' ? 1 : -1;
    const k = progress(t, 2000, 170);
    return {
      wrist: lerp([s * 0.15, 0, -0.34], [s * 0.1, -0.24, -0.38], k),
      elbow: lerp([s * 0.26, 0.2, -0.16], [s * 0.2, 0.08, -0.2], k),
    };
  };

  // Rear hand: it sweeps inward as the shoulders turn, with the elbow still reading bent
  const crossAsFour = (stance: Stance) => (side: 'left' | 'right', t: number) => {
    const rearSide = stance === 'orthodox' ? 'right' : 'left';
    if (side !== rearSide) return null;
    const s = side === 'left' ? 1 : -1;
    const k = progress(t, 2000, 170);
    return {
      wrist: lerp([s * 0.2, 0.02, -0.33], [s * -0.08, -0.03, -0.38], k),
      elbow: lerp([s * 0.3, 0.22, -0.14], [s * 0.2, 0.14, -0.14], k),
    };
  };

  describe.each<Stance>(['orthodox', 'southpaw'])('%s', (stance) => {
    const twist = (t: number) => {
      // The rear shoulder comes forward as the cross lands
      const sign = stance === 'orthodox' ? -1 : 1;
      return sign * 28 * progress(t, 2000, 170);
    };

    it('reads a jab whose wrist rises in the image as 1, not 5', () => {
      const { punches } = run({ stance, armOverride: jabAsFive(stance) });
      expect(punches.map((p) => p.punch)).toEqual(['jab']);
      expect(punches[0].metrics.rise).toBeGreaterThan(0.45);
      expect(punches[0].metrics.elbow).toBeLessThan(125);
    });

    it('reads a cross with a sweep from hip rotation as 2, not 4', () => {
      const { punches } = run({ stance, armOverride: crossAsFour(stance), twist });
      expect(punches.map((p) => p.punch)).toEqual(['cross']);
      expect(punches[0].metrics.elbow).toBeLessThan(125);
    });

    it('reads a jab from low hands as 1 when the elbow opens on the way up', () => {
      const leadSide = stance === 'orthodox' ? 'left' : 'right';
      const { punches } = run({
        stance,
        armOverride: (side, t) => {
          if (side !== leadSide) return null;
          const s = side === 'left' ? 1 : -1;
          const k = progress(t, 2000, 170);
          return {
            wrist: lerp([s * 0.2, 0.14, -0.2], [s * 0.1, -0.12, -0.5], k),
            elbow: lerp([s * 0.3, 0.26, -0.02], [s * 0.2, 0.0, -0.26], k),
          };
        },
      });
      expect(punches.map((p) => p.punch)).toEqual(['jab']);
      expect(punches[0].metrics.elbowOpening).toBeGreaterThan(35);
    });

    it.each<[HandName, Shape, string, number]>([
      ['lead', 'hook', 'lead_hook', 0.8],
      ['rear', 'hook', 'rear_hook', 0.8],
      ['lead', 'uppercut', 'lead_uppercut', 0.6],
      ['rear', 'uppercut', 'rear_uppercut', 0.6],
    ])('still reads a real %s %s with reduced depth as %s', (hand, shape, label, armDepth) => {
      const { punches } = run({ stance, armDepth, punches: [{ hand, shape, at: 2000 }] });
      expect(punches.map((p) => p.punch)).toEqual([label]);
    });

    it.each<[HandName, string]>([
      ['lead', 'jab'],
      ['rear', 'cross'],
    ])('reads a %s straight with weak depth as %s', (hand, label) => {
      const { punches } = run({ stance, armDepth: 0.5, punches: [{ hand, shape: 'straight', at: 2000 }] });
      expect(punches.map((p) => p.punch)).toEqual([label]);
    });
  });

  it('gives the punch to the hand the stance says, on the side the model calls left', () => {
    // The model is fed the unmirrored image, so the fighter's left is on the image's right
    const leftWristMoves = (side: 'left' | 'right', t: number) =>
      side === 'left' ? jabAsFive('orthodox')('left', t) : null;
    expect(run({ stance: 'orthodox', armOverride: leftWristMoves }).punches[0]).toMatchObject({ side: 'left', hand: 'lead', punch: 'jab' });
    const southpaw = run({ armOverride: leftWristMoves }, 'southpaw').punches[0];
    expect(southpaw).toMatchObject({ side: 'left', hand: 'rear', punch: 'cross' });
  });
});

/**
 * Shapes seen in a real recording, 2026-11-01. The landmarks here are synthetic, in the same units
 * as simulate()'s armOverride: metres from the middle of the shoulders, y down, z away from camera.
 * Seen by the model, a real uppercut dips deep and comes back up to about guard height, a real hook
 * swings out and down and then sweeps up with the elbow above the shoulder, and turning the body
 * drags the other hand back and returns it.
 */
describe('regression: shapes from a real recording', () => {
  type Key = [number, [number, number, number], [number, number, number]];
  /** Moves through keyframes of [time, wrist, elbow], with x given for the left arm and mirrored for the right. */
  const path = (armSide: 'left' | 'right', keys: Key[]) => (side: 'left' | 'right', t: number) => {
    if (side !== armSide) return null;
    const s = side === 'left' ? 1 : -1;
    const mirror = (p: [number, number, number]): [number, number, number] => [s * p[0], p[1], p[2]];
    if (t <= keys[0][0]) return { wrist: mirror(keys[0][1]), elbow: mirror(keys[0][2]) };
    for (let i = 1; i < keys.length; i += 1) {
      const [t0, w0, e0] = keys[i - 1];
      const [t1, w1, e1] = keys[i];
      if (t <= t1) {
        const k = (t - t0) / (t1 - t0);
        const mix = (a: number[], b: number[]) => a.map((v, j) => v + (b[j] - v) * k) as [number, number, number];
        return { wrist: mirror(mix(w0, w1)), elbow: mirror(mix(e0, e1)) };
      }
    }
    const last = keys[keys.length - 1];
    return { wrist: mirror(last[1]), elbow: mirror(last[2]) };
  };

  const GUARD: [[number, number, number], [number, number, number]] = [[0.17, -0.06, -0.4], [0.23, 0.19, -0.15]];
  const uppercutKeys = (at: number, holdMs = 200): Key[] => [
    [at, ...GUARD],
    [at + 200, [0.15, 0.5, -0.1], [0.23, 0.36, -0.08]],
    [at + 200 + holdMs, [0.15, 0.5, -0.1], [0.23, 0.36, -0.08]],
    [at + 400 + holdMs, [0.14, -0.12, -0.42], [0.19, 0.13, -0.19]],
    [at + 800 + holdMs, ...GUARD],
  ];
  const hookKeys = (at: number): Key[] => [
    [at, ...GUARD],
    [at + 220, [0.46, 0.27, -0.12], [0.42, 0.1, -0.1]],
    [at + 420, [0.05, -0.27, -0.25], [0.4, -0.2, -0.15]],
    [at + 900, ...GUARD],
  ];

  describe.each<[Stance, 'left' | 'right', 'right' | 'left']>([
    ['orthodox', 'left', 'right'],
    ['southpaw', 'right', 'left'],
  ])('%s', (stance, leadSide, rearSide) => {
    it('counts an uppercut that only comes back up to guard height, for both hands', () => {
      const lead = run({ stance, fps: 23, armOverride: path(leadSide, uppercutKeys(2000)) });
      expect(lead.punches.map((p) => p.punch)).toEqual(['lead_uppercut']);
      const rear = run({ stance, fps: 23, armOverride: path(rearSide, uppercutKeys(2000)) });
      expect(rear.punches.map((p) => p.punch)).toEqual(['rear_uppercut']);
    });

    it('counts a hook whose elbow rises above the shoulder as one punch, not its wind-up too', () => {
      const lead = run({ stance, fps: 23, armOverride: path(leadSide, hookKeys(2000)) });
      expect(lead.punches.map((p) => p.punch)).toEqual(['lead_hook']);
      expect(lead.punches[0].metrics.upperArmBelowLevel).toBeLessThan(0);
      const rear = run({ stance, fps: 23, armOverride: path(rearSide, hookKeys(2000)) });
      expect(rear.punches.map((p) => p.punch)).toEqual(['rear_hook']);
    });
  });

  it('does not let backward depth jitter on a still hand hide a straight from the other hand', () => {
    const { punches } = run({
      fps: 23,
      armOverride: (side, t) => {
        if (side === 'right') {
          const jitter = t >= 2050 && t < 2120 ? 0.2 : 0;
          return { wrist: [-0.17, -0.06, -0.4 + jitter], elbow: [-0.23, 0.19, -0.15] };
        }
        return path('left', [
          [2000, ...GUARD],
          [2120, [0.15, -0.2, -0.5], [0.25, 0.08, -0.22]],
          [2600, ...GUARD],
        ])(side, t);
      },
    });
    expect(punches.map((p) => p.punch)).toEqual(['jab']);
  });

  it('flags the other hand by where it sits against its own shoulder, not how far the turn carried it', () => {
    // The body turns and the guard hand swings a long way forward and across, but stays up
    const carried = run({
      fps: 23,
      armOverride: (side, t) => {
        if (side !== 'left') return null;
        const k = Math.min(1, Math.max(0, (t - 2000) / 170));
        return { wrist: [0.17 + 0.1 * k, -0.06, -0.4 + 0.1 * k], elbow: [0.23, 0.19, -0.15] };
      },
      punches: [{ hand: 'rear', shape: 'straight', at: 2000 }],
    });
    expect(carried.punches.map((p) => p.punch)).toEqual(['cross']);
    expect(carried.punches[0].issues).not.toContain('other_hand_left_guard');
  });

  it('does not count the other hand being dragged back by a body turn, or coming home after', () => {
    const { punches } = run({
      fps: 23,
      armOverride: path('right', [
        [2000, ...GUARD],
        [2200, [0.22, 0.06, -0.2], [0.25, 0.26, -0.05]],
        [2500, [0.22, 0.06, -0.2], [0.25, 0.26, -0.05]],
        [2750, ...GUARD],
      ]),
    });
    expect(punches).toEqual([]);
  });

  it('still does not count hands that were resting low coming up, however deep', () => {
    const { punches } = run({ fps: 23, durationMs: 5000, armOverride: path('left', uppercutKeys(2000, 1400)) });
    expect(punches).toEqual([]);
  });

  it('does not count a shallow dip and back as an uppercut', () => {
    const shallow: Key[] = [
      [2000, ...GUARD],
      [2200, [0.17, 0.2, -0.3], [0.23, 0.3, -0.1]],
      [2400, [0.17, 0.2, -0.3], [0.23, 0.3, -0.1]],
      [2600, ...GUARD],
    ];
    expect(run({ fps: 23, armOverride: path('left', shallow) }).punches).toEqual([]);
  });

  it('counts one jab when the wrist moves in steps at a low frame rate', () => {
    const steps: Key[] = [
      [2000, ...GUARD],
      [2045, [0.15, -0.16, -0.42], [0.23, 0.1, -0.17]],
      [2130, [0.15, -0.16, -0.42], [0.23, 0.1, -0.17]],
      [2175, [0.13, -0.18, -0.52], [0.22, 0.08, -0.24]],
      [2500, ...GUARD],
    ];
    expect(run({ fps: 23, armOverride: path('left', steps) }).punches.map((p) => p.punch)).toEqual(['jab']);
  });

  it('does not start a new punch on a wrist that is on its way home', () => {
    const { punches } = run({ fps: 23, punches: [{ hand: 'lead', shape: 'straight', at: 2000, backMs: 500 }] });
    expect(punches).toHaveLength(1);
  });

  it('keeps a punch that peaked well before a slow way home', () => {
    const { punches } = run({ fps: 23, armOverride: path('right', [...uppercutKeys(2000).slice(0, 4), [3400, ...GUARD]]) });
    expect(punches.map((p) => p.punch)).toEqual(['rear_uppercut']);
  });

  describe('when the model loses the pose for a moment', () => {
    // The shoulders appear to spin much faster than any body can turn, and both arms jump
    const spike = (at: number) => (t: number) => (t >= at && t < at + 90 ? 70 : 0);
    const jump = (at: number) => (side: 'left' | 'right', t: number) =>
      t >= at && t < at + 90 ? ({ wrist: [0, -0.1, 0.3], elbow: [side === 'left' ? 0.1 : -0.1, 0.1, 0.1] } as { wrist: [number, number, number]; elbow: [number, number, number] }) : null;

    it('counts nothing if the fighter was standing still', () => {
      const { punches } = run({ fps: 23, twist: spike(2500), armOverride: jump(2500) });
      expect(punches).toEqual([]);
    });

    it('keeps the punch that was under way, once, for the right hand', () => {
      const { punches } = run({
        fps: 23,
        twist: spike(2110),
        punches: [{ hand: 'rear', shape: 'straight', at: 2000 }],
      });
      expect(punches).toHaveLength(1);
      expect(punches[0].hand).toBe('rear');
    });
  });
});

describe('things that are not punches', () => {
  it('stays silent for a person standing with their guard up', () => {
    expect(run({ durationMs: 10000 }).events).toEqual([]);
  });

  it('stays silent for a person standing with their arms down', () => {
    expect(run({ armsDown: true, durationMs: 10000 }).events).toEqual([]);
  });

  it('stays silent through noise', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      expect(run({ durationMs: 10000, noise: 0.01, seed }).events).toEqual([]);
      expect(run({ armsDown: true, durationMs: 10000, noise: 0.01, seed }).events).toEqual([]);
    }
  });

  it('ignores the whole body moving', () => {
    const { events } = run({
      durationMs: 6000,
      sway: (t) => [0.12 * Math.sin(t / 150), 0.04 * Math.sin(t / 90), 0.1 * Math.cos(t / 200)],
    });
    expect(events).toEqual([]);
  });

  it('ignores a torso twist with the hands held still', () => {
    const { events } = run({ durationMs: 6000, twist: (t) => 28 * Math.sin(t / 250) });
    expect(events).toEqual([]);
  });

  it('ignores hands drifting slowly', () => {
    const { events } = run({
      durationMs: 6000,
      handOffset: (side, t) => [0, 0.2 * Math.sin(t / 1500), 0.15 * Math.sin(t / 1800)],
    });
    expect(events).toEqual([]);
  });

  it('ignores a small flick', () => {
    const { punches } = run({
      handOffset: (side, t) => (side === 'left' && t > 2000 && t < 2100 ? [0, 0, -0.09] : [0, 0, 0]),
    });
    expect(punches).toEqual([]);
  });

  it('ignores hands being raised from the sides', () => {
    const { punches } = run({
      armsDown: true,
      handOffset: (side, t) => {
        const k = Math.min(1, Math.max(0, (t - 2000) / 300));
        return [0, -0.6 * k, -0.15 * k];
      },
    });
    expect(punches).toEqual([]);
  });

  it('ignores the hands being dropped and brought straight back to guard', () => {
    const { punches } = run({
      handOffset: (side, t) => {
        const k = Math.min(1, Math.max(0, 1 - Math.abs(t - 2200) / 200));
        return [0, 0.35 * k, 0.05 * k];
      },
    });
    expect(punches).toEqual([]);
  });

  it('ignores hands being dropped from the guard', () => {
    const { punches } = run({
      handOffset: (side, t) => {
        const k = Math.min(1, Math.max(0, (t - 2000) / 200));
        return [0, 0.6 * k, 0.1 * k];
      },
    });
    expect(punches).toEqual([]);
  });
});

describe('long sessions', () => {
  const heldState = (detector: PunchDetector) => detector as unknown as Record<'left' | 'right', { samples: unknown[]; speedHistory: unknown[] }>;

  it('counts fast punches with the same hand when it never settles between them', () => {
    const punches = Array.from({ length: 20 }, (_, i) => ({ hand: 'lead' as const, shape: 'straight' as const, at: 2000 + i * 600, outMs: 150, backMs: 200 }));
    const { punches: seen } = run({ durationMs: 16000, punches });
    expect(seen.filter((p) => p.punch === 'jab')).toHaveLength(20);
  });

  it('counts punches from hands that keep moving between them', () => {
    // Fidgeting fast enough that the wrist never reads as settled
    const fidget = (side: 'left' | 'right', t: number): [number, number, number] => [0.03 * Math.sin(t / 40), 0.03 * Math.cos(t / 40), 0];
    const punches = Array.from({ length: 12 }, (_, i) => ({ hand: 'lead' as const, shape: 'straight' as const, at: 3000 + i * 1200 }));
    const { punches: seen } = run({ durationMs: 18000, punches, handOffset: fidget });
    expect(seen.filter((p) => p.punch === 'jab').length).toBeGreaterThanOrEqual(10);
  });

  it('holds a 30-minute workout at a steady cost, with bounded state, and no punches from rests', () => {
    const shapes: Shape[] = ['straight', 'hook', 'uppercut'];
    const minutes = 30;
    const punches = [];
    // Three minutes on, one minute off
    for (let t = 2000; t < minutes * 60000; t += 1500) {
      if (t % 240000 < 180000) punches.push({ hand: (t % 3000 < 1500 ? 'lead' : 'rear') as HandName, shape: shapes[Math.floor(t / 1500) % 3], at: t });
    }
    const frames = simulate({ durationMs: minutes * 60000, startMs: 1000, punches, noise: 0.004 });
    const detector = new PunchDetector('orthodox');
    const ids = new Set<number>();
    let seen = 0;
    let largest = 0;
    let duringRest = 0;
    const stepMs: number[] = [];
    frames.forEach((frame, i) => {
      const before = performance.now();
      const events = detector.push(frame);
      if (i % 1000 === 0) stepMs.push(performance.now() - before);
      for (const event of events) {
        if (event.type !== 'punch') continue;
        seen += 1;
        ids.add(event.id);
        if (event.t % 240000 > 181000 && event.t % 240000 < 239000) duringRest += 1;
      }
      const state = heldState(detector);
      largest = Math.max(largest, state.left.samples.length, state.right.samples.length, state.left.speedHistory.length, state.right.speedHistory.length);
    });
    expect(frames.length).toBeGreaterThan(50000);
    expect(seen).toBeGreaterThan(punches.length * 0.8);
    expect(ids.size).toBe(seen);
    expect(duringRest).toBe(0);
    expect(largest).toBeLessThan(100);
  }, 60000);

  it('gives up on a wrist that keeps drifting out at speed, and carries on', () => {
    const detector = new PunchDetector('orthodox');
    const state = heldState(detector);
    let longest = 0;
    for (const frame of simulate({ durationMs: 30000, handOffset: (side, t) => (side === 'left' && t > 2000 ? [0, 0, -((t - 2000) / 1000) * 0.4] : [0, 0, 0]) })) {
      detector.push(frame);
      longest = Math.max(longest, state.left.samples.length);
    }
    expect(longest).toBeLessThan(120);
  });

  it('ignores a frame that arrives out of order', () => {
    const detector = new PunchDetector('orthodox');
    const frames = simulate({ punches: [{ hand: 'lead', shape: 'straight', at: 2000 }] });
    const events: PunchEvent[] = [];
    frames.forEach((frame, i) => {
      events.push(...detector.push(frame));
      if (i % 10 === 5) events.push(...detector.push({ t: frame.t - 500, landmarks: frame.landmarks }));
    });
    expect(events.filter((e) => e.type === 'punch')).toHaveLength(1);
  });

  it('survives tracking coming and going all session', () => {
    const { punches } = run({
      durationMs: 120000,
      dropFrame: (t) => t % 7000 > 6000,
      punches: Array.from({ length: 40 }, (_, i) => ({ hand: 'lead' as const, shape: 'straight' as const, at: 2000 + i * 2800 })),
    });
    expect(punches.length).toBeGreaterThan(20);
  });
});

describe('missing data', () => {
  const jab = { hand: 'lead' as const, shape: 'straight' as const, at: 2500 };

  it('returns nothing and does not throw on empty frames', () => {
    const detector = new PunchDetector('orthodox');
    for (let t = 0; t < 2000; t += 33) expect(detector.push({ t, landmarks: null })).toEqual([]);
    expect(detector.push({ t: 2100, landmarks: [] })).toEqual([]);
  });

  it('survives frames with non-finite coordinates', () => {
    const frames = simulate({ punches: [jab] });
    const detector = new PunchDetector('orthodox');
    const events: PunchEvent[] = [];
    frames.forEach((frame, i) => {
      const landmarks = frame.landmarks!.map((p) => (i % 20 === 0 ? { ...p, x: NaN } : p));
      events.push(...detector.push({ t: frame.t, landmarks }));
    });
    expect(events.filter((e) => e.type === 'punch')).toHaveLength(1);
  });

  it('still sees a punch through a few dropped frames before it', () => {
    const { punches } = run({ punches: [jab], dropFrame: (t) => t > 2100 && t < 2200 });
    expect(punches.map((p) => p.punch)).toEqual(['jab']);
  });

  it('does not invent a punch when the person vanishes and comes back somewhere else', () => {
    const { punches } = run({
      durationMs: 5000,
      dropFrame: (t) => t > 2500 && t < 3500,
      sway: (t) => (t >= 3500 ? [0.3, 0, 0.2] : [0, 0, 0]),
      handOffset: (side, t) => (t >= 3500 ? [0, 0.3, -0.3] : [0, 0, 0]),
    });
    expect(punches).toEqual([]);
  });

  it('reports nothing for a wrist it cannot see, and does not flag a return it could not watch', () => {
    const { punches, form } = run({
      punches: [{ ...jab, neverReturns: true }],
      visibility: (index, t) => (index === 15 && t > 2300 ? 0.1 : 0.95),
    });
    expect(punches.length).toBeLessThanOrEqual(1);
    expect(form.filter((f) => f.issue === 'slow_return')).toEqual([]);
  });

  it('says "punch" rather than guess when visibility is poor', () => {
    const { punches } = run({
      punches: [jab],
      visibility: (index) => ([13, 14, 15, 16].includes(index) ? 0.52 : 0.95),
    });
    expect(punches).toHaveLength(1);
    expect(punches[0].confidence).toBeLessThan(1);
  });

  it('says "punch" when the movement is not an extension', () => {
    // A half-bent arm pushed out to the side isn't a straight, a hook or an uppercut
    const detector = new PunchDetector('orthodox');
    const events: PunchEvent[] = [];
    const frames = simulate({
      durationMs: 3000,
      handOffset: (side, t) => {
        if (side !== 'left') return [0, 0, 0];
        const k = Math.min(1, Math.max(0, (t - 2000) / 170));
        return [0.3 * k, 0, -0.12 * k];
      },
    });
    for (const frame of frames) events.push(...detector.push(frame));
    const punches = events.filter((e): e is PunchDetected => e.type === 'punch');
    expect(punches).toHaveLength(1);
    expect(punches[0].punch).toBe('punch');
  });
});
