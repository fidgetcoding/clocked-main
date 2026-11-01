import { describe, expect, it } from 'vitest';
import { BodyTracker, LM, pictureLength, seenLength } from '@/lib/punch/body';
import { classifyPunch } from '@/lib/punch/classify';
import { PunchDetector } from '@/lib/punch/detector';
import { assessFraming } from '@/lib/punch/framing';
import { emptyPunchLog, parsePunchLog, roundFromLog, SessionPunchLog } from '@/lib/punch/sessionLog';
import { cameraAngleFromReading, describeCamera, placementAdvice, StartCheck, type StartCheckResult } from '@/lib/punch/startCheck';
import type { Landmark, PoseFrame, PunchDetected, PunchEvent } from '@/lib/punch/types';
import { simulate } from './punchSynth';

const turnFrame = (frame: PoseFrame, degrees: number): PoseFrame => {
  const r = (degrees * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  // World z points away from the camera, so turning the body toward +yaw brings its left side nearer
  return { ...frame, landmarks: frame.landmarks && frame.landmarks.map((p) => ({ ...p, x: p.x * c + p.z * s, z: -p.x * s + p.z * c })) };
};

const punchesIn = (frames: PoseFrame[]) => {
  const detector = new PunchDetector('orthodox');
  return frames.flatMap((frame) => detector.push(frame)).filter((event): event is PunchDetected => event.type === 'punch');
};

const session = () =>
  simulate({
    stance: 'orthodox',
    startMs: 1000,
    durationMs: 12000,
    punches: [
      { hand: 'lead', shape: 'straight', at: 4000 },
      { hand: 'rear', shape: 'straight', at: 6000 },
      { hand: 'rear', shape: 'hook', at: 8000 },
      { hand: 'lead', shape: 'uppercut', at: 10000 },
    ],
  });

const shape = {
  reach: 0.9,
  elbow: 150,
  elbowHeldMax: 150,
  elbowOpening: 60,
  forwardShare: 0.8,
  upShare: 0.1,
  armAcross: 0.1,
  armAcrossShare: 0.1,
  outwardShare: 0,
  rise: 0.1,
  startBelowShoulder: 0,
  forearmFromVertical: 60,
  forearmFromLevel: 20,
  upperArmBelowLevel: 10,
  visibility: 0.95,
  pathBend: 0,
  viewYaw: 0,
};

describe('the fighter\'s own frame of reference', () => {
  it('reads the same punches wherever the camera is', () => {
    const front = punchesIn(session());
    expect(front.map((punch) => punch.punch)).toEqual(['jab', 'cross', 'rear_hook', 'lead_uppercut']);
    for (const degrees of [-50, -35, -20, 20, 35, 50]) {
      const turned = punchesIn(session().map((frame) => turnFrame(frame, degrees)));
      expect(turned.map((punch) => punch.hand)).toEqual(front.map((punch) => punch.hand));
      expect(turned.map((punch) => punch.t)).toEqual(front.map((punch) => punch.t));
      for (const [i, punch] of turned.entries()) {
        expect(punch.metrics.armAcross).toBeCloseTo(front[i].metrics.armAcross, 1);
        expect(punch.metrics.rise).toBeCloseTo(front[i].metrics.rise, 1);
      }
    }
  });

  it('knows which way the fighter is turned', () => {
    const read = (degrees: number) => {
      const tracker = new BodyTracker();
      let yaw = 0;
      for (const frame of session().map((f) => turnFrame(f, degrees)).slice(0, 60)) {
        const pose = tracker.push(frame.t, frame.landmarks as Landmark[]);
        if (pose) yaw = pose.viewYaw;
      }
      return yaw;
    };
    expect(read(0)).toBeCloseTo(0, 0);
    expect(read(40)).toBeCloseTo(40, 0);
    expect(read(-40)).toBeCloseTo(-40, 0);
  });

  it('still works with the head or the hips out of the picture', () => {
    const hide = (indices: number[]) => (frame: PoseFrame): PoseFrame => ({
      ...frame,
      landmarks: frame.landmarks && frame.landmarks.map((p, i) => (indices.includes(i) ? { ...p, visibility: 0.1 } : p)),
    });
    const noHead = punchesIn(session().map(hide([LM.NOSE, LM.MOUTH_LEFT, LM.MOUTH_RIGHT])));
    expect(noHead.length).toBe(4);
    const noHips = punchesIn(session().map(hide([LM.LEFT_HIP, LM.RIGHT_HIP])));
    expect(noHips.length).toBe(4);
  });

  it('only counts depth moving toward the camera', () => {
    const camera = { x: 0, y: 0, z: 1 };
    expect(seenLength({ x: 0, y: 0, z: -1 }, camera)).toBe(0);
    expect(seenLength({ x: 0, y: 0, z: 1 }, camera)).toBe(1);
    expect(pictureLength({ x: 3, y: 4, z: 9 }, camera)).toBe(5);
    // Side on, the same rule applies along their sideways axis
    const fromTheLeft = { x: 1, y: 0, z: 0 };
    expect(seenLength({ x: -1, y: 0, z: 0 }, fromTheLeft)).toBe(0);
    expect(seenLength({ x: 0, y: 0, z: 1 }, fromTheLeft)).toBe(1);
  });
});

describe('saying "punch" when it can\'t tell', () => {
  it('names a straight from the front however its path bowed, since a head-on path is too short to judge', () => {
    expect(classifyPunch('lead', { ...shape, pathBend: 0.4 }).punch).toBe('jab');
  });

  it('calls a bowed "straight" just "punch" off-axis, since it could be a hook', () => {
    expect(classifyPunch('lead', { ...shape, viewYaw: 30, pathBend: 0.05 }).punch).toBe('jab');
    expect(classifyPunch('lead', { ...shape, viewYaw: 30, pathBend: 0.3 }).punch).toBe('punch');
  });

  it('counts punches but names nothing side on, where the arms can\'t be told apart', () => {
    const result = classifyPunch('rear', { ...shape, viewYaw: 75 });
    expect(result.punch).toBe('punch');
    expect(result.handUnsure).toBe(true);
    expect(classifyPunch('rear', { ...shape, viewYaw: 30 }).handUnsure).toBe(false);
  });
});

describe('one punch seen on both arms', () => {
  it('counts once off-axis and twice from the front', () => {
    const frames = simulate({
      stance: 'orthodox',
      startMs: 1000,
      durationMs: 8000,
      punches: [{ hand: 'lead', shape: 'straight', at: 4000 }, { hand: 'rear', shape: 'straight', at: 4020 }],
    });
    expect(punchesIn(frames).length).toBe(2);
    expect(punchesIn(frames.map((frame) => turnFrame(frame, 35))).length).toBe(1);
  });
});

describe('framing from any angle', () => {
  const person = (overrides: Record<number, Partial<Landmark>> = {}) => {
    const points: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.95 }));
    points[LM.NOSE] = { x: 0.5, y: 0.2, z: 0, visibility: 0.95 };
    points[LM.LEFT_SHOULDER] = { x: 0.6, y: 0.35, z: 0, visibility: 0.95 };
    points[LM.RIGHT_SHOULDER] = { x: 0.4, y: 0.35, z: 0, visibility: 0.95 };
    points[LM.LEFT_HIP] = { x: 0.55, y: 0.75, z: 0, visibility: 0.95 };
    points[LM.RIGHT_HIP] = { x: 0.45, y: 0.75, z: 0, visibility: 0.95 };
    for (const [index, change] of Object.entries(overrides)) points[Number(index)] = { ...points[Number(index)], ...change };
    return points;
  };

  it('does not tell someone side on to face the camera or step closer', () => {
    expect(assessFraming(person({ [LM.LEFT_SHOULDER]: { x: 0.51 }, [LM.RIGHT_SHOULDER]: { x: 0.49 } }), 120)).toBe('ok');
  });

  it('asks for room above the head, the usual problem with a laptop on a desk', () => {
    expect(assessFraming(person({ [LM.NOSE]: { y: 0.04 } }), 120)).toBe('head_cut');
    expect(assessFraming(person({ [LM.NOSE]: { y: -0.1 } }), 120)).toBe('head_cut');
    expect(assessFraming(person(), 120)).toBe('ok');
  });
});

