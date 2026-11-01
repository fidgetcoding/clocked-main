import { PUNCH_CONFIG, type PunchConfig } from './config';
import type { Hand, PunchClass } from './types';

export type PunchShape = 'straight' | 'hook' | 'uppercut';

export interface PunchShapeFeatures {
  /** Wrist to shoulder distance over arm length at the peak, 1 is a straight arm. */
  reach: number;
  /** Elbow angle at the peak, 180 is a straight arm. */
  elbow: number;
  /** The largest elbow angle held on the way to the peak, ignoring the single highest reading. */
  elbowHeldMax: number;
  /** How much the elbow opened between the start and the peak. Negative means it closed. */
  elbowOpening: number;
  /** Share of the wrist's movement that went toward the camera and up. */
  forwardShare: number;
  upShare: number;
  /** Movement relative to the punching shoulder, so that turning the hips doesn't count as an arc. */
  armAcross: number;
  /** Sideways share of that movement over the floor, leaving out how far it rose. */
  armAcrossShare: number;
  /** Share of the movement that went away from the body's centre line. */
  outwardShare: number;
  /** How far the wrist travelled upward, in shoulder widths. */
  rise: number;
  /** How far below its own shoulder the wrist started, in shoulder widths. */
  startBelowShoulder: number;
  /** Degrees between the forearm and straight up at the peak, as seen in the image. */
  forearmFromVertical: number;
  /** Degrees between the forearm and level at the peak, as seen in the image. */
  forearmFromLevel: number;
  /** Degrees the upper arm hangs below level at the peak. Negative means the elbow is above the shoulder. */
  upperArmBelowLevel: number;
  visibility: number;
}

const ramp = (value: number, from: number, to: number) =>
  Math.min(1, Math.max(0, (value - from) / (to - from)));

/**
 * A hook or uppercut needs positive evidence, all of it at once. Anything else that is fast and
 * moves out from the body is a straight. An elbow that opens on the way to the peak rules out both.
 */
export function scoreShapes(f: PunchShapeFeatures, config: PunchConfig = PUNCH_CONFIG) {
  const { straight, hook, uppercut } = config.classify;

  const uppercutScore =
    (1 - ramp(f.elbowOpening, uppercut.elbowOpensFrom, uppercut.elbowOpensFully)) *
    ramp(f.startBelowShoulder, uppercut.startBelowMin, uppercut.startBelowFull) *
    (1 - ramp(f.elbowHeldMax, uppercut.elbowBent, uppercut.elbowOpen)) *
    (1 - ramp(f.forearmFromVertical, uppercut.forearmVertical, uppercut.forearmTilted)) *
    ramp(f.rise, uppercut.riseMin, uppercut.riseFull) *
    ramp(f.upShare, uppercut.upShareMin, uppercut.upShareFull);

  const hookScore =
    (1 - ramp(f.elbowOpening, hook.elbowOpensFrom, hook.elbowOpensFully)) *
    ramp(f.armAcross, hook.acrossMin, hook.acrossFull) *
    ramp(f.armAcrossShare, hook.acrossShareMin, hook.acrossShareFull) *
    (1 - ramp(f.elbowHeldMax, hook.elbowBent, hook.elbowOpen)) *
    ramp(f.elbow, hook.elbowClosed, hook.elbowNinety) *
    (1 - ramp(f.upperArmBelowLevel, hook.upperArmLevel, hook.upperArmDropped)) *
    (1 - ramp(f.forearmFromLevel, hook.forearmLevel, hook.forearmTilted));

  const extended =
    ramp(f.reach, straight.reachMin, straight.reachFull) * ramp(f.elbow, straight.elbowMin, straight.elbowFull);
  // Depth is the model's weakest output, so a straight doesn't have to be seen extending. A big
  // rise from low down isn't a straight even when it fits no arc.
  const risesFromLow = ramp(f.startBelowShoulder, straight.lowStartMin, straight.lowStartFull) * ramp(f.rise, uppercut.riseMin, uppercut.riseFull);
  const byDefault =
    straight.defaultScore *
    (1 - ramp(f.outwardShare, straight.outwardShareMin, straight.outwardShareFull)) *
    (1 - risesFromLow);

  return {
    straight: Math.max(extended, byDefault),
    hook: hookScore,
    uppercut: uppercutScore,
    /** True when it was called a straight for lack of anything else, not from seeing a long arm. */
    byElimination: byDefault > extended,
  };
}

const LABELS: Record<PunchShape, Record<Hand, PunchClass>> = {
  straight: { lead: 'jab', rear: 'cross' },
  hook: { lead: 'lead_hook', rear: 'rear_hook' },
  uppercut: { lead: 'lead_uppercut', rear: 'rear_uppercut' },
};

/** Labels a punch from its shape. When the arm is hard to see it comes back as "punch" instead of a guess. */
export function classifyPunch(hand: Hand, f: PunchShapeFeatures, config: PunchConfig = PUNCH_CONFIG) {
  const scores = scoreShapes(f, config);
  const arc: PunchShape = scores.uppercut >= scores.hook ? 'uppercut' : 'hook';
  const shape: PunchShape = scores[arc] >= config.classify.minArcEvidence ? arc : 'straight';
  const confidence = scores[shape] * Math.min(1, f.visibility / 0.8);
  const isConfident = confidence >= config.classify.minConfidence;
  return {
    punch: isConfident ? LABELS[shape][hand] : ('punch' as const),
    shape: isConfident ? shape : null,
    confidence,
    scores,
    /** Depth wasn't readable, so checks that depend on it should stay quiet. */
    depthUnreliable:
      shape === 'straight' &&
      scores.byElimination &&
      f.forwardShare < config.classify.straight.readableForwardShare,
  };
}
