import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cameraProblemFrom, assessFraming, checkSupport, FramingMonitor, meanLumaOf } from '@/lib/punch/framing';
import { applyEvent, comboReadout, CueQueue, cueFor, newRound, punchWord, summarize, summaryNote } from '@/lib/punch/round';
import { LM } from '@/lib/punch/body';
import type { FormIssue, Landmark, PunchClass, PunchDetected } from '@/lib/punch/types';

const punchEvent = (id: number, t: number, punch: PunchClass, issues: FormIssue[] = []): PunchDetected => ({
  type: 'punch',
  id,
  t,
  side: 'left',
  hand: 'lead',
  punch,
  confidence: 0.9,
  issues,
  metrics: {
    distance: 1,
    peakSpeed: 5,
    durationMs: 150,
    reach: 0.9,
    elbow: 160,
    elbowHeldMax: 160,
    elbowOpening: 60,
    forwardShare: 0.9,
    armAcross: 0.1,
    upShare: 0.1,
    rise: 0.1,
    startBelowShoulder: 0,
    forearmFromVertical: 80,
    forearmFromLevel: 10,
    upperArmBelowLevel: 10,
    shoulderRotation: 20,
    hipRotation: 10,
    scores: { straight: 1, hook: 0, uppercut: 0, byElimination: false },
  },
});

describe('round tally', () => {
  it('counts per punch, percent clean and the top fix', () => {
    const round = newRound();
    applyEvent(round, punchEvent(1, 1000, 'jab'));
    applyEvent(round, punchEvent(2, 1300, 'cross', ['no_rotation']));
    applyEvent(round, punchEvent(3, 5000, 'lead_hook', ['elbow_flare']));
    applyEvent(round, { type: 'form', t: 5800, punchId: 3, hand: 'lead', issue: 'slow_return' });
    applyEvent(round, { type: 'form', t: 6000, punchId: 1, hand: 'lead', issue: 'slow_return' });
    applyEvent(round, punchEvent(4, 9000, 'punch'));

    const summary = summarize(round);
    expect(summary.total).toBe(4);
    expect(summary.counts).toMatchObject({ jab: 1, cross: 1, lead_hook: 1, punch: 1, rear_hook: 0 });
    expect(summary.cleanPercent).toBe(25);
    expect(summary.topFix?.issue).toBe('slow_return');
    expect(summary.topFix?.count).toBe(2);
    expect(summaryNote(summary)).toContain('4 punches. 25% clean. Jab 1, Cross 1, Lead hook 1, Punch 1. Top fix:');
  });

  it('counts a punch once however many issues it has', () => {
    const round = newRound();
    applyEvent(round, punchEvent(1, 1000, 'jab', ['arm_not_extended', 'chin_exposed']));
    applyEvent(round, punchEvent(2, 2000, 'jab'));
    expect(summarize(round).cleanPercent).toBe(50);
  });

  it('keeps between-punch issues out of the clean percent but counts them as fixes', () => {
    const round = newRound();
    applyEvent(round, punchEvent(1, 1000, 'jab'));
    applyEvent(round, { type: 'form', t: 2000, punchId: null, hand: 'rear', issue: 'chin_exposed' });
    const summary = summarize(round);
    expect(summary.cleanPercent).toBe(100);
    expect(summary.topFix?.issue).toBe('chin_exposed');
  });

  it('has no percentage and no fix for an empty round', () => {
    const summary = summarize(newRound());
    expect(summary.cleanPercent).toBeNull();
    expect(summary.topFix).toBeNull();
    expect(summaryNote(summary)).toBe('0 punches');
  });

  it('says "1 punch", not "1 punches"', () => {
    const round = newRound();
    applyEvent(round, punchEvent(1, 1000, 'jab'));
    expect(summaryNote(summarize(round))).toMatch(/^1 punch\./);
  });

  it('uses the right word for a count', () => {
    expect([0, 1, 2].map(punchWord)).toEqual(['punches', 'punch', 'punches']);
  });

  it('keeps a combo readout short however long the combo runs, and still counts it', () => {
    const round = newRound();
    for (let i = 0; i < 2000; i += 1) applyEvent(round, punchEvent(i, 1000 + i * 500, 'jab'));
    expect(round.combo.length).toBeLessThanOrEqual(8);
    expect(comboReadout(round, 1000 + 1999 * 500)).toBe('1-1-1-1-1-1-1-1');
    expect(summarize(round).longestCombo).toBe(2000);
  });

  it('reads combos in the app numbering and starts over after a gap', () => {
    const round = newRound();
    applyEvent(round, punchEvent(1, 1000, 'jab'));
    applyEvent(round, punchEvent(2, 1400, 'cross'));
    applyEvent(round, punchEvent(3, 1900, 'lead_hook'));
    expect(comboReadout(round, 2000)).toBe('1-2-3');
    applyEvent(round, punchEvent(4, 2300, 'punch'));
    expect(comboReadout(round, 2400)).toBe('1-2-3-?');
    expect(comboReadout(round, 2300 + 2401)).toBe('');
    applyEvent(round, punchEvent(5, 6000, 'rear_uppercut'));
    expect(comboReadout(round, 6100)).toBe('6');
    expect(summarize(round).longestCombo).toBe(4);
  });
});