describe('the start check', () => {
  const worldToImage = (points: Landmark[]) =>
    points.map((p) => ({ x: 0.5 + p.x / 2.2, y: 0.55 + p.y / 2.2, z: 0, visibility: p.visibility }));

  const run = (frames: PoseFrame[], seconds = 5.2) => {
    const check = new StartCheck();
    const first = frames[0].t;
    for (const frame of frames) {
      if (frame.t - first > seconds * 1000) break;
      check.push(frame.t, frame.landmarks, frame.landmarks && worldToImage(frame.landmarks));
      if (check.isDone(frame.t)) break;
    }
    return check;
  };

  it('finishes in about five seconds and needs no punches', () => {
    const check = run(session());
    const frames = session();
    expect(check.isDone(frames[0].t + 5000)).toBe(true);
    expect(check.remaining(frames[0].t + 2000)).toBeCloseTo(3, 0);
    const result = check.result();
    expect(result.gaveUp).toBe(false);
    expect(result.framed).toBe(true);
    expect(result.scale).toBeGreaterThan(0.2);
    expect(result.cameraSide).toBe('front');
  });

  it('says where the camera is', () => {
    const left = run(session().map((frame) => turnFrame(frame, 35))).result();
    expect(left.cameraSide).toBe('left');
    expect(left.cameraAngle).toBeGreaterThan(30);
    expect(describeCamera(left)).toMatch(/^Camera on your left, about \d+°\.$/);
    const right = run(session().map((frame) => turnFrame(frame, -35))).result();
    expect(right.cameraSide).toBe('right');
    expect(right.cameraAngle).toBeLessThan(-30);
  });

  it('sets the rest position from the guard', () => {
    const result = run(session()).result();
    expect(result.guard).not.toBeNull();
    expect(result.guard!.left.x).toBeGreaterThan(result.guard!.right.x);
  });

  it('gives up honestly when it never saw anyone', () => {
    const check = new StartCheck();
    for (let t = 0; t <= 5000; t += 33) check.push(t, null, null);
    expect(check.isDone(5000)).toBe(true);
    const result = check.result();
    expect(result.gaveUp).toBe(true);
    expect(describeCamera(result)).toMatch(/Couldn't get a read/);
    expect(placementAdvice(result)).toMatch(/in the picture/);
  });

  it('advises a better spot from the side, with the head cut off, or looking down', () => {
    const base: StartCheckResult = {
      framed: true, headCut: false, legsCut: false, scale: 0.3, cameraAngle: 0, cameraSide: 'front', cameraHeight: 'level', stance: null, guard: null, gaveUp: false,
    };
    expect(placementAdvice(base)).toBeNull();
    expect(placementAdvice({ ...base, cameraSide: 'side_left', cameraAngle: 85 })).toMatch(/far arm/);
    expect(placementAdvice({ ...base, headCut: true })).toMatch(/head/);
    expect(placementAdvice({ ...base, cameraHeight: 'high' })).toMatch(/looking down/);
  });

  it('maps a reading to an angle in both directions', () => {
    expect(cameraAngleFromReading(0)).toBe(0);
    expect(cameraAngleFromReading(35)).toBe(60);
    expect(cameraAngleFromReading(-35)).toBe(-60);
    expect(cameraAngleFromReading(80)).toBe(90);
  });
});

describe('the session log', () => {
  const punch = (id: number, kind: PunchDetected['punch'], hand: PunchDetected['hand'], issues: PunchDetected['issues'] = [], handUnsure = false) =>
    ({ type: 'punch', id, t: id, side: hand === 'lead' ? 'left' : 'right', hand, handUnsure, punch: kind, confidence: 1, issues, metrics: {} }) as unknown as PunchEvent;

  it('records each punch by type, hand and time, with combos, rounds and cues', () => {
    const log = new SessionPunchLog();
    log.add(punch(1, 'jab', 'lead'), 10);
    log.add(punch(2, 'cross', 'rear', ['no_rotation']), 10.5);
    log.add(punch(3, 'lead_hook', 'lead'), 11);
    log.add(punch(4, 'jab', 'lead'), 15);
    log.add(punch(5, 'punch', 'rear', [], true), 60);
    log.add({ type: 'form', t: 0, punchId: 4, hand: 'lead', issue: 'slow_return' }, 16);
    log.add({ type: 'form', t: 0, punchId: null, hand: 'lead', issue: 'chin_exposed' }, 17);
    const saved = log.snapshot();

    expect(saved.punches[0]).toEqual([10, 'jab', 'lead', []]);
    expect(saved.punches[3][3]).toEqual(['slow_return']);
    expect(saved.counts).toMatchObject({ jab: 2, cross: 1, lead_hook: 1, punch: 1 });
    // The side-on punch doesn't count toward either hand
    expect(saved.hands).toEqual({ lead: 3, rear: 1 });
    expect(saved.combos).toEqual([['jab', 'cross', 'lead_hook']]);
    expect(saved.rounds).toEqual([{ start: 10, end: 15, punches: 4 }, { start: 60, end: 60, punches: 1 }]);
    expect(saved.cues).toEqual({ no_rotation: 1, slow_return: 1 });
    expect(saved.idleCues).toEqual({ chin_exposed: 1 });
  });

  it('survives storage, and rebuilds the tally for a resumed session', () => {
    const log = new SessionPunchLog();
    log.add(punch(1, 'jab', 'lead', ['arm_not_extended']), 1);
    log.add(punch(2, 'cross', 'rear'), 1.4);
    const parsed = parsePunchLog(JSON.parse(JSON.stringify(log.snapshot())));
    expect(parsed).not.toBeNull();
    const round = roundFromLog(parsed!);
    expect(round.total).toBe(2);
    expect(round.counts.jab).toBe(1);
    expect(round.punchIssues.size).toBe(1);
    expect(round.longestCombo).toBe(2);

    const resumed = new SessionPunchLog(parsed);
    resumed.add(punch(1, 'lead_hook', 'lead'), 90);
    expect(resumed.snapshot().punches.length).toBe(3);
  });

  it('rejects anything that isn\'t a log', () => {
    expect(parsePunchLog(null)).toBeNull();
    expect(parsePunchLog({ v: 2 })).toBeNull();
    expect(parsePunchLog({ ...emptyPunchLog(), punches: [['x']] })).toBeNull();
    expect(parsePunchLog(emptyPunchLog())).not.toBeNull();
  });
});
