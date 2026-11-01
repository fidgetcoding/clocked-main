import { BodyTracker, dist, jointAngle, sub, type ArmPose, type BodyPose, type Vec3 } from './body';
import { classifyPunch } from './classify';
import { PUNCH_CONFIG, type PunchConfig } from './config';
import type { FormIssue, Hand, PunchClass, PunchEvent, PoseFrame, Side, Stance } from './types';

type Phase = 'idle' | 'extending' | 'returning';

interface ExtensionSample {
  pose: BodyPose;
  wrist: Vec3;
  distance: number;
}

interface HandState {
  side: Side;
  hand: Hand;
  phase: Phase;
  /** Where the hand rests, in body coordinates. */
  anchor: Vec3 | null;
  /** Where the current extension started: the anchor, or the low point of a partial return. */
  origin: Vec3 | null;
  samples: ExtensionSample[];
  peakIndex: number;
  peakSpeed: number;
  slowFrames: number;
  /** The punch this hand owes a return for. */
  openPunchId: number | null;
  openPeakT: number;
  troughDistance: number;
  troughPose: BodyPose | null;
  /** The frame the wrist was lowest while returning, where an uppercut would start from. */
  turnPose: BodyPose | null;
  settledSince: number | null;
  lowSince: number | null;
  lastWrist: Vec3 | null;
  lastT: number | null;
  speed: number;
  /** The last frame this hand was at rest, the baseline for measuring rotation. */
  restPose: BodyPose | null;
  /** State of the other hand while this one extends. */
  otherStartedIdle: boolean;
  otherStartedLow: boolean;
  otherFarthest: number;
}

const newHand = (side: Side, hand: Hand): HandState => ({
  side,
  hand,
  phase: 'idle',
  anchor: null,
  origin: null,
  samples: [],
  peakIndex: 0,
  peakSpeed: 0,
  slowFrames: 0,
  openPunchId: null,
  openPeakT: 0,
  troughDistance: Infinity,
  troughPose: null,
  turnPose: null,
  settledSince: null,
  lowSince: null,
  lastWrist: null,
  lastT: null,
  speed: 0,
  restPose: null,
  otherStartedIdle: false,
  otherStartedLow: false,
  otherFarthest: 0,
});

const armOf = (pose: BodyPose, side: Side): ArmPose => (side === 'left' ? pose.left : pose.right);

/**
 * Turns timestamped pose frames into punch and form events. Pure: no DOM, no clock, no I/O.
 * Each hand runs idle -> extending -> returning, with separate thresholds to enter and leave each
 * step so that a noisy wrist can't flip it back and forth.
 */
export class PunchDetector {
  private readonly body: BodyTracker;
  private left: HandState;
  private right: HandState;
  private nextId = 1;
  private lastPunchT = -Infinity;
  private lastLowFlagT = -Infinity;
  private lastT: number | null = null;

  constructor(
    private readonly stance: Stance,
    private readonly config: PunchConfig = PUNCH_CONFIG,
  ) {
    this.body = new BodyTracker(config);
    this.left = newHand('left', stance === 'orthodox' ? 'lead' : 'rear');
    this.right = newHand('right', stance === 'orthodox' ? 'rear' : 'lead');
  }

  private resetHands() {
    this.left = newHand('left', this.left.hand);
    this.right = newHand('right', this.right.hand);
  }

  /** Feed one frame. Timestamps must increase. Returns whatever this frame completed. */
  push(frame: PoseFrame): PunchEvent[] {
    if (this.lastT !== null && frame.t - this.lastT > this.config.input.maxGapMs) {
      this.body.reset();
      this.resetHands();
    }
    if (!frame.landmarks) return [];
    this.lastT = frame.t;

    const pose = this.body.push(frame.t, frame.landmarks);
    if (!pose) return [];

    const events: PunchEvent[] = [];
    this.step(this.left, this.right, pose, events);
    this.step(this.right, this.left, pose, events);
    return events;
  }

