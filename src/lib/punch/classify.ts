import { PUNCH_CONFIG, type PunchConfig } from './config';
import type { Hand, PunchClass } from './types';

export type PunchShape = 'straight' | 'hook' | 'uppercut';

export interface PunchShapeFeatures {
  /** Wrist to shoulder distance over arm length at the peak, 1 is a straight arm. */
  reach: number;
  elbow: number;
  /** Share of the wrist's movement that went toward the camera, across the body, and up. */
  forwardShare: number;
  acrossShare: number;
  upShare: number;
  /** Share of the movement that went away from the body's centre line. */
  outwardShare: number;
  /** How far the wrist travelled upward, in shoulder widths. */
  rise: number;
  visibility: number;
}

const ramp = (value: number, from: number, to: number) =>
  Math.min(1, Math.max(0, (value - from) / (to - from)));

export function scoreShapes(f: PunchShapeFeatures, config: PunchConfig = PUNCH_CONFIG) {
  const { straight, hook, uppercut } = config.classify;
  const extended =
    ramp(f.reach, straight.reachMin, straight.reachFull) * ramp(f.elbow, straight.elbowMin, straight.elbowFull);
  const hookScore =
    ramp(f.acrossShare, hook.acrossShareMin, hook.acrossShareFull) *
    (1 - ramp(f.elbow, hook.elbowBent, hook.elbowOpen));
  const uppercutScore =
    ramp(f.upShare, uppercut.upShareMin, uppercut.upShareFull) *
    ramp(f.rise, uppercut.riseMin, uppercut.riseFull) *
    (1 - ramp(f.elbow, uppercut.elbowBent, uppercut.elbowOpen));
  // Punched at the camera, a straight barely shows and depth is the model's weakest output. So a
  // fast punch with no sign of a lateral or upward arc is called a straight, with capped confidence.
  const noArc =
    straight.byEliminationScore *
    (1 - ramp(f.acrossShare, hook.acrossShareMin, hook.acrossShareFull)) *
    (1 - ramp(f.rise, uppercut.riseMin, uppercut.riseFull)) *
    (1 - ramp(f.outwardShare, straight.outwardShareMin, straight.outwardShareFull));
  return {
    straight: Math.max(extended, noArc),
    hook: hookScore,
    uppercut: uppercutScore,
    /** True when the straight score came from having no arc rather than from seeing an extended arm. */
    byElimination: noArc > extended,
  };
}

const LABELS: Record<PunchShape, Record<Hand, PunchClass>> = {
  straight: { lead: 'jab', rear: 'cross' },
  hook: { lead: 'lead_hook', rear: 'rear_hook' },
  uppercut: { lead: 'lead_uppercut', rear: 'rear_uppercut' },
};

/** Labels a punch from its shape. A weak or close call comes back as "punch" instead of a guess. */
export function classifyPunch(hand: Hand, f: PunchShapeFeatures, config: PunchConfig = PUNCH_CONFIG) {
  const scores = scoreShapes(f, config);
  const shapes: [PunchShape, number][] = [
    ['straight', scores.straight],
    ['hook', scores.hook],
    ['uppercut', scores.uppercut],
  ];
  const ranked = shapes.sort((a, b) => b[1] - a[1]);
  const [best, bestScore] = ranked[0];
  const confidence = (0.5 * bestScore + 0.5 * (bestScore - ranked[1][1])) * Math.min(1, f.visibility / 0.8);
  const isConfident = confidence >= config.classify.minConfidence;
  return {
    punch: isConfident ? LABELS[best][hand] : ('punch' as const),
    shape: isConfident ? best : null,
    confidence,
    scores,
    /** Depth wasn't readable, so checks that depend on it should stay quiet. */
    depthUnreliable: best === 'straight' && scores.byElimination && f.forwardShare < config.classify.straight.readableForwardShare,
  };
}
