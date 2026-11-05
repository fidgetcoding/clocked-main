import type { PunchClass, Stance } from './types';

/**
 * A stick fighter throwing each calibration punch, so someone who doesn't know a lead hook from a
 * rear uppercut can copy it. Poses are in metres for an orthodox fighter facing +z, with the lead
 * (left) side at negative x; a southpaw is the same fighter mirrored.
 */
type Point3 = readonly [number, number, number];

export const DEMO_JOINTS = [
  'head', 'neck', 'pelvis',
  'lShoulder', 'lElbow', 'lWrist', 'rShoulder', 'rElbow', 'rWrist',
  'lHip', 'lKnee', 'lFoot', 'rHip', 'rKnee', 'rFoot',
] as const;
export type DemoJoint = (typeof DEMO_JOINTS)[number];
type Pose = Record<DemoJoint, Point3>;

export const DEMO_BONES: readonly [DemoJoint, DemoJoint][] = [
  ['neck', 'pelvis'],
  ['neck', 'lShoulder'], ['neck', 'rShoulder'],
  ['pelvis', 'lHip'], ['pelvis', 'rHip'],
  ['lHip', 'lKnee'], ['lKnee', 'lFoot'], ['rHip', 'rKnee'], ['rKnee', 'rFoot'],
  ['lShoulder', 'lElbow'], ['lElbow', 'lWrist'], ['rShoulder', 'rElbow'], ['rElbow', 'rWrist'],
];

const GUARD: Pose = {
  head: [0, 1.68, 0.04],
  neck: [0, 1.5, 0],
  pelvis: [0, 0.95, 0],
  lShoulder: [-0.19, 1.47, 0.06],
  lElbow: [-0.24, 1.2, 0.18],
  lWrist: [-0.12, 1.5, 0.32],
  rShoulder: [0.19, 1.47, -0.06],
  rElbow: [0.24, 1.2, 0.02],
  rWrist: [0.1, 1.52, 0.18],
  lHip: [-0.13, 0.95, 0.05],
  lKnee: [-0.17, 0.5, 0.24],
  lFoot: [-0.18, 0.02, 0.36],
  rHip: [0.13, 0.95, -0.05],
  rKnee: [0.17, 0.5, -0.12],
  rFoot: [0.2, 0.02, -0.28],
};

// The rear shoulder comes through on the cross, the rear hook and the rear uppercut
const REAR_TURN: Partial<Pose> = { lShoulder: [-0.2, 1.47, -0.07], rShoulder: [0.15, 1.47, 0.14], rHip: [0.12, 0.95, 0.03] };
const LEAD_TURN: Partial<Pose> = { lShoulder: [-0.16, 1.47, 0.14], rShoulder: [0.2, 1.47, -0.12] };

type DemoPunch = Exclude<PunchClass, 'punch'>;
interface Move {
  hand: 'lead' | 'rear';
  wind: Partial<Pose>;
  peak: Partial<Pose>;
  /** Pulls the swing from wind-up to landing into a curve: a hook travels round to the target, not straight at it. */
  arc?: Partial<Pose>;
}

