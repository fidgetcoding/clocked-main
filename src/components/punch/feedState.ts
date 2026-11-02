import type { CameraProblem } from '@/lib/punch/framing';
import type { StartCheckHud } from '@/hooks/usePunchTracking';
import type { PunchClass } from '@/lib/punch/types';

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
  check: StartCheckHud;
  skipCheck: () => void;
  rerunCheck: () => void;
  /** Turns the camera back on after it was stopped. */
  resume: () => void;
}