  private step(state: HandState, other: HandState, pose: BodyPose, events: PunchEvent[]) {
    const wrist = armOf(pose, state.side).wrist;
    if (!wrist) {
      // Not seen: abandon any extension in progress rather than judging it on missing data
      state.lastWrist = null;
      state.lowSince = null;
      if (state.phase === 'extending') this.beginReturn(state, state.origin ?? state.anchor);
      return;
    }

    const dt = state.lastT === null ? 0 : pose.t - state.lastT;
    state.speed = state.lastWrist && dt > 0 ? (dist(wrist, state.lastWrist) / dt) * 1000 : 0;
    state.lastWrist = wrist;
    state.lastT = pose.t;

    if (state.phase === 'idle') this.stepIdle(state, other, pose, wrist, dt, events);
    else if (state.phase === 'extending') this.stepExtending(state, other, pose, wrist, events);
    else this.stepReturning(state, other, pose, wrist, events);
  }

  private isLow(wrist: Vec3, pose: BodyPose) {
    return wrist.y < pose.chinY - this.config.guard.belowChinMargin;
  }

  private inGuard(wrist: Vec3, pose: BodyPose) {
    return dist(wrist, pose.nose) <= this.config.guard.radius && !this.isLow(wrist, pose);
  }

  private stepIdle(state: HandState, other: HandState, pose: BodyPose, wrist: Vec3, dt: number, events: PunchEvent[]) {
    const { rest, motion, form } = this.config;
    if (!state.anchor) {
      state.anchor = wrist;
      return;
    }

    if (this.isLow(wrist, pose)) {
      state.lowSince ??= pose.t;
      if (
        pose.t - state.lowSince >= form.handsLowHoldMs &&
        pose.t - this.lastPunchT <= form.activeWindowMs &&
        pose.t - this.lastLowFlagT >= form.handsLowCooldownMs
      ) {
        this.lastLowFlagT = pose.t;
        events.push({ type: 'form', t: pose.t, punchId: null, hand: state.hand, issue: 'chin_exposed' });
      }
    } else {
      state.lowSince = null;
    }

    const distance = dist(wrist, state.anchor);
    if (distance >= motion.startDistance && state.speed >= motion.startSpeed) {
      this.beginExtension(state, other, pose, wrist, state.anchor);
      return;
    }
    if (state.speed < rest.settleSpeed) {
      state.restPose = pose;
      const alpha = 1 - Math.exp(-dt / rest.anchorTauMs);
      state.anchor = {
        x: state.anchor.x + alpha * (wrist.x - state.anchor.x),
        y: state.anchor.y + alpha * (wrist.y - state.anchor.y),
        z: state.anchor.z + alpha * (wrist.z - state.anchor.z),
      };
    }
  }

  private beginExtension(state: HandState, other: HandState, pose: BodyPose, wrist: Vec3, origin: Vec3) {
    const otherWrist = armOf(pose, other.side).wrist;
    state.phase = 'extending';
    state.origin = origin;
    state.samples = [{ pose, wrist, distance: dist(wrist, origin) }];
    state.peakIndex = 0;
    state.peakSpeed = state.speed;
    state.slowFrames = 0;
    state.lowSince = null;
    state.otherStartedIdle = other.openPunchId === null;
    state.otherStartedLow = other.phase === 'idle' && !!otherWrist && this.isLow(otherWrist, pose);
    state.otherFarthest = 0;
  }

  private stepExtending(state: HandState, other: HandState, pose: BodyPose, wrist: Vec3, events: PunchEvent[]) {
    const { motion, form } = this.config;
    const distance = dist(wrist, state.origin!);
    state.samples.push({ pose, wrist, distance });
    state.peakSpeed = Math.max(state.peakSpeed, state.speed);
    if (distance >= state.samples[state.peakIndex].distance) state.peakIndex = state.samples.length - 1;

    // The other hand moving forward is probably the next punch, not a guard coming down
    const otherWrist = armOf(pose, other.side).wrist;
    if (otherWrist && other.anchor) {
      const moved = sub(otherWrist, other.anchor);
      const away = dist(otherWrist, other.anchor);
      if (moved.z < form.otherHandForwardShare * away) state.otherFarthest = Math.max(state.otherFarthest, away);
    }

    const peak = state.samples[state.peakIndex];
    state.slowFrames = state.speed < motion.holdSpeed ? state.slowFrames + 1 : 0;
    const fellBack = distance < peak.distance - Math.max(peak.distance * motion.peakDropShare, motion.peakDropMin);
    const held = state.slowFrames >= motion.holdFrames;
    const tooLong = pose.t - state.samples[0].pose.t > motion.maxDurationMs;
    if (!fellBack && !held && !tooLong) return;

    if (!tooLong) this.finishExtension(state, peak, events);
    this.beginReturn(state, state.anchor);
    state.turnPose = peak.pose;
  }

