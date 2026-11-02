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
export const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
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
  /** The model only guessed where the wrist or elbow is, because it couldn't see it. */
  guessed: boolean;
}

/**
 * The length of a move as the camera can judge it. Depth is the model's weakest output and jitters
 * backward on a still hand, so along the camera's line of sight only movement toward it counts.
 */
export function seenLength(move: Vec3, camera: Vec3): number {
  const along = dot(move, camera);
  const across = norm({ x: move.x - along * camera.x, y: move.y - along * camera.y, z: move.z - along * camera.z });
  return Math.hypot(across, Math.max(0, along));
}

/** The length of a move in the picture, leaving out depth altogether. */
export function pictureLength(move: Vec3, camera: Vec3): number {
  const along = dot(move, camera);
  return norm({ x: move.x - along * camera.x, y: move.y - along * camera.y, z: move.z - along * camera.z });
}

/**
 * One frame in the fighter's own frame of reference, the same wherever the camera is: origin at the
 * middle of the shoulders, one unit is one shoulder width, y is up, x runs from their right shoulder
 * toward their left, and z is the way they face. Facing the camera, that is image right and toward
 * the camera. Measuring from the shoulders cancels leaning, stepping and bobbing.
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
  /** How far the fighter is turned from the camera as the model reads it. Positive is camera on their left. */
  viewYaw: number;
  /** The direction of the camera in this frame, which is where depth is weakest. */
  camera: Vec3;
  /** Spine tilt as the model reads it, positive toward the camera at the top. Low cameras read negative. */
  spineTilt: number;
  /** False when the head is out of the picture and its position is assumed. */
  headSeen: boolean;
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
  /** The direction from their right side to their left over the floor, tracked slowly. */
  private heading: { x: number; z: number } | null = null;
  private lastNose: Vec3 | null = null;
  /** The part of the spine's tilt put down to camera height, in radians. */
  private cameraTilt = 0;
  private lastTiltSet = false;
  private spineTilt: number | null = null;

  constructor(private readonly config: PunchConfig = PUNCH_CONFIG) {}

  reset() {
    this.smoothed.clear();
    this.recent.clear();
    this.widths = [];
    this.lastT = null;
    this.heading = null;
    this.lastNose = null;
    this.cameraTilt = 0;
    this.lastTiltSet = false;
    this.spineTilt = null;
  }

  /** A camera high up or down low makes a standing fighter look tilted, so that tilt is taken out. */
  private updateTilt(spineForward: number, spineUp: number, dt: number, hold: boolean) {
    if (hold) return this.cameraTilt;
    const { leanForwardMax, leanBackMax, headingTauMs } = this.config.view;
    const lean = (Math.atan2(spineForward, spineUp) * 180) / Math.PI;
    const excess = lean > leanForwardMax ? lean - leanForwardMax : lean < -leanBackMax ? lean + leanBackMax : 0;
    const alpha = this.lastTiltSet ? 1 - Math.exp(-dt / headingTauMs) : 1;
    this.lastTiltSet = true;
    this.cameraTilt += alpha * ((excess * Math.PI) / 180 - this.cameraTilt);
    return this.cameraTilt;
  }

  /** The shoulders and hips together, since the shoulders alone swing with every punch. */
  private updateHeading(leftShoulder: Vec3, rightShoulder: Vec3, leftHip: Vec3 | undefined, rightHip: Vec3 | undefined, dt: number, hold: boolean) {
    const line = (left: Vec3, right: Vec3) => {
      // z flips here, so that positive means toward the camera
      const x = left.x - right.x;
      const z = right.z - left.z;
      const length = Math.hypot(x, z) || 1;
      return { x: x / length, z: z / length };
    };
    const shoulders = line(leftShoulder, rightShoulder);
    const hips = leftHip && rightHip ? line(leftHip, rightHip) : shoulders;
    const target = { x: shoulders.x + hips.x, z: shoulders.z + hips.z };
    const length = Math.hypot(target.x, target.z) || 1;
    const unit = { x: target.x / length, z: target.z / length };
    if (!this.heading) {
      this.heading = unit;
    } else if (!hold) {
      const alpha = 1 - Math.exp(-dt / this.config.view.headingTauMs);
      const x = this.heading.x + alpha * (unit.x - this.heading.x);
      const z = this.heading.z + alpha * (unit.z - this.heading.z);
      const size = Math.hypot(x, z) || 1;
      this.heading = { x: x / size, z: z / size };
    }
    return this.heading;
  }

  private seen(landmark: Landmark | undefined, min: number = this.config.input.minVisibility): landmark is Landmark {
    if (!landmark || !Number.isFinite(landmark.x + landmark.y + landmark.z)) return false;
    return (landmark.visibility ?? 1) >= min;
  }

  /**
   * Off-axis an arm is often behind the body or the bag. The model still places it and it still moves
   * when thrown, so it's kept for counting, and its low visibility stops the punch being named.
   */
  private minVisibilityFor(index: number) {
    const { input, view } = this.config;
    const isArm = index === LM.LEFT_ELBOW || index === LM.RIGHT_ELBOW || index === LM.LEFT_WRIST || index === LM.RIGHT_WRIST;
    if (!isArm || !this.heading) return input.minVisibility;
    const yawNow = Math.abs((Math.atan2(this.heading.z, this.heading.x) * 180) / Math.PI);
    return yawNow >= view.hiddenArmYaw ? view.hiddenArmVisibility : input.minVisibility;
  }

  private smooth(landmarks: Landmark[], dt: number) {
    const alpha = 1 - Math.exp(-dt / this.config.input.smoothingTauMs);
    for (const index of JOINTS) {
      const raw = landmarks[index];
      if (!this.seen(raw, this.minVisibilityFor(index))) {
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

  /**
   * Returns null until the shoulders have been seen for long enough to trust the scale. Hips and head
   * can be out of the picture. Pass holdHeading during a punch, so its body turn stays in the numbers.
   */
  push(t: number, landmarks: Landmark[], holdHeading = false): BodyPose | null {
    if (this.lastT !== null && t - this.lastT > this.config.input.maxGapMs) this.reset();
    const dt = this.lastT === null ? 1000 : Math.max(1, t - this.lastT);
    this.lastT = t;
    this.smooth(landmarks, dt);

    const leftShoulder = this.smoothed.get(LM.LEFT_SHOULDER);
    const rightShoulder = this.smoothed.get(LM.RIGHT_SHOULDER);
    const leftHip = this.smoothed.get(LM.LEFT_HIP);
    const rightHip = this.smoothed.get(LM.RIGHT_HIP);
    const nose = this.smoothed.get(LM.NOSE);
    if (!leftShoulder || !rightShoulder) return null;

    const torso = leftHip && rightHip ? dist(mid(leftShoulder, rightShoulder), mid(leftHip, rightHip)) : 0;
    this.widths.push(Math.max(dist(leftShoulder, rightShoulder), torso * this.config.view.torsoToShoulderWidth));
    if (this.widths.length > this.config.input.scaleWindowFrames) this.widths.shift();
    if (this.widths.length < this.config.input.warmupFrames) return null;
    const unit = median(this.widths);
    if (unit <= 0) return null;

    const heading = this.updateHeading(leftShoulder, rightShoulder, leftHip, rightHip, dt, holdHeading);
    const origin = mid(leftShoulder, rightShoulder);
    const turn = (x: number, z: number) => ({ x: x * heading.x + z * heading.z, z: -x * heading.z + z * heading.x });
    let tilt = this.cameraTilt;
    let spineTilt = this.spineTilt;
    if (leftHip && rightHip) {
      const hips = mid(leftHip, rightHip);
      const spine = turn(origin.x - hips.x, hips.z - origin.z);
      if (!holdHeading) {
        const alpha = 1 - Math.exp(-dt / this.config.view.headingTauMs);
        const reading = (Math.atan2(hips.z - origin.z, hips.y - origin.y) * 180) / Math.PI;
        this.spineTilt = this.spineTilt === null ? reading : this.spineTilt + alpha * (reading - this.spineTilt);
      }
      spineTilt = this.spineTilt;
      tilt = this.updateTilt(spine.z, hips.y - origin.y, dt, holdHeading);
    }
    const cosTilt = Math.cos(tilt);
    const sinTilt = Math.sin(tilt);
    const level = (y: number, z: number) => ({ y: y * cosTilt + z * sinTilt, z: -y * sinTilt + z * cosTilt });
    const toBody = (point: Vec3): Vec3 => {
      const flat = turn((point.x - origin.x) / unit, -(point.z - origin.z) / unit);
      const { y, z } = level(-(point.y - origin.y) / unit, flat.z);
      return { x: flat.x, y, z };
    };
    const cameraFlat = turn(0, 1);
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
        guessed: [wrist, elbow].some((joint) => !!joint && (joint.visibility ?? 1) < this.config.input.minVisibility),
      };
    };

    const mouthLeft = this.smoothed.get(LM.MOUTH_LEFT);
    const mouthRight = this.smoothed.get(LM.MOUTH_RIGHT);
    // Out of the picture, the head is where it last was, or about where heads are
    const bodyNose = nose ? toBody(nose) : this.lastNose ?? { x: 0, y: this.config.view.assumedNoseHeight, z: 0 };
    if (nose) this.lastNose = bodyNose;
    const mouthY = mouthLeft && mouthRight ? toBody(mid(mouthLeft, mouthRight)).y : bodyNose.y - 0.1;

    return {
      t,
      left: arm('left'),
      right: arm('right'),
      nose: bodyNose,
      chinY: mouthY - this.config.guard.chinBelowMouth,
      shoulderYaw: yaw(leftShoulder, rightShoulder),
      hipYaw: leftHip && rightHip ? yaw(leftHip, rightHip) : yaw(leftShoulder, rightShoulder),
      viewYaw: (Math.atan2(heading.z, heading.x) * 180) / Math.PI,
      camera: { x: cameraFlat.x, ...level(0, cameraFlat.z) },
      spineTilt: spineTilt ?? 0,
      headSeen: !!nose,
    };
  }
}
