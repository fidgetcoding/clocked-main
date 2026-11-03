import type { ComboMove } from './moves';
import type { CameraFeedState } from '@/components/punch/feedState';

export type RunKind = 'prep' | 'rest' | 'combo' | 'freestyle' | 'drill' | 'exercise' | 'work' | 'freeform';

/** Everything a run screen shows. The page works it out, the layouts only draw it. */
export interface RunView {
  workoutName: string;
  phaseName: string;
  segmentName: string;
  kind: RunKind;
  /** Hasn't been started yet: the screen before the first press of play. */
  idle: boolean;
  paused: boolean;
  /** The camera is still asking or starting, so the start button waits for it. */
  startHeld?: boolean;
  clock: string;
  /** Seconds left in this segment. */
  remaining: number;
  /** How long this segment is, in seconds. */
  duration: number;
  round: number | null;
  /** "Round 3 of 6", once there's a round to name. */
  roundLabel: string | null;
  championship: boolean;
  cooldown: boolean;
  /** Text above the combo plates, when there are any. */
  comboLabel: string | null;
  combo: ComboMove[];
  nextCombo: string | null;
  upNext: string;
  upNextSeconds: number | null;
  segmentIndex: number;
  segmentCount: number;
  elapsed: string;
  sessionXP: number;
  streak: number;
  multiplier: number;
  level: number;
  levelPercent: number;
  xpToNext: number | null;
}

/** Where the numbers change hands with the page. */
export interface RunActions {
  onPlay: () => void;
  onPause: () => void;
  onBack?: () => void;
  onSkip?: () => void;
  onFinish: () => void;
  onLeave: () => void;
  onRestart?: () => void;
  onAdjust?: (seconds: number) => void;
  onToggleCamera: () => void;
}

export interface RunFlash {
  /** "+10 XP" for a moment. */
  xp?: { amount: number; id: number } | null;
  /** The bigger hit when a combo round lands. */
  comboXP?: { amount: number; id: number; isChampionship?: boolean } | null;
  badge?: { name: string; xp: number; artId: string; id: number } | null;
  badgeTally?: { count: number; xp: number } | null;
}

export interface RunStageProps {
  view: RunView;
  actions: RunActions;
  flash?: RunFlash;
  cameraOn: boolean;
  /** The camera element, mounted once and kept while the layout changes around it. */
  camera?: React.ReactNode;
  feed?: CameraFeedState | null;
  /** Whether the tracker is counting right now. */
  counting?: boolean;
  onDismissProblem?: () => void;
  problemDismissed?: boolean;
  /** A session's own running log, shown instead of the plain tally. */
  liveLog?: React.ReactNode;
  /** The button that ends calibration and starts the session. */
  startLabel?: string;
  /** Dialogs and overlays that sit on top of the stage. */
  children?: React.ReactNode;
}
