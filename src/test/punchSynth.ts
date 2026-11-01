import type { Landmark, PoseFrame, Side, Stance } from '@/lib/punch/types';

/**
 * Makes synthetic world landmark sequences of a fighter facing the camera, for the detector tests.
 * It is a posed skeleton, not motion capture, so passing these tests shows the logic is sound and
 * says nothing about how well the thresholds suit real people.
 */

type V = [number, number, number];
export type Shape = 'straight' | 'hook' | 'uppercut';
export type HandName = 'lead' | 'rear';

export interface SynthPunch {
  hand: HandName;
  shape: Shape;
  /** When the hand leaves guard, ms. */
  at: number;
  outMs?: number;
  backMs?: number;
  /** How long an uppercut takes to dip before rising. */
  dipMs?: number;
  /** Stays at full extension for this long before coming back. */
  holdMs?: number;
  /** Faults. */
  otherHandDrops?: boolean;
  bentArm?: boolean;
  flaredElbow?: boolean;
  noRotation?: boolean;
  neverReturns?: boolean;
}

export interface SynthOptions {
  stance?: Stance;
  fps?: number;
  durationMs?: number;
  startMs?: number;
  punches?: SynthPunch[];
  /** Hold these hands low the whole time. */
  lowHands?: HandName[];
  /** Arms hanging at the sides instead of in guard. */
  armsDown?: boolean;
  noise?: number;
  seed?: number;
  /** Return null landmarks when this says so. */
  dropFrame?: (t: number) => boolean;
  /** Set visibility on joints by index. */
  visibility?: (index: number, t: number) => number;
  /** Extra movement of the whole upper body, metres. */
  sway?: (t: number) => V;
  /** Twist of the shoulders, degrees, positive brings the left shoulder toward the camera. */
  twist?: (t: number) => number;
  /** Moves both wrists by this much, metres, for odd movements. */
  handOffset?: (side: Side, t: number) => V;
}

const SHOULDER_W = 0.38;
const UPPER_ARM = 0.3;
const FOREARM = 0.26;
const SHOULDER_Y = -0.5;

const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: V, s: number): V => [a[0] * s, a[1] * s, a[2] * s];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V) => Math.sqrt(dot(a, a));
const lerp = (a: V, b: V, t: number): V => add(a, scale(sub(b, a), t));
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** Places an elbow between a shoulder and a wrist, bending toward the pole. */
function solveElbow(shoulder: V, wrist: V, pole: V): V {
  const toWrist = sub(wrist, shoulder);
  const d = Math.min(len(toWrist), (UPPER_ARM + FOREARM) * 0.999);
  const axis = scale(toWrist, 1 / (len(toWrist) || 1));
  const along = (d * d + UPPER_ARM * UPPER_ARM - FOREARM * FOREARM) / (2 * d);
  const height = Math.sqrt(Math.max(0, UPPER_ARM * UPPER_ARM - along * along));
  const off = sub(pole, scale(axis, dot(pole, axis)));
  const offLen = len(off) || 1;
  return add(add(shoulder, scale(axis, along)), scale(off, height / offLen));
}

function rotateY(point: V, degrees: number): V {
  const r = (degrees * Math.PI) / 180;
  return [point[0] * Math.cos(r) + point[2] * Math.sin(r), point[1], -point[0] * Math.sin(r) + point[2] * Math.cos(r)];
}

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sideSign = (side: Side) => (side === 'left' ? 1 : -1);
const guardWrist = (side: Side): V => [sideSign(side) * 0.14, -0.6, -0.2];
const lowWrist = (side: Side): V => [sideSign(side) * 0.2, -0.3, -0.14];
const hangingWrist = (side: Side): V => [sideSign(side) * 0.24, -0.02, -0.02];

const twistFor = (shape: Shape, hand: HandName) => {
  if (shape === 'straight') return hand === 'lead' ? 8 : 26;
  if (shape === 'hook') return hand === 'lead' ? 22 : 28;
  return 14;
};

/** The punch's path, as guard -> via -> peak, and where the elbow points at the peak. */
function punchPath(side: Side, punch: SynthPunch) {
  const s = sideSign(side);
  const start = guardWrist(side);
  const yaw = punch.noRotation ? 0 : twistFor(punch.shape, punch.hand) * s;
  const shoulder = add([0, SHOULDER_Y, 0], rotateY([s * SHOULDER_W * 0.5, 0, 0], yaw));
  switch (punch.shape) {
    case 'straight': {
      const reach = punch.bentArm ? 0.4 : 0.55;
      const peak = add(shoulder, [-s * 0.05, -0.02, -reach]);
      return { start, via: lerp(start, peak, 0.5), peak, pole: [s, 0.6, 0.2] as V };
    }
    case 'hook': {
      const peak: V = [-s * 0.14, -0.54, -0.36];
      return {
        start,
        via: [s * 0.36, -0.56, -0.36] as V,
        peak,
        pole: (punch.flaredElbow ? [s, -1.2, 0] : [s, 0, 0.1]) as V,
      };
    }
    case 'uppercut': {
      const dip: V = [s * 0.14, -0.3, -0.2];
      const peak: V = [s * 0.04, -0.68, -0.3];
      return { start: dip, via: [s * 0.1, -0.46, -0.28] as V, peak, pole: [s * 0.2, 1, 0.3] as V };
    }
  }
}

