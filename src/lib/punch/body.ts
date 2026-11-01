import { PUNCH_CONFIG, type PunchConfig } from './config';
import type { Landmark, Side } from './types';

export const LM = {
  NOSE: 0,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
} as const;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const norm = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
export const dist = (a: Vec3, b: Vec3) => norm(sub(a, b));
const mid = (a: Vec3, b: Vec3): Vec3 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });

/** The inside angle at b, in degrees. */
export function jointAngle(a: Vec3, b: Vec3, c: Vec3): number {
  const u = sub(a, b);
  const v = sub(c, b);
  const lengths = norm(u) * norm(v);
  if (lengths === 0) return 0;
  const cos = (u.x * v.x + u.y * v.y + u.z * v.z) / lengths;
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
}

export interface ArmPose {
  /** Null when that joint was not seen in this frame. */
  wrist: Vec3 | null;
  elbow: Vec3 | null;
  shoulder: Vec3;
  /** Mean visibility of the arm's joints. */
  visibility: number;
}

/**
 * One frame in the fighter's frame of reference: origin at the middle of the shoulders, one unit
 * is one shoulder width, x is image right, y is up, z is toward the camera. Measuring from the
 * shoulders cancels leaning, stepping and bobbing.
 */
export interface BodyPose {
  t: number;
  left: ArmPose;
  right: ArmPose;
  nose: Vec3;
  chinY: number;
  /** Positive when the left shoulder or hip is nearer the camera, in degrees. */
  shoulderYaw: number;
  hipYaw: number;
}

const JOINTS = Object.values(LM);

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function yaw(left: Vec3, right: Vec3): number {
  // z points away from the camera in world landmarks, so the nearer point has the smaller z
  return (Math.atan2(right.z - left.z, Math.abs(left.x - right.x)) * 180) / Math.PI;
}

/** Turns raw world landmarks into a smoothed BodyPose. Holds the only state that does so. */
export class BodyTracker {
  private smoothed = new Map<number, Landmark>();
  private recent = new Map<number, Landmark[]>();
  private widths: number[] = [];
  private lastT: number | null = null;

  constructor(private readonly config: PunchConfig = PUNCH_CONFIG) {}

  reset() {
    this.smoothed.clear();
    this.recent.clear();
    this.widths = [];
    this.lastT = null;
  }

  private seen(landmark: Landmark | undefined): landmark is Landmark {
    if (!landmark || !Number.isFinite(landmark.x + landmark.y + landmark.z)) return false;
    return (landmark.visibility ?? 1) >= this.config.input.minVisibility;
  }

  private smooth(landmarks: Landmark[], dt: number) {
    const alpha = 1 - Math.exp(-dt / this.config.input.smoothingTauMs);
    for (const index of JOINTS) {
      const raw = landmarks[index];
      if (!this.seen(raw)) {
        this.smoothed.delete(index);
        this.recent.delete(index);
        continue;
      }
      // The median of the last three frames removes the single-frame jumps the model makes
      const recent = [...(this.recent.get(index) ?? []), raw].slice(-3);
      this.recent.set(index, recent);
      const steady = {
        x: median(recent.map((p) => p.x)),
        y: median(recent.map((p) => p.y)),
        z: median(recent.map((p) => p.z)),
        visibility: raw.visibility,
      };
      const previous = this.smoothed.get(index);
      this.smoothed.set(
        index,
        previous
          ? {
              x: previous.x + alpha * (steady.x - previous.x),
              y: previous.y + alpha * (steady.y - previous.y),
              z: previous.z + alpha * (steady.z - previous.z),
              visibility: raw.visibility,
            }
          : steady,
      );
    }
  }

  /** Returns null until the shoulders and hips have been seen for long enough to trust the scale. */
  push(t: number, landmarks: Landmark[]): BodyPose | null {
    if (this.lastT !== null && t - this.lastT > this.config.input.maxGapMs) this.reset();
    const dt = this.lastT === null ? 1000 : Math.max(1, t - this.lastT);
    this.lastT = t;
    this.smooth(landmarks, dt);

    const leftShoulder = this.smoothed.get(LM.LEFT_SHOULDER);
    const rightShoulder = this.smoothed.get(LM.RIGHT_SHOULDER);
    const leftHip = this.smoothed.get(LM.LEFT_HIP);
    const rightHip = this.smoothed.get(LM.RIGHT_HIP);
    const nose = this.smoothed.get(LM.NOSE);
    if (!leftShoulder || !rightShoulder || !leftHip || !rightHip || !nose) return null;

    this.widths.push(dist(leftShoulder, rightShoulder));
    if (this.widths.length > this.config.input.scaleWindowFrames) this.widths.shift();
    if (this.widths.length < this.config.input.warmupFrames) return null;
    const unit = median(this.widths);
    if (unit <= 0) return null;

    const origin = mid(leftShoulder, rightShoulder);
    const toBody = (point: Vec3): Vec3 => ({
      x: (point.x - origin.x) / unit,
      y: -(point.y - origin.y) / unit,
      z: -(point.z - origin.z) / unit,
    });
    const arm = (side: Side): ArmPose => {
      const isLeft = side === 'left';
      const wrist = this.smoothed.get(isLeft ? LM.LEFT_WRIST : LM.RIGHT_WRIST);
      const elbow = this.smoothed.get(isLeft ? LM.LEFT_ELBOW : LM.RIGHT_ELBOW);
      const shoulder = isLeft ? leftShoulder : rightShoulder;
      return {
        wrist: wrist ? toBody(wrist) : null,
        elbow: elbow ? toBody(elbow) : null,
        shoulder: toBody(shoulder),
        visibility:
          ((wrist?.visibility ?? 0) + (elbow?.visibility ?? 0) + (shoulder.visibility ?? 1)) / 3,
      };
    };

    const mouthLeft = this.smoothed.get(LM.MOUTH_LEFT);
    const mouthRight = this.smoothed.get(LM.MOUTH_RIGHT);
    const bodyNose = toBody(nose);
    const mouthY = mouthLeft && mouthRight ? toBody(mid(mouthLeft, mouthRight)).y : bodyNose.y - 0.1;

    return {
      t,
      left: arm('left'),
      right: arm('right'),
      nose: bodyNose,
      chinY: mouthY - this.config.guard.chinBelowMouth,
      shoulderYaw: yaw(leftShoulder, rightShoulder),
      hipYaw: yaw(leftHip, rightHip),
    };
  }
}