describe('cues', () => {
  it('names the right hand', () => {
    expect(cueFor('other_hand_left_guard', 'rear')).toBe('Rear hand up');
    expect(cueFor('other_hand_left_guard', 'lead')).toBe('Lead hand up');
    expect(cueFor('slow_return', 'lead')).toBe('Bring it back');
    expect(cueFor('chin_exposed', 'rear')).toBe('Hands up');
  });

  it('shows one at a time, holds it, then moves on', () => {
    const cues = new CueQueue();
    cues.offer('Hands up', 0);
    expect(cues.read(0)).toBe('Hands up');
    cues.offer('Bring it back', 100);
    expect(cues.read(100)).toBe('Hands up');
    expect(cues.read(1700)).toBe('Bring it back');
    expect(cues.read(3400)).toBeNull();
  });

  it('keeps only the newest waiting cue', () => {
    const cues = new CueQueue();
    cues.offer('Hands up', 0);
    cues.read(0);
    cues.offer('Elbow in', 100);
    cues.offer('Bring it back', 200);
    expect(cues.read(1700)).toBe('Bring it back');
  });

  it('does not repeat a cue straight away', () => {
    const cues = new CueQueue();
    cues.offer('Hands up', 0);
    cues.read(0);
    cues.offer('Hands up', 2000);
    expect(cues.read(2000)).toBeNull();
    cues.offer('Hands up', 4100);
    expect(cues.read(4100)).toBe('Hands up');
  });
});