  private beginReturn(state: HandState, anchor: Vec3 | null) {
    state.phase = 'returning';
    state.anchor = anchor;
    state.troughDistance = Infinity;
    state.troughPose = null;
    state.turnPose = null;
    state.settledSince = null;
    state.samples = [];
  }

  private finishExtension(state: HandState, peak: ExtensionSample, events: PunchEvent[]) {
    const { motion, form } = this.config;
    const origin = state.origin!;
    const first = state.samples[0];
    const startPose = state.restPose ?? first.pose;
    const durationMs = peak.pose.t - startPose.t;
    const delta = sub(peak.wrist, origin);
    const distance = dist(peak.wrist, origin);
    const startsLow = -origin.y > motion.maxStartBelowShoulder;
    const goesDown = -delta.y > motion.maxDownShare * distance;
    // A punch moves the arm, not just the torso it hangs from, so a twist doesn't count
    const startArm = armOf(startPose, state.side);
    const armMoved = startArm.wrist
      ? dist(sub(peak.wrist, armOf(peak.pose, state.side).shoulder), sub(startArm.wrist, startArm.shoulder))
      : 0;
    const raisesGuard = delta.y > motion.upwardShare * distance && peak.wrist.z < motion.upwardMinForward;
    if (
      raisesGuard ||
      armMoved < motion.minArmMove ||
      distance < motion.minPeakDistance ||
      state.peakSpeed < motion.minPeakSpeed ||
      durationMs < motion.minDurationMs ||
      durationMs > motion.maxDurationMs ||
      startsLow ||
      goesDown
    ) {
      return;
    }

    const arm = armOf(peak.pose, state.side);
    if (!arm.wrist || !arm.elbow) return;
    const across = state.side === 'left' ? -delta.x : delta.x;
    const upperArm = dist(arm.shoulder, arm.elbow);
    const foreArm = dist(arm.elbow, arm.wrist);
    const elbow = jointAngle(arm.shoulder, arm.elbow, arm.wrist);
    const reach = dist(arm.shoulder, arm.wrist) / Math.max(upperArm + foreArm, 1e-6);
    const visibility =
      state.samples.reduce((sum, s) => sum + armOf(s.pose, state.side).visibility, 0) / state.samples.length;

    const shape = {
      reach,
      elbow,
      forwardShare: Math.max(0, delta.z) / distance,
      acrossShare: Math.max(0, across) / distance,
      upShare: Math.max(0, delta.y) / distance,
      outwardShare: Math.max(0, -across) / distance,
      rise: Math.max(0, delta.y),
      visibility,
    };
    const result = classifyPunch(state.hand, shape, this.config);

    // Positive when the rear side came forward. The rear side is the right one for orthodox.
    const rearForward = this.stance === 'orthodox' ? 1 : -1;
    const shoulderRotation = (startPose.shoulderYaw - peak.pose.shoulderYaw) * rearForward;
    const hipRotation = (startPose.hipYaw - peak.pose.hipYaw) * rearForward;

    const armShort = elbow < form.fullExtensionElbow && reach < form.fullExtensionReach;
    const issues = this.peakIssues(state, result.punch, result.depthUnreliable, armShort, shoulderRotation, hipRotation);
    const id = this.nextId++;
    this.lastPunchT = peak.pose.t;
    state.openPunchId = id;
    state.openPeakT = peak.pose.t;

    events.push({
      type: 'punch',
      id,
      t: peak.pose.t,
      side: state.side,
      hand: state.hand,
      punch: result.punch,
      confidence: result.confidence,
      issues,
      metrics: {
        distance,
        peakSpeed: state.peakSpeed,
        durationMs,
        reach,
        elbow,
        forwardShare: shape.forwardShare,
        acrossShare: shape.acrossShare,
        upShare: shape.upShare,
        shoulderRotation,
        hipRotation,
        scores: result.scores,
      },
    });
  }