const MOVES: Record<DemoPunch, Move> = {
  jab: { hand: 'lead', wind: {}, peak: { ...LEAD_TURN, lElbow: [-0.13, 1.47, 0.42], lWrist: [-0.07, 1.5, 0.74] } },
  cross: { hand: 'rear', wind: {}, peak: { ...REAR_TURN, rElbow: [0.07, 1.47, 0.42], rWrist: [-0.02, 1.5, 0.74] } },
  lead_hook: {
    hand: 'lead',
    wind: { lElbow: [-0.42, 1.42, 0.18], lWrist: [-0.48, 1.6, 0.36] },
    arc: { lElbow: [-0.44, 1.5, 0.4], lWrist: [-0.5, 1.62, 0.72] },
    peak: { ...LEAD_TURN, lElbow: [-0.38, 1.55, 0.42], lWrist: [0, 1.66, 0.52] },
  },
  rear_hook: {
    hand: 'rear',
    wind: { rElbow: [0.42, 1.42, 0.1], rWrist: [0.48, 1.6, 0.3] },
    arc: { rElbow: [0.44, 1.5, 0.32], rWrist: [0.5, 1.62, 0.66] },
    peak: { ...REAR_TURN, rElbow: [0.36, 1.55, 0.38], rWrist: [-0.02, 1.66, 0.5] },
  },
  lead_uppercut: {
    hand: 'lead',
    wind: { lElbow: [-0.2, 1.08, 0.16], lWrist: [-0.14, 1.18, 0.32] },
    peak: { ...LEAD_TURN, lElbow: [-0.14, 1.32, 0.28], lWrist: [-0.06, 1.68, 0.36] },
  },
  rear_uppercut: {
    hand: 'rear',
    wind: { rElbow: [0.2, 1.08, 0.08], rWrist: [0.14, 1.18, 0.26] },
    peak: { ...REAR_TURN, rElbow: [0.08, 1.32, 0.26], rWrist: [0, 1.68, 0.34] },
  },
};

/** Guard, wind up, land, hold, back to guard, rest. */
export const DEMO_KEY_TIMES = [0, 0.14, 0.3, 0.42, 0.66, 1];
export const DEMO_SECONDS = 1.6;
/** Index of the landed pose, shown still when motion is turned down. */
export const DEMO_PEAK_FRAME = 2;

// Where the camera sits, in degrees: yaw off the punching line, from the side that spreads the stance, and
// pitch looking down. Straights and uppercuts are seen from the side, so they reach across the frame instead
// of at you. Hooks are seen nearly from the front and a little above: the elbow out at shoulder height and the
// fist sweeping round to the chin, with the tilt just enough to show the swing as a curve.
// An orthodox fighter punches to the right; a southpaw is the mirror image.
interface View { yaw: number; pitch: number }
const SIDE: View = { yaw: 60, pitch: 0 };
const ABOVE_FRONT: View = { yaw: 30, pitch: 20 };
const VIEWS: Record<DemoPunch, View> = {
  jab: SIDE, cross: SIDE, lead_hook: ABOVE_FRONT, rear_hook: ABOVE_FRONT, lead_uppercut: SIDE, rear_uppercut: SIDE,
};

const radians = (degrees: number) => (degrees * Math.PI) / 180;
const tenth = (n: number) => Math.round(n * 1000) / 10;

export function projectDemo([x, y, z]: Point3, stance: Stance, view: View = SIDE): [number, number] {
  const [yaw, pitch] = [radians(view.yaw), radians(view.pitch)];
  const across = -x * Math.cos(yaw) + z * Math.sin(yaw);
  // Toward the camera, which a camera looking down draws lower
  const near = x * Math.sin(yaw) + z * Math.cos(yaw);
  const flip = stance === 'southpaw' ? -1 : 1;
  return [tenth(flip * across), tenth(-y * Math.cos(pitch) + near * Math.sin(pitch))];
}

export type DemoFrame = Record<DemoJoint, [number, number]>;

export interface PunchDemoFrames {
  /** The throwing arm's joints: l for the lead hand, r for the rear, in both stances. */
  side: 'l' | 'r';
  frames: DemoFrame[];
  /** Bends the swing into a curve, for punches that travel round. */
  arc: DemoFrame | null;
  /** The motion arrow beside the arm: straight for straights, along the swing under the forearm for hooks, rising for uppercuts. */
  arrow: { path: string; head: string };
  /** A fixed-size box around the punch, knees up. */
  viewBox: string;
}

export const DEMO_BOX = { width: 116, height: 160 };

const easeInOut = (u: number) => (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2);
const SWING = 1;