describe('framing', () => {
  const person = (overrides: Partial<Record<number, Partial<Landmark>>> = {}) => {
    const points: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.95 }));
    points[LM.NOSE] = { x: 0.5, y: 0.2, z: 0, visibility: 0.95 };
    points[LM.LEFT_SHOULDER] = { x: 0.6, y: 0.35, z: 0, visibility: 0.95 };
    points[LM.RIGHT_SHOULDER] = { x: 0.4, y: 0.35, z: 0, visibility: 0.95 };
    points[LM.LEFT_HIP] = { x: 0.55, y: 0.75, z: 0, visibility: 0.95 };
    points[LM.RIGHT_HIP] = { x: 0.45, y: 0.75, z: 0, visibility: 0.95 };
    for (const [index, change] of Object.entries(overrides)) {
      points[Number(index)] = { ...points[Number(index)], ...change };
    }
    return points;
  };

  it('accepts a well placed person', () => {
    expect(assessFraming(person(), 120)).toBe('ok');
  });

  it('reports each problem', () => {
    expect(assessFraming(null, 120)).toBe('no_person');
    expect(assessFraming(person(), 12)).toBe('too_dark');
    expect(assessFraming(person({ [LM.LEFT_HIP]: { y: 1.1 } }), 120)).toBe('out_of_frame');
    expect(assessFraming(person({ [LM.NOSE]: { y: -0.05 } }), 120)).toBe('head_cut');
    expect(assessFraming(person({ [LM.LEFT_SHOULDER]: { x: 0.98 }, [LM.RIGHT_SHOULDER]: { x: 0.1 } }), 120)).toBe('too_close');
    expect(
      assessFraming(person({ [LM.LEFT_SHOULDER]: { x: 0.52 }, [LM.RIGHT_SHOULDER]: { x: 0.49 }, [LM.LEFT_HIP]: { y: 0.4 }, [LM.RIGHT_HIP]: { y: 0.4 } }), 120),
    ).toBe('too_far');
    // Side on the shoulders line up, or even swap, and that isn't a problem any more
    expect(assessFraming(person({ [LM.LEFT_SHOULDER]: { x: 0.52 }, [LM.RIGHT_SHOULDER]: { x: 0.49 } }), 120)).toBe('ok');
    expect(assessFraming(person({ [LM.LEFT_SHOULDER]: { x: 0.4 }, [LM.RIGHT_SHOULDER]: { x: 0.6 } }), 120)).toBe('ok');
    const dim = person();
    for (const index of [LM.NOSE, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_ELBOW, LM.RIGHT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_WRIST]) {
      dim[index] = { ...dim[index], visibility: 0.1 };
    }
    expect(assessFraming(dim, 120)).toBe('low_confidence');
  });

  it('measures brightness', () => {
    expect(meanLumaOf([0, 0, 0, 255, 0, 0, 0, 255])).toBe(0);
    expect(meanLumaOf([255, 255, 255, 255])).toBeCloseTo(255);
    expect(meanLumaOf([])).toBe(0);
  });

  it('waits before showing a problem and before clearing it', () => {
    const monitor = new FramingMonitor();
    expect(monitor.push('too_far', 0)).toBe('ok');
    expect(monitor.push('too_far', 500)).toBe('ok');
    expect(monitor.push('too_far', 700)).toBe('too_far');
    expect(monitor.push('ok', 800)).toBe('too_far');
    expect(monitor.push('ok', 1200)).toBe('ok');
  });

  it('ignores a one-frame blip', () => {
    const monitor = new FramingMonitor();
    monitor.push('ok', 0);
    expect(monitor.push('no_person', 33)).toBe('ok');
    expect(monitor.push('ok', 66)).toBe('ok');
    expect(monitor.push('ok', 1000)).toBe('ok');
  });
});

describe('camera problems', () => {
  it('maps getUserMedia errors', () => {
    const named = (name: string) => Object.assign(new Error(name), { name });
    expect(cameraProblemFrom(named('NotAllowedError'))).toBe('denied');
    expect(cameraProblemFrom(named('NotFoundError'))).toBe('no_camera');
    expect(cameraProblemFrom(named('OverconstrainedError'))).toBe('no_camera');
    expect(cameraProblemFrom(named('NotReadableError'))).toBe('in_use');
    expect(cameraProblemFrom(named('Whatever'))).toBe('unknown');
    expect(cameraProblemFrom(null)).toBe('unknown');
  });

  it('checks support', () => {
    const ok = { hasGetUserMedia: true, hasWebAssembly: true, hasWebGL2: true, isSecureContext: true };
    expect(checkSupport(ok)).toBeNull();
    expect(checkSupport({ ...ok, hasWebAssembly: false })).toBe('unsupported');
    expect(checkSupport({ ...ok, hasWebGL2: false })).toBe('unsupported');
    expect(checkSupport({ ...ok, hasGetUserMedia: false })).toBe('unsupported');
    expect(checkSupport({ ...ok, isSecureContext: false, hasGetUserMedia: false })).toBe('insecure');
  });
});

describe('bundled pose model', () => {
  it('ships wasm from the pinned package version', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const notice = readFileSync('public/mediapipe/NOTICE.txt', 'utf8');
    const pinned = pkg.dependencies['@mediapipe/tasks-vision'];
    expect(pinned).toMatch(/^\d+\.\d+\.\d+$/);
    expect(notice).toContain(`@mediapipe/tasks-vision ${pinned}`);
  });
});
