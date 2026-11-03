import { BodyTracker, dist, LM, type BodyPose, type Vec3 } from './body';
import { PUNCH_CONFIG, type PunchConfig } from './config';
import type { Landmark, Stance } from './types';

const LEFT_ANKLE = 27;
const RIGHT_ANKLE = 28;

export type CameraSide = 'front' | 'left' | 'right' | 'side_left' | 'side_right' | 'behind';
export type CameraHeight = 'level' | 'high' | 'low';

export interface StartCheckResult {
  /** The shoulders and hips were in the picture for most of the check. */
  framed: boolean;
  headCut: boolean;
  legsCut: boolean;
  /** Shoulder width in the model's metres, as the scale everything else is measured in. */
  scale: number;
  /** How far the camera is from straight in front of you, in degrees, positive on your left. About, not exact. */
  cameraAngle: number;
  cameraSide: CameraSide;
  cameraHeight: CameraHeight;
  /** Null when neither the feet nor the hands said. */
  stance: Stance | null;
  /** Where your hands rest in your own frame of reference. Null when they weren't up and still. */
  guard: { left: Vec3; right: Vec3 } | null;
  /** The check saw too little to say anything about the camera. */
  gaveUp: boolean;
  /** Still hands looked like they were moving, so tracking won't be reliable from here. */
  shaky: boolean;
  /** Share of the check with a person in the picture. A bag between you and the camera drops this. */
  seenShare: number;
  /** Your body was seen but a hand mostly wasn't, because of your body or the bag. */
  handsHidden: boolean;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)];
};

const seen = (point: Landmark | undefined, min: number) => !!point && (point.visibility ?? 1) >= min;

/**
 * The model reads a body turned from the camera as turned less than it is, and most of all near the
 * front. These points map its reading to the real angle, measured on a rendered figure, so the
 * result is a rough guide.
 */
const READING_TO_ANGLE: [number, number][] = [[0, 0], [10, 25], [35, 60], [80, 90], [90, 95], [180, 180]];

export function cameraAngleFromReading(reading: number): number {
  const size = Math.abs(reading);
  for (let i = 1; i < READING_TO_ANGLE.length; i += 1) {
    const [fromReading, fromAngle] = READING_TO_ANGLE[i - 1];
    const [toReading, toAngle] = READING_TO_ANGLE[i];
    if (size <= toReading) {
      const angle = fromAngle + ((size - fromReading) / (toReading - fromReading)) * (toAngle - fromAngle);
      return Math.sign(reading) * angle;
    }
  }
  return reading;
}

/**
 * About five seconds at the start of a session: are you framed, how big are you, where's the camera,
 * which stance, and where do your hands rest. It only watches. Punches thrown meanwhile still count,
 * and it learns nothing about individual punches.
 */
export class StartCheck {
  private readonly body: BodyTracker;
  private frames = 0;
  private framedFrames = 0;
  private headCutFrames = 0;
  private legsCutFrames = 0;
  private poses: BodyPose[] = [];
  private tilts: number[] = [];
  private widths: number[] = [];
  private feetForward: number[] = [];
  private seenFrames = 0;
  private wristVisibility: { left: number[]; right: number[] } = { left: [], right: [] };
  private startT: number | null = null;

  constructor(private readonly config: PunchConfig = PUNCH_CONFIG) {
    this.body = new BodyTracker(config);
  }

  /** Seconds left, for a countdown. */
  remaining(t: number): number {
    if (this.startT === null) return this.config.startCheck.durationMs / 1000;
    return Math.max(0, (this.config.startCheck.durationMs - (t - this.startT)) / 1000);
  }

  isDone(t: number): boolean {
    return this.startT !== null && t - this.startT >= this.config.startCheck.durationMs;
  }