function bezier(a: V, b: V, c: V, t: number): V {
  return lerp(lerp(a, b, t), lerp(b, c, t), t);
}

export function simulate(options: SynthOptions = {}): PoseFrame[] {
  const {
    stance = 'orthodox',
    fps = 30,
    durationMs = 3000,
    startMs = 1000,
    punches = [],
    lowHands = [],
    armsDown = false,
    noise = 0,
    seed = 7,
    dropFrame,
    visibility,
    sway,
    twist,
    handOffset,
  } = options;
  const random = mulberry(seed);
  const gaussian = () => Math.sqrt(-2 * Math.log(random() || 1e-9)) * Math.cos(2 * Math.PI * random());
  const sideOf = (hand: HandName): Side =>
    (hand === 'lead') === (stance === 'orthodox') ? 'left' : 'right';
  const handOf = (side: Side): HandName => (sideOf('lead') === side ? 'lead' : 'rear');

  const frames: PoseFrame[] = [];
  const frameMs = 1000 / fps;
  for (let t = startMs; t <= startMs + durationMs; t += frameMs) {
    if (dropFrame?.(t)) {
      frames.push({ t, landmarks: null });
      continue;
    }

    // Rest position of each hand, then the punch on top of it
    let yaw = twist?.(t) ?? 0;
    const place = (side: Side) => {
      const hand = handOf(side);
      const rest = armsDown ? hangingWrist(side) : lowHands.includes(hand) ? lowWrist(side) : guardWrist(side);
      let wrist = rest;
      let pole: V = armsDown ? [sideSign(side) * 0.3, 0, 1] : [sideSign(side) * 0.3, 1, 0.1];

      for (const punch of punches) {
        const out = punch.outMs ?? 170;
        const hold = punch.holdMs ?? 0;
        const back = punch.backMs ?? 220;
        const rel = t - punch.at;
        const end = out + hold + back;

        const other = punch.hand !== hand;
        if (other) {
          if (punch.otherHandDrops && rel >= 0 && rel <= end) {
            const k = ease(Math.min(1, rel / (out * 0.7)));
            wrist = lerp(wrist, [sideSign(side) * 0.3, -0.26, -0.12], k);
            pole = [sideSign(side), 1, 0];
          }
          continue;
        }
        const dip = punch.dipMs ?? 120;
        if (rel < -dip || (rel > end && !punch.neverReturns)) continue;

        const path = punchPath(side, punch);
        if (rel < 0) {
          // Uppercuts dip before they rise
          wrist = lerp(rest, path.start, ease((rel + dip) / dip));
        } else if (rel <= out) {
          wrist = bezier(path.start, path.via, path.peak, ease(rel / out));
          pole = lerp(pole, path.pole, Math.min(1, rel / (out * 0.5)));
        } else if (rel <= out + hold || punch.neverReturns) {
          wrist = path.peak;
          pole = path.pole;
        } else {
          const k = ease((rel - out - hold) / back);
          wrist = lerp(path.peak, rest, k);
          pole = lerp(path.pole, pole, k);
        }

        if (!punch.noRotation && rel >= 0) {
          const phase =
            rel <= out ? ease(rel / out) : rel <= out + hold ? 1 : Math.max(0, 1 - (rel - out - hold) / back);
          // Positive yaw brings the left shoulder toward the camera, and the punching side comes forward
          yaw += twistFor(punch.shape, punch.hand) * phase * sideSign(side);
        }
      }
      return { wrist, pole };
    };

    const left = place('left');
    const right = place('right');
    const swayNow = sway?.(t) ?? ([0, 0, 0] as V);
    const shoulderMid = add([0, SHOULDER_Y, 0], swayNow);
    const leftShoulder = add(shoulderMid, rotateY([SHOULDER_W / 2, 0, 0], yaw));
    const rightShoulder = add(shoulderMid, rotateY([-SHOULDER_W / 2, 0, 0], yaw));
    const hipYaw = yaw * 0.5;

    const limb = (side: Side, placed: { wrist: V; pole: V }, shoulder: V) => {
      const offset = handOffset?.(side, t) ?? ([0, 0, 0] as V);
      const wrist = add(add(placed.wrist, offset), swayNow);
      return { wrist, elbow: solveElbow(shoulder, wrist, placed.pole) };
    };
    const leftArm = limb('left', left, leftShoulder);
    const rightArm = limb('right', right, rightShoulder);

    const head = add(shoulderMid, [0, -0.25, -0.03]);
    const points: Record<number, V> = {
      0: head,
      9: add(head, [0.02, 0.03, 0.01]),
      10: add(head, [-0.02, 0.03, 0.01]),
      11: leftShoulder,
      12: rightShoulder,
      13: leftArm.elbow,
      14: rightArm.elbow,
      15: leftArm.wrist,
      16: rightArm.wrist,
      23: rotateY([0.1, 0, 0], hipYaw),
      24: rotateY([-0.1, 0, 0], hipYaw),
    };

    const landmarks: Landmark[] = Array.from({ length: 33 }, (_, index) => {
      const p = points[index] ?? ([0, 0, 0] as V);
      return {
        x: p[0] + noise * gaussian(),
        y: p[1] + noise * gaussian(),
        z: p[2] + noise * 2 * gaussian(),
        visibility: visibility?.(index, t) ?? 0.95,
      };
    });
    frames.push({ t, landmarks });
  }
  return frames;
}
