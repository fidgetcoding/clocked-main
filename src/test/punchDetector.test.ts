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
  const features = {
    reach: 0.8,
    elbow: 130,
    forwardShare: 0.6,
    acrossShare: 0.5,
    upShare: 0.1,
    outwardShare: 0,
    rise: 0.1,
    visibility: 0.95,
  };

  it('says "punch" when two shapes score about the same', () => {
    const scores = scoreShapes(features);
    expect(scores.straight).toBeGreaterThan(0);
    expect(scores.hook).toBeGreaterThan(0);
    expect(classifyPunch('lead', features).punch).toBe('punch');
  });

  it('calls a fast punch with no arc a straight, but marks that depth was not readable', () => {
    const result = classifyPunch('rear', {
      ...features,
      reach: 0.4,
      elbow: 70,
      forwardShare: 0.1,
      acrossShare: 0,
      upShare: 0.5,
      rise: 0.3,
    });
    expect(result.punch).toBe('cross');
    expect(result.confidence).toBeLessThan(0.7);
    expect(result.depthUnreliable).toBe(true);
  });

  it('says "punch" when nothing fits', () => {
    const result = classifyPunch('rear', { ...features, reach: 0.4, elbow: 100, acrossShare: 0, upShare: 0, outwardShare: 0.8 });
    expect(result.punch).toBe('punch');
    expect(result.confidence).toBe(0);
  });

  it('loses confidence when the arm is hard to see', () => {
    const clear = { reach: 0.95, elbow: 170, forwardShare: 0.95, acrossShare: 0, upShare: 0, outwardShare: 0, rise: 0 };
    expect(classifyPunch('lead', { ...clear, visibility: 0.95 }).punch).toBe('jab');
    expect(classifyPunch('lead', { ...clear, visibility: 0.3 }).punch).toBe('punch');
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
      handOffset: (side, t) => (side === 'left' && t > 2000 && t < 2100 ? [0, 0, -0.14] : [0, 0, 0]),
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

  it('says "punch" when the shape is ambiguous', () => {
    // A half-bent arm pushed out and forward is not clearly a straight, a hook or an uppercut
    const detector = new PunchDetector('orthodox');
    const events: PunchEvent[] = [];
    const frames = simulate({
      durationMs: 3000,
      handOffset: (side, t) => {
        if (side !== 'left') return [0, 0, 0];
        const k = Math.min(1, Math.max(0, (t - 2000) / 170));
        return [0.24 * k, 0, -0.22 * k];
      },
    });
    for (const frame of frames) events.push(...detector.push(frame));
    const punches = events.filter((e): e is PunchDetected => e.type === 'punch');
    expect(punches).toHaveLength(1);
    expect(punches[0].punch).toBe('punch');
  });
});