  push(t: number, world: Landmark[] | null, image: Landmark[] | null) {
    this.startT ??= t;
    this.frames += 1;
    if (!world || !image) return;
    this.seenFrames += 1;
    this.wristVisibility.left.push(image[LM.LEFT_WRIST]?.visibility ?? 0);
    this.wristVisibility.right.push(image[LM.RIGHT_WRIST]?.visibility ?? 0);
    const { framing } = this.config;
    const inPicture = (index: number) => {
      const point = image[index];
      return (
        seen(point, framing.minVisibility) &&
        point.x >= framing.edgeMargin &&
        point.x <= 1 - framing.edgeMargin &&
        point.y >= framing.edgeMargin &&
        point.y <= 1 - framing.edgeMargin
      );
    };
    if ([LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP].every(inPicture)) this.framedFrames += 1;
    if (!inPicture(LM.NOSE)) this.headCutFrames += 1;
    if (!inPicture(LEFT_ANKLE) && !inPicture(RIGHT_ANKLE)) this.legsCutFrames += 1;

    const pose = this.body.push(t, world);
    if (!pose) return;
    this.poses.push(pose);
    this.widths.push(Math.hypot(world[LM.LEFT_SHOULDER].x - world[LM.RIGHT_SHOULDER].x, world[LM.LEFT_SHOULDER].z - world[LM.RIGHT_SHOULDER].z));
    if (seen(world[LM.LEFT_HIP], framing.minVisibility) && seen(world[LM.RIGHT_HIP], framing.minVisibility)) {
      const hipY = (world[LM.LEFT_HIP].y + world[LM.RIGHT_HIP].y) / 2;
      const hipZ = (world[LM.LEFT_HIP].z + world[LM.RIGHT_HIP].z) / 2;
      const shoulderY = (world[LM.LEFT_SHOULDER].y + world[LM.RIGHT_SHOULDER].y) / 2;
      const shoulderZ = (world[LM.LEFT_SHOULDER].z + world[LM.RIGHT_SHOULDER].z) / 2;
      this.tilts.push((Math.atan2(hipZ - shoulderZ, hipY - shoulderY) * 180) / Math.PI);
    }
    if (inPicture(LEFT_ANKLE) && inPicture(RIGHT_ANKLE)) {
      // Which foot is further forward, in their own frame of reference
      const forward = (index: number) => -world[index].z * pose.camera.z - world[index].x * pose.camera.x;
      this.feetForward.push(forward(LEFT_ANKLE) - forward(RIGHT_ANKLE));
    }
  }

  result(): StartCheckResult {
    const { startCheck } = this.config;
    const frames = Math.max(1, this.frames);
    const gaveUp = this.poses.length < startCheck.minPoses;
    const reading = median(this.poses.map((pose) => pose.viewYaw));
    const cameraAngle = gaveUp ? 0 : cameraAngleFromReading(reading);
    const size = Math.abs(cameraAngle);
    const onLeft = cameraAngle > 0;
    const cameraSide: CameraSide =
      size >= startCheck.behindFrom ? 'behind' : size < startCheck.frontWithin ? 'front' : size < startCheck.sideFrom ? (onLeft ? 'left' : 'right') : onLeft ? 'side_left' : 'side_right';

    const tilt = median(this.tilts);
    const cameraHeight: CameraHeight = tilt > startCheck.highFrom ? 'high' : tilt < -startCheck.lowFrom ? 'low' : 'level';

    // Feet first: a boxer's front foot is the lead. Hands say the same less reliably.
    const wristOf = (pose: BodyPose, side: 'left' | 'right') => pose[side].wrist;
    const up = this.poses.filter((pose) => wristOf(pose, 'left') && wristOf(pose, 'right'));
    const handsForward = median(up.map((pose) => pose.left.wrist!.z - pose.right.wrist!.z));
    const feet = median(this.feetForward);
    let stance: Stance | null = null;
    const byFeet = this.feetForward.length >= startCheck.minPoses && Math.abs(feet) >= startCheck.feetApart ? (feet > 0 ? 'orthodox' : 'southpaw') : null;
    const byHands = Math.abs(handsForward) >= startCheck.handsApart ? (handsForward > 0 ? 'orthodox' : 'southpaw') : null;
    // Off to one side either alone was wrong too often to suggest a switch, so there they must agree
    stance = size < startCheck.frontWithin ? byFeet ?? byHands : byFeet === byHands ? byFeet : null;

    // Side on or from behind the arms and feet can't be told apart, so it mustn't suggest a switch
    if (cameraSide === 'behind' || cameraSide === 'side_left' || cameraSide === 'side_right') stance = null;

    // Only a guard held still counts as where the hands rest
    const middle = (axis: 'x' | 'y' | 'z', side: 'left' | 'right') => median(up.map((pose) => wristOf(pose, side)![axis]));
    const point = (side: 'left' | 'right'): Vec3 => ({ x: middle('x', side), y: middle('y', side), z: middle('z', side) });
    const steady = (side: 'left' | 'right') => {
      const center = point(side);
      const off = up.map((pose) => Math.hypot(wristOf(pose, side)!.x - center.x, wristOf(pose, side)!.y - center.y));
      return median(off) <= startCheck.guardSteady;
    };
    const guard = up.length >= startCheck.minPoses && steady('left') && steady('right') ? { left: point('left'), right: point('right') } : null;

    const handSpeeds = this.poses.slice(1).flatMap((pose, i) => {
      const previous = this.poses[i];
      const dt = (pose.t - previous.t) / 1000;
      return (['left', 'right'] as const).flatMap((side) => {
        const now = pose[side].wrist;
        const before = previous[side].wrist;
        return now && before && dt > 0 ? [dist(now, before) / dt] : [];
      });
    });

    return {
      shaky: !gaveUp && median(handSpeeds) >= startCheck.shakySpeed,
      framed: this.framedFrames / frames >= startCheck.framedShare,
      headCut: this.headCutFrames / frames >= startCheck.cutShare,
      legsCut: this.legsCutFrames / frames >= startCheck.cutShare,
      scale: median(this.widths),
      cameraAngle: Math.round(cameraAngle / 5) * 5,
      cameraSide,
      cameraHeight,
      stance,
      guard,
      gaveUp,
      seenShare: this.seenFrames / frames,
      handsHidden: !gaveUp && Math.min(median(this.wristVisibility.left), median(this.wristVisibility.right)) < startCheck.handsSeen,
    };
  }
}

