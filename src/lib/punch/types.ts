export type Stance = 'orthodox' | 'southpaw';
export type Side = 'left' | 'right';
export type Hand = 'lead' | 'rear';

export type PunchClass =
  | 'jab'
  | 'cross'
  | 'lead_hook'
  | 'rear_hook'
  | 'lead_uppercut'
  | 'rear_uppercut'
  | 'punch';

export type FormIssue =
  | 'other_hand_left_guard'
  | 'slow_return'
  | 'chin_exposed'
  | 'arm_not_extended'
  | 'elbow_flare'
  | 'no_rotation';

/** A pose landmark. x is image right, y is down, z is away from the camera. */
export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

/** One frame of pose output, with world landmarks in metres. Null landmarks means no person. */
export interface PoseFrame {
  t: number;
  landmarks: Landmark[] | null;
}

export interface PunchMetrics {
  distance: number;
  peakSpeed: number;
  durationMs: number;
  reach: number;
  elbow: number;
  elbowHeldMax: number;
  elbowOpening: number;
  forwardShare: number;
  armAcross: number;
  upShare: number;
  rise: number;
  startBelowShoulder: number;
  forearmFromVertical: number;
  forearmFromLevel: number;
  upperArmBelowLevel: number;
  shoulderRotation: number;
  hipRotation: number;
  /** How far the wrist's path bowed from a straight line in the picture, as a share of its length. */
  pathBend: number;
  /** How far the fighter was turned from the camera, as the model read it. */
  viewYaw: number;
  scores: { straight: number; hook: number; uppercut: number; byElimination: boolean };
}

export interface PunchDetected {
  type: 'punch';
  id: number;
  t: number;
  side: Side;
  hand: Hand;
  /** True when the view doesn't let the arms be told apart, so hand is a best guess. */
  handUnsure?: boolean;
  punch: PunchClass;
  confidence: number;
  issues: FormIssue[];
  metrics: PunchMetrics;
}

/** A form problem found after the punch was reported, or between punches when punchId is null. */
export interface FormFlagged {
  type: 'form';
  t: number;
  punchId: number | null;
  hand: Hand;
  issue: FormIssue;
}

export type PunchEvent = PunchDetected | FormFlagged;
