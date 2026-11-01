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
  /** Where the elbow was at the same time. */
  elbowAnchor: Vec3 | null;
  /** Where the hand last rested with the chin covered. */
  guardRest: Vec3 | null;
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
  speedHistory: { t: number; speed: number }[];
  /** Last frame's distance from rest: a wrist still heading home must not start a punch. */
  lastRestDistance: number;
  /** The last time this wrist was up around the chin, which tells a wind-up from resting low. */
  lastCoveredT: number;
  /** The current extension is rising out of a dip, rather than starting from rest. */
  fromDip: boolean;
  /** That dip was quick: a wind-up, not a hand coming up from resting low. */
  fromWindUp: boolean;
  /** The last frame this hand was at rest, the baseline for measuring rotation. */
  restPose: BodyPose | null;
  /** State of the other hand while this one extends. */
  otherStartedIdle: boolean;
  otherStartedLow: boolean;
}

const newHand = (side: Side, hand: Hand): HandState => ({
  side,
  hand,
  phase: 'idle',
  anchor: null,
  elbowAnchor: null,
  guardRest: null,
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
  speedHistory: [],
  lastRestDistance: Infinity,
  lastCoveredT: -Infinity,
  fromDip: false,
  fromWindUp: false,
  restPose: null,
  otherStartedIdle: false,
  otherStartedLow: false,
});