  private peakIssues(
    state: HandState,
    punch: PunchClass,
    depthUnreliable: boolean,
    armShort: boolean,
    shoulderRotation: number,
    hipRotation: number,
  ): FormIssue[] {
    const { form } = this.config;
    const issues: FormIssue[] = [];

    if (state.otherStartedIdle) {
      if (state.otherStartedLow) issues.push('chin_exposed');
      else if (state.otherFarthest >= form.otherHandDistance) issues.push('other_hand_left_guard');
    }

    if ((punch === 'jab' || punch === 'cross') && !depthUnreliable && armShort) {
      issues.push('arm_not_extended');
    }
    if ((punch === 'lead_hook' || punch === 'rear_hook') && this.elbowFlared(state)) {
      issues.push('elbow_flare');
    }
    if (punch === 'cross' && !depthUnreliable && shoulderRotation < form.minShoulderRotation && hipRotation < form.minHipRotation) {
      issues.push('no_rotation');
    }
    return issues;
  }

  private elbowFlared(state: HandState) {
    const { form } = this.config;
    const outwardSign = state.side === 'left' ? 1 : -1;
    return state.samples.some((sample) => {
      const arm = armOf(sample.pose, state.side);
      if (!arm.elbow) return false;
      const fromShoulder = sub(arm.elbow, arm.shoulder);
      return fromShoulder.x * outwardSign > form.flareOutward || fromShoulder.y > form.flareAboveShoulder;
    });
  }

  private stepReturning(state: HandState, other: HandState, pose: BodyPose, wrist: Vec3, events: PunchEvent[]) {
    const { rest, motion, form } = this.config;
    const anchor = state.anchor ?? wrist;
    const distance = dist(wrist, anchor);

    // Rising from a dip heads back toward the guard, so it has to be caught before the return is
    const lowest = state.turnPose && armOf(state.turnPose, state.side).wrist;
    if (!lowest || wrist.y < lowest.y) {
      state.turnPose = pose;
    } else if (state.openPunchId === null && state.speed >= motion.startSpeed) {
      const risen = dist(wrist, lowest);
      if (risen >= motion.startDistance && wrist.y - lowest.y >= rest.riseShare * risen) {
        state.restPose = state.turnPose;
        this.beginExtension(state, other, pose, wrist, lowest);
        return;
      }
    }

    const stoppedInGuard = this.inGuard(wrist, pose) && state.speed < rest.settleSpeed;
    if (distance <= rest.returnDistance || stoppedInGuard) {
      state.phase = 'idle';
      state.openPunchId = null;
      if (stoppedInGuard) state.anchor = wrist;
      return;
    }

    if (state.openPunchId !== null && pose.t - state.openPeakT >= form.returnWindowMs) {
      events.push({ type: 'form', t: pose.t, punchId: state.openPunchId, hand: state.hand, issue: 'slow_return' });
      state.openPunchId = null;
    }

    if (distance < state.troughDistance) {
      state.troughDistance = distance;
      state.troughPose = pose;
    }
    const start = state.troughPose ? armOf(state.troughPose, state.side).wrist ?? wrist : wrist;
    const outAgain = dist(wrist, start);
    if (outAgain >= rest.restartDistance && state.speed >= motion.startSpeed && distance > state.troughDistance) {
      state.openPunchId = null;
      state.restPose = state.troughPose;
      this.beginExtension(state, other, pose, wrist, start);
      return;
    }

    if (state.speed < rest.settleSpeed) {
      state.settledSince ??= pose.t;
      if (pose.t - state.settledSince >= rest.settleHoldMs) {
        state.phase = 'idle';
        state.anchor = wrist;
        state.openPunchId = null;
      }
    } else {
      state.settledSince = null;
    }
  }
}