/** The one line that says what the check saw, like "Camera on your left, about 40°." */
export function describeCamera(result: StartCheckResult): string {
  if (result.gaveUp) return "Can't see you from here.";
  const angle = Math.abs(result.cameraAngle);
  switch (result.cameraSide) {
    case 'front':
      return 'Camera in front of you.';
    case 'left':
      return `Camera on your left, about ${angle}°.`;
    case 'right':
      return `Camera on your right, about ${angle}°.`;
    case 'side_left':
      return `Camera on your left, about ${angle}°. Your right arm is mostly hidden.`;
    case 'side_right':
      return `Camera on your right, about ${angle}°. Your left arm is mostly hidden.`;
    case 'behind':
      return 'Camera behind you. Your hands are hidden by your body.';
  }
}

/** What to change, or null when the setup is fine. */
export function placementAdvice(result: StartCheckResult): string | null {
  if (result.gaveUp) {
    return "If the bag is between you and the phone, move the phone just far enough around to see past it, 6 to 10 feet back, so you're both in the picture.";
  }
  if (!result.framed) return 'Get your shoulders and hips in the picture, about 6 to 10 feet back. If the bag is in the way, move the phone around to your side.';
  if (result.headCut) return 'Your head is cut off. Tilt the phone back or move it further away.';
  if (result.shaky) return 'Tracking looks shaky from here. Move the phone back so your head and hands have room, and add some light.';
  if (result.cameraSide === 'behind') return 'For a full count and punches by name, move the phone in front of you, at hip height.';
  if (result.handsHidden) return 'The bag or your body is hiding a hand. Move the phone a little further around to your side, or further back.';
  if (result.cameraSide === 'side_left' || result.cameraSide === 'side_right') {
    return 'For punches by name, move the phone around toward your front.';
  }
  if (result.cameraHeight === 'low') return 'The phone is looking up at you, which adds extra punches and blurs their names. Raise it to hip height.';
  if (result.cameraHeight === 'high') return 'The phone is looking down on you, which blurs punch types. Hip height works best.';
  if (result.cameraSide === 'left' || result.cameraSide === 'right') return 'For more punches by name, move the phone closer to straight in front of you.';
  return null;
}

/**
 * What this spot will give them, in a line. From one person shadowboxing in front of a laptop
 * webcam (2026-11-03, 16 spots, no bag), so it's a guide.
 */
export function expectedQuality(result: StartCheckResult): string {
  if (result.gaveUp) return 'From here: nothing counted until it can see you.';
  if (result.cameraSide === 'behind') return "From here: it misses about one punch in four, and won't name them or say which hand.";
  if (result.cameraSide === 'side_left' || result.cameraSide === 'side_right') {
    return "From here: it counts most punches, with a few extra, and won't name them or say which hand.";
  }
  if (result.cameraHeight === 'low') return 'From here: it counts most punches and names only the clear ones. It may add a few extra.';
  if (result.handsHidden || result.cameraHeight !== 'level') {
    return 'From here: it counts most punches and names only the clear ones.';
  }
  if (result.cameraSide === 'front') return 'From here: it counts your punches and names most of them.';
  return 'From here: it counts most punches and names some. Straight in front of you names the most.';
}