/** Where every joint is at a point in the loop, 0 to 1, eased between keyframes and curved through the arc. */
export function demoPoseAt(frames: DemoFrame[], t: number, arc: DemoFrame | null = null): DemoFrame {
  const loop = ((t % 1) + 1) % 1;
  let i = 0;
  while (i < DEMO_KEY_TIMES.length - 2 && loop >= DEMO_KEY_TIMES[i + 1]) i += 1;
  const span = DEMO_KEY_TIMES[i + 1] - DEMO_KEY_TIMES[i];
  const u = easeInOut(Math.min(1, (loop - DEMO_KEY_TIMES[i]) / span));
  const [from, to] = [frames[i], frames[i + 1]];
  const bend = i === SWING ? arc : null;
  const along = (a: number, c: number, b: number) => (1 - u) ** 2 * a + 2 * (1 - u) * u * c + u ** 2 * b;
  return Object.fromEntries(
    DEMO_JOINTS.map((joint) => {
      const [a, b] = [from[joint], to[joint]];
      if (bend) return [joint, [along(a[0], bend[joint][0], b[0]), along(a[1], bend[joint][1], b[1])]];
      return [joint, [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]];
    }),
  ) as DemoFrame;
}

type ArrowKind = 'straight' | 'round' | 'up';
const ARROWS: Record<DemoPunch, ArrowKind> = {
  jab: 'straight', cross: 'straight', lead_hook: 'round', rear_hook: 'round', lead_uppercut: 'up', rear_uppercut: 'up',
};

type Point2 = [number, number];
const fmt = ([x, y]: Point2) => `${x.toFixed(1)} ${y.toFixed(1)}`;

// A hook's arrow runs under the forearm, clear of the glove, and stops before the glove lands at the chin.
// It's grown out from that end so the sweep still reads at phone size.
const HOOK_DROP = 24;
const HOOK_SPAN = [0, 0.94] as const;
const HOOK_GROW = 1.35;
// How far any arrow keeps from the middle of the head: its radius, plus the arrow's own width and a gap
const HEAD_CLEAR = 19;

/** The piece of the curve a→c→b between s and t, as the same kind of curve: its two ends and its control point. */
function curvePiece(a: Point2, c: Point2, b: Point2, s: number, t: number): [Point2, Point2, Point2] {
  const blossom = (u: number, v: number): Point2 => {
    const [wa, wc, wb] = [(1 - u) * (1 - v), (1 - u) * v + u * (1 - v), u * v];
    return [wa * a[0] + wc * c[0] + wb * b[0], wa * a[1] + wc * c[1] + wb * b[1]];
  };
  return [blossom(s, s), blossom(s, t), blossom(t, t)];
}

/**
 * An arrow drawn just off the arm, the way a coach would sketch the punch. A hook's arrow traces the glove's own
 * swing through `swing`, dropped under the forearm; the others sit beside a straight or rising line.
 */