const armOf = (pose: BodyPose, side: Side): ArmPose => (side === 'left' ? pose.left : pose.right);
const degrees = (radians: number) => (radians * 180) / Math.PI;
const planarDistance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y);
const elbowAngleOf = (arm: ArmPose) =>
  arm.wrist && arm.elbow ? jointAngle(arm.shoulder, arm.elbow, arm.wrist) : null;

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
  private lastPose: BodyPose | null = null;
  private glitchUntil = -Infinity;
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
    // Anything measured over time would run backward on a frame out of order
    if (this.lastT !== null && frame.t <= this.lastT) return [];
    if (this.lastT !== null && frame.t - this.lastT > this.config.input.maxGapMs) {
      this.body.reset();
      this.resetHands();
    }
    if (!frame.landmarks) return [];
    this.lastT = frame.t;

    const pose = this.body.push(frame.t, frame.landmarks);
    if (!pose) return [];

    const events: PunchEvent[] = [];
    if (this.isGlitch(pose, events)) return events;

    this.step(this.left, this.right, pose, events);
    this.step(this.right, this.left, pose, events);
    return events;
  }

  /**
   * Shoulders can't really turn this fast, so the model has lost the pose for a moment, and both
   * arms jump with it. Those frames are never judged.
   */
  private isGlitch(pose: BodyPose, events: PunchEvent[]) {
    const { maxYawSpeed, glitchHoldMs } = this.config.input;
    const last = this.lastPose;
    this.lastPose = pose;
    const dt = last ? pose.t - last.t : 0;
    if (last && dt > 0 && (Math.abs(pose.shoulderYaw - last.shoulderYaw) / dt) * 1000 > maxYawSpeed) {
      this.glitchUntil = pose.t + glitchHoldMs;
    }
    if (pose.t >= this.glitchUntil) return false;
    // Fast punches are what set this off, so the arm that was furthest into one keeps it, judged
    // on the good frames so far
    const moving = [this.left, this.right].filter((state) => state.phase === 'extending');
    const furthest = (state: HandState) => state.samples[state.peakIndex].distance;
    const puncher = moving.sort((a, b) => furthest(b) - furthest(a))[0];
    if (puncher) this.finishExtension(puncher, puncher === this.left ? this.right : this.left, puncher.samples[puncher.peakIndex], events);
    for (const state of moving) this.beginReturn(state, state.anchor);
    this.left.lastWrist = null;
    this.right.lastWrist = null;
    return true;
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
    state.speedHistory.push({ t: pose.t, speed: state.speed });
    if (state.speedHistory.length > 8) state.speedHistory.shift();
    if (!this.isLow(wrist, pose)) state.lastCoveredT = pose.t;

    if (state.phase === 'idle') this.stepIdle(state, other, pose, wrist, dt, events);
    else if (state.phase === 'extending') this.stepExtending(state, other, pose, wrist, events);
    else this.stepReturning(state, other, pose, wrist, events);
  }

  private recentSpeed(state: HandState, t: number) {
    const { recentSpeedMs } = this.config.motion;
    return state.speedHistory.reduce((best, sample) => (t - sample.t <= recentSpeedMs ? Math.max(best, sample.speed) : best), 0);
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
    // Recent, because at low frame rates the fast part of a short punch can land just before the distance does
    const elbow = armOf(pose, state.side).elbow;
    const elbowMoved = elbow && state.elbowAnchor ? planarDistance(elbow, state.elbowAnchor) : 0;
    const movingAway = distance > state.lastRestDistance;
    state.lastRestDistance = distance;
    // Thrown at the camera, a straight barely moves the wrist in the picture but it lifts the elbow
    // Depth only counts toward the camera: the model's depth jitters backward on a still hand, and
    // that hand then looks busy and hides the real punch from the other one
    const seenMove = Math.hypot(wrist.x - state.anchor.x, wrist.y - state.anchor.y, Math.max(0, wrist.z - state.anchor.z));
    const started = seenMove >= motion.startDistance || (other.phase === 'idle' && elbowMoved >= motion.elbowStartMove);
    if (movingAway && started && this.recentSpeed(state, pose.t) >= motion.startSpeed) {
      this.beginExtension(state, other, pose, wrist, state.anchor);
      return;
    }
    if (state.speed < rest.settleSpeed) {
      state.restPose = pose;
      if (elbow) state.elbowAnchor = elbow;
      if (!this.isLow(wrist, pose)) state.guardRest = wrist;
      const alpha = 1 - Math.exp(-dt / rest.anchorTauMs);
      state.anchor = {
        x: state.anchor.x + alpha * (wrist.x - state.anchor.x),
        y: state.anchor.y + alpha * (wrist.y - state.anchor.y),
        z: state.anchor.z + alpha * (wrist.z - state.anchor.z),
      };
    }
  }

  private beginExtension(state: HandState, other: HandState, pose: BodyPose, wrist: Vec3, origin: Vec3) {
    // Measured from just before this hand moved, as the guard can start slipping at the same moment
    const otherWrist = armOf(state.restPose ?? pose, other.side).wrist;
    state.phase = 'extending';
    state.fromDip = false;
    state.fromWindUp = false;
    state.origin = origin;
    state.samples = [{ pose, wrist, distance: dist(wrist, origin) }];
    state.peakIndex = 0;
    state.peakSpeed = this.recentSpeed(state, pose.t);
    state.slowFrames = 0;
    state.lowSince = null;
    state.otherStartedIdle = other.openPunchId === null;
    state.otherStartedLow = !!otherWrist && this.isLow(otherWrist, state.restPose ?? pose);
  }

  private stepExtending(state: HandState, other: HandState, pose: BodyPose, wrist: Vec3, events: PunchEvent[]) {
    const { motion } = this.config;
    const distance = dist(wrist, state.origin!);
    state.samples.push({ pose, wrist, distance });
    state.peakSpeed = Math.max(state.peakSpeed, state.speed);
    if (distance >= state.samples[state.peakIndex].distance) state.peakIndex = state.samples.length - 1;

    const peak = state.samples[state.peakIndex];
    state.slowFrames = state.speed < motion.holdSpeed ? state.slowFrames + 1 : 0;
    const fellBack = distance < peak.distance - Math.max(peak.distance * motion.peakDropShare, motion.peakDropMin);
    const held = state.slowFrames >= motion.holdFrames;
    // A slow way home shouldn't lose a punch that peaked a while ago
    const peakIsOld = pose.t - peak.pose.t > motion.peakMaxAgeMs;
    // A wrist that keeps drifting out at speed is no punch, and this is what bounds the samples
    if (pose.t - state.samples[0].pose.t > motion.maxExtensionMs) {
      this.beginReturn(state, state.anchor);
      return;
    }
    if (!fellBack && !held && !peakIsOld) return;

    this.finishExtension(state, other, peak, events);
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

  private finishExtension(state: HandState, other: HandState, peak: ExtensionSample, events: PunchEvent[]) {
    const { motion, form } = this.config;
    const origin = state.origin!;
    const first = state.samples[0];
    const startPose = state.restPose ?? first.pose;
    const durationMs = peak.pose.t - startPose.t;
    const delta = sub(peak.wrist, origin);
    const distance = dist(peak.wrist, origin);
    const startsLow = !state.fromWindUp && -origin.y > motion.maxStartBelowShoulder;
    const goesDown = -delta.y > motion.maxDownShare * distance;
    // A punch moves the arm, not just the torso it hangs from, so a twist doesn't count
    const startArm = armOf(startPose, state.side);
    const armMoved = startArm.wrist
      ? dist(sub(peak.wrist, armOf(peak.pose, state.side).shoulder), sub(startArm.wrist, startArm.shoulder))
      : 0;
    const endsAtGuard = state.guardRest
      ? dist(peak.wrist, state.guardRest) < motion.raiseNearGuard
      : peak.wrist.z < motion.upwardMinForward;
    // Seen by the model, a real uppercut comes back up to about where the guard was. Only a deep,
    // quick dip tells it from the hands just coming back up.
    const deepDip = state.fromWindUp && !!state.guardRest && state.guardRest.y - origin.y >= motion.minUppercutDip;
    const raisesGuard = (state.fromDip || delta.y > motion.upwardShare * distance) && endsAtGuard && !deepDip;
    // Moving down and not forward is a wind-up, and moving back with no arc is the other hand's recoil
    const windsUp = delta.y < -motion.windUpDrop && delta.z < motion.windUpForward;
    const recoils =
      delta.z < -motion.recoilBackShare * distance &&
      delta.y < motion.recoilMaxRise &&
      Math.abs(state.side === 'left' ? -delta.x : delta.x) < motion.recoilMaxAcross;
    const peakElbow = armOf(peak.pose, state.side).elbow;
    const elbowMoved = peakElbow && state.elbowAnchor ? planarDistance(peakElbow, state.elbowAnchor) : 0;
    const movedEnough =
      other.phase === 'idle'
        ? (distance >= motion.minPeakDistance && armMoved >= motion.minArmMove) ||
          (distance >= motion.minWristMoveWithElbow && elbowMoved >= motion.minElbowMove)
        : distance >= motion.minPeakDistanceOtherBusy && armMoved >= motion.minArmMove;
    if (
      raisesGuard ||
      windsUp ||
      recoils ||
      !movedEnough ||
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

    const armDelta = startArm.wrist
      ? sub(sub(peak.wrist, arm.shoulder), sub(startArm.wrist, startArm.shoulder))
      : delta;
    const armAcross = Math.max(0, state.side === 'left' ? -armDelta.x : armDelta.x);
    const armTravel = Math.max(Math.hypot(armDelta.x, armDelta.z), 1e-6);
    const forearm = sub(arm.wrist, arm.elbow);
    // The second half of the way to the peak: an uppercut's wind-up starts with the arm long
    const toPeak = state.samples.slice(0, state.peakIndex + 1);
    const elbowHistory = toPeak
      .slice(Math.floor(toPeak.length / 2))
      .map((sample) => elbowAngleOf(armOf(sample.pose, state.side)))
      .filter((angle): angle is number => angle !== null)
      .sort((a, b) => b - a);
    const startElbow = elbowAngleOf(startArm) ?? elbowHistory[elbowHistory.length - 1] ?? elbow;

    const shape = {
      reach,
      elbow,
      elbowHeldMax: elbowHistory[1] ?? elbowHistory[0] ?? elbow,
      elbowOpening: elbow - startElbow,
      forwardShare: Math.max(0, delta.z) / distance,
      upShare: Math.max(0, delta.y) / distance,
      armAcross,
      armAcrossShare: armAcross / armTravel,
      outwardShare: Math.max(0, -across) / distance,
      rise: Math.max(0, delta.y),
      startBelowShoulder: (startArm.wrist ? startArm.shoulder.y : origin.y) - origin.y,
      forearmFromVertical: degrees(Math.atan2(Math.abs(forearm.x), forearm.y)),
      forearmFromLevel: degrees(Math.atan2(Math.abs(forearm.y), Math.abs(forearm.x))),
      upperArmBelowLevel: degrees(Math.asin(Math.max(-1, Math.min(1, (arm.shoulder.y - arm.elbow.y) / Math.max(upperArm, 1e-6))))),
      visibility,
    };
    const result = classifyPunch(state.hand, shape, this.config);
    // Coming up out of a dip with no arc and no long arm is a hand going home, not a straight
    if (state.fromDip && !deepDip && result.shape === 'straight' && result.scores.byElimination) return;

    // Positive when the rear side came forward. The rear side is the right one for orthodox.
    const rearForward = this.stance === 'orthodox' ? 1 : -1;
    const shoulderRotation = (startPose.shoulderYaw - peak.pose.shoulderYaw) * rearForward;
    const hipRotation = (startPose.hipYaw - peak.pose.hipYaw) * rearForward;

    const armShort = elbow < form.fullExtensionElbow && reach < form.fullExtensionReach;
    const issues = this.peakIssues(state, other, peak, result.punch, result.depthUnreliable, armShort, shoulderRotation, hipRotation);
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
        elbowHeldMax: shape.elbowHeldMax,
        elbowOpening: shape.elbowOpening,
        forwardShare: shape.forwardShare,
        armAcross: shape.armAcross,
        upShare: shape.upShare,
        rise: shape.rise,
        startBelowShoulder: shape.startBelowShoulder,
        forearmFromVertical: shape.forearmFromVertical,
        forearmFromLevel: shape.forearmFromLevel,
        upperArmBelowLevel: shape.upperArmBelowLevel,
        shoulderRotation,
        hipRotation,
        scores: result.scores,
      },
    });
  }

  private peakIssues(
    state: HandState,
    other: HandState,
    peak: ExtensionSample,
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
      else if (this.otherHandDropped(other, peak.pose)) issues.push('other_hand_left_guard');
    }

    if ((punch === 'jab' || punch === 'cross') && !depthUnreliable && armShort) {
      issues.push('arm_not_extended');
    }
    if ((punch === 'lead_hook' || punch === 'rear_hook') && this.elbowFlared(state)) {
      issues.push('elbow_flare');
    }
    if (punch === 'cross' && shoulderRotation < form.minShoulderRotation && hipRotation < form.minHipRotation) {
      issues.push('no_rotation');
    }
    return issues;
  }

  /**
   * Measured against that arm's own shoulder and in the picture only. The model's depth, and the
   * shoulders turning, move a guard hand a long way relative to the chest when it hasn't left.
   */
  private otherHandDropped(other: HandState, pose: BodyPose) {
    const arm = armOf(pose, other.side);
    return !!arm.wrist && arm.shoulder.y - arm.wrist.y > this.config.form.otherHandBelowShoulder;
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
        state.fromDip = true;
        state.fromWindUp = state.turnPose!.t - state.lastCoveredT <= motion.windUpMaxMs;
        return;
      }
    }

    const stoppedInGuard = this.inGuard(wrist, pose) && state.speed < rest.settleSpeed;
    if (distance <= rest.returnDistance || stoppedInGuard) {
      state.phase = 'idle';
      state.openPunchId = null;
      state.lastRestDistance = Infinity;
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
