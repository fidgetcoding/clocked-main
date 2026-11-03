import type { CameraProblem } from '@/lib/punch/framing';
import type { CalibrationActions, CalibrationView } from '@/lib/punch/calibration';
import type { Landmark, PunchClass } from '@/lib/punch/types';

/** What the camera hands up to the graphics drawn over it. */
export interface CameraFeedState {
  status: 'off' | 'starting' | 'live';
  /** The camera was stopped because the tab went away. */
  paused: boolean;
  problem: CameraProblem | null;
  count: number;
  cue: string | null;
  warning: string | null;
  combo: string;
  lastLabel: string | null;
  counts: Record<PunchClass, number>;
  cleanPercent: number | null;
  /** The latest body the tracker saw, for placing graphics. Changes every frame, so it's a ref. */
  pose: { current: { points: Landmark[]; aspect: number } | null };
  /** The calibration before the session. Null once there's none to run. */
  calibration: CalibrationView | null;
  calibrationActions: CalibrationActions;
  /** Turns the camera back on after it was stopped. */
  resume: () => void;
}

/** Calibration still has something to show. */
export const isCalibrating = (calibration: CalibrationView | null | undefined) => !!calibration && calibration.phase !== 'done';