function motionArrow(from: Point2, to: Point2, kind: ArrowKind, forward: 1 | -1, swing: Point2 | null, headAt: Point2) {
  let a: Point2, b: Point2, c: Point2;
  if (kind === 'round' && swing) {
    const [start, bend, end] = curvePiece(from, swing, to, ...HOOK_SPAN);
    const place = ([x, y]: Point2): Point2 => [end[0] + (x - end[0]) * HOOK_GROW, end[1] + (y - end[1]) * HOOK_GROW + HOOK_DROP];
    [a, c, b] = [place(start), place(bend), place(end)];
  } else {
    const lift: Point2 = kind === 'up' ? [forward * 22, 0] : [0, -22];
    const at = (u: number): Point2 => [from[0] + (to[0] - from[0]) * u + lift[0], from[1] + (to[1] - from[1]) * u + lift[1]];
    a = at(0);
    b = at(1);
    // Sets off clear of the head: the cross starts from beside the chin
    for (let u = 0.05; u < 0.5 && Math.hypot(a[0] - headAt[0], a[1] - headAt[1]) < HEAD_CLEAR; u += 0.05) a = at(u);
    const bulge: Point2 = kind === 'up' ? [forward * 14, 0] : [0, 0];
    c = [(a[0] + b[0]) / 2 + bulge[0], (a[1] + b[1]) / 2 + bulge[1]];
  }
  const length = Math.hypot(b[0] - c[0], b[1] - c[1]) || 1;
  const [ux, uy] = [(b[0] - c[0]) / length, (b[1] - c[1]) / length];
  const tip: Point2 = [b[0] + ux * 5, b[1] + uy * 5];
  const back: Point2 = [b[0] - ux * 7, b[1] - uy * 7];
  const wing = (side: 1 | -1): Point2 => [back[0] - uy * 7 * side, back[1] + ux * 7 * side];
  // Points on the drawn line, for framing. The control point sits off it, out past the bend
  const on = (u: number): Point2 => curvePiece(a, c, b, u, u)[0];
  return {
    path: `M${fmt(a)} Q${fmt(c)} ${fmt(b)}`,
    head: [tip, wing(1), wing(-1)].map(fmt).join(' '),
    points: [a, on(0.25), on(0.5), on(0.75), b, tip, wing(1), wing(-1)],
  };
}

/** Centres a fixed box on the head, arms and arrow, from just above the head down. */
function frameAround(frames: DemoFrame[], arc: DemoFrame | null, extra: Point2[]): string {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let k = 0; k <= 40; k++) {
    const pose = demoPoseAt(frames, k / 40, arc);
    for (const joint of ['head', 'lWrist', 'rWrist', 'lElbow', 'rElbow', 'lShoulder', 'rShoulder'] as DemoJoint[]) {
      xs.push(pose[joint][0]);
      ys.push(pose[joint][1]);
    }
  }
  for (const [x, y] of extra) {
    xs.push(x);
    ys.push(y);
  }
  const left = (Math.min(...xs) + Math.max(...xs)) / 2 - DEMO_BOX.width / 2;
  const top = Math.min(...ys) - 16;
  return `${Math.round(left)} ${Math.round(top)} ${DEMO_BOX.width} ${DEMO_BOX.height}`;
}

const project = (pose: Pose, stance: Stance, view: View) =>
  Object.fromEntries(DEMO_JOINTS.map((joint) => [joint, projectDemo(pose[joint], stance, view)])) as DemoFrame;

/** The keyframes for one punch, or null for an unnamed punch, which has nothing to show. */
export function punchDemoFrames(punch: PunchClass, stance: Stance): PunchDemoFrames | null {
  if (punch === 'punch') return null;
  const move = MOVES[punch];
  const view = VIEWS[punch];
  const wind: Pose = { ...GUARD, ...move.wind };
  const peak: Pose = { ...GUARD, ...move.peak };
  const frames = [GUARD, wind, peak, peak, GUARD, GUARD].map((pose) => project(pose, stance, view));
  // Joints the arc leaves alone sit halfway, which keeps them on a straight line
  const halfway = Object.fromEntries(
    DEMO_JOINTS.map((joint) => [joint, wind[joint].map((v, k) => (v + peak[joint][k]) / 2) as unknown as Point3]),
  ) as Pose;
  const arc = move.arc ? project({ ...halfway, ...move.arc }, stance, view) : null;
  const glove: DemoJoint = move.hand === 'lead' ? 'lWrist' : 'rWrist';
  const kind = ARROWS[punch];
  const start = kind === 'straight' ? frames[0][glove] : frames[1][glove];
  const { path, head, points } = motionArrow(start, frames[DEMO_PEAK_FRAME][glove], kind, stance === 'southpaw' ? -1 : 1, arc?.[glove] ?? null, frames[DEMO_PEAK_FRAME].head);
  return {
    side: move.hand === 'lead' ? 'l' : 'r',
    frames,
    arc,
    arrow: { path, head },
    viewBox: frameAround(frames, arc, points),
  };
}
