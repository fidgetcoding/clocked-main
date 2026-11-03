import { FRAMING_MESSAGES, type FramingStatus } from './framing';
import { PUNCH_LABELS } from './round';
import { StartCheck, type StartCheckResult } from './startCheck';
import type { Landmark, PunchClass, PunchDetected } from './types';

/** The punches the walkthrough asks for, in the order the combo builder numbers them. */
export const CALIBRATION_PUNCHES: PunchClass[] = ['jab', 'cross', 'lead_hook', 'rear_hook', 'lead_uppercut', 'rear_uppercut'];

export type CalibrationPhase = 'choose' | 'setup' | 'guard' | 'punches' | 'result' | 'done';

/** seen: named right. unnamed: counted, but this spot can't name it. wrong: named as something else. */
export type CalibrationStepStatus = 'waiting' | 'seen' | 'unnamed' | 'wrong' | 'missed' | 'skipped';

export interface CalibrationStep {
  punch: PunchClass;
  status: CalibrationStepStatus;
  /** What the tracker called it, when it saw a punch. */
  seenAs: PunchClass | null;
  tip: string | null;
}

export interface CalibrationView {
  phase: CalibrationPhase;
  /** The framing as shown on screen, during setup. */
  framing: FramingStatus;
  /** How far through the hold that passes setup, 0 to 1. */
  setupProgress: number;
  /** Countdown for the guard hold. */
  secondsLeft: number;
  stepIndex: number;
  steps: CalibrationStep[];
  /** What the guard hold saw about the camera, once it's done. */
  result: StartCheckResult | null;
  /** Skipped as a whole, as opposed to finished. */
  skipped: boolean;
}

export interface CalibrationActions {
  begin: () => void;
  /** Skips the whole calibration. */
  skip: () => void;
  /** Moves past setup or the guard hold without waiting for it to pass. */
  skipStep: () => void;
  retryPunch: () => void;
  skipPunch: () => void;
  /** From the result screen: calibration is done and the session can start. */
  finish: () => void;
  restart: () => void;
}

/** Framing has to stay good this long before setup passes. */
export const SETUP_HOLD_MS = 1500;
/** How long a punch prompt waits before saying it didn't see one. */
export const PUNCH_WAIT_MS = 8000;
/** How long "Got it" stays up before the next punch. */
export const SEEN_HOLD_MS = 1200;

const STRAIGHT: PunchClass[] = ['jab', 'cross'];

const PUNCH_TIPS: Record<PunchClass, string> = {
  jab: 'Throw it fully extended, then bring it straight back.',
  cross: 'Turn your back hip and throw it fully extended.',
  lead_hook: 'Keep the elbow up and turn your lead hip into it.',
  rear_hook: 'Keep the elbow up and turn your back hip into it.',
  lead_uppercut: 'Dip a little and drive it up, not out.',
  rear_uppercut: 'Dip a little and drive it up, not out.',
  punch: 'Throw it fully extended.',
};

/** "Throw a jab", for the screen and the voice. */
export const promptFor = (punch: PunchClass) => `Throw a ${PUNCH_LABELS[punch].toLowerCase()}`;

/** One short tip for a punch that wasn't seen, or was seen as something else. */
export function tipFor(expected: PunchClass, event?: PunchDetected | null, framing: FramingStatus = 'ok'): string {
  if (!event && framing !== 'ok') return FRAMING_MESSAGES[framing];
  if (event?.issues.includes('other_hand_left_guard')) return 'Keep the other hand up.';
  if (event?.issues.includes('arm_not_extended') && STRAIGHT.includes(expected)) return 'Throw it fully extended.';
  return PUNCH_TIPS[expected];
}

const freshSteps = (): CalibrationStep[] => CALIBRATION_PUNCHES.map((punch) => ({ punch, status: 'waiting', seenAs: null, tip: null }));

/**
 * The calibration run before a camera session: framing first, then a guard hold that reads where the camera
 * is, then one of each punch, then what to expect. It only listens. Nothing here changes how punches are read.
 */
export class Calibration {
  private phase: CalibrationPhase = 'choose';
  private framing: FramingStatus = 'ok';
  private framedSince: number | null = null;
  private setupProgress = 0;
  private check: StartCheck | null = null;
  private secondsLeft = 0;
  private stepIndex = 0;
  private steps = freshSteps();
  private stepStart = 0;
  private advanceAt: number | null = null;
  private result: StartCheckResult | null = null;
  private skipped = false;
  private lastT = 0;

  get current(): CalibrationPhase {
    return this.phase;
  }

  get done(): boolean {
    return this.phase === 'done';
  }

  /** True while punches are being asked for, so the tracker should be watching for them. */
  get listening(): boolean {
    return this.phase === 'punches';
  }

  get checkResult(): StartCheckResult | null {
    return this.result;
  }

  begin() {
    this.phase = 'setup';
    this.framedSince = null;
    this.setupProgress = 0;
    this.skipped = false;
  }

  skip() {
    this.phase = 'done';
    this.skipped = true;
  }

  skipStep() {
    if (this.phase === 'setup') this.startGuard();
    else if (this.phase === 'guard') this.startPunches(this.lastT);
  }

  restart() {
    this.steps = freshSteps();
    this.stepIndex = 0;
    this.result = null;
    this.check = null;
    this.advanceAt = null;
    this.begin();
  }

  finish() {
    this.phase = 'done';
  }

  retryPunch() {
    if (this.phase !== 'punches') return;
    this.steps[this.stepIndex] = { ...this.steps[this.stepIndex], status: 'waiting', seenAs: null, tip: null };
    this.stepStart = this.lastT;
    this.advanceAt = null;
  }

  skipPunch() {
    if (this.phase !== 'punches') return;
    this.steps[this.stepIndex] = { ...this.steps[this.stepIndex], status: 'skipped', tip: null };
    this.nextPunch(this.lastT);
  }

  /**
   * One frame of pose. Returns true on the frame the guard hold finishes, when its result is new.
   */
  push(t: number, framing: FramingStatus, world: Landmark[] | null, image: Landmark[] | null): boolean {
    this.lastT = t;
    this.framing = framing;
    switch (this.phase) {
      case 'setup': {
        if (framing !== 'ok') {
          this.framedSince = null;
          this.setupProgress = 0;
          return false;
        }
        this.framedSince ??= t;
        this.setupProgress = Math.min(1, (t - this.framedSince) / SETUP_HOLD_MS);
        if (this.setupProgress >= 1) this.startGuard();
        return false;
      }
      case 'guard': {
        const check = this.check!;
        check.push(t, world, image);
        this.secondsLeft = Math.ceil(check.remaining(t));
        if (!check.isDone(t)) return false;
        this.result = check.result();
        this.startPunches(t);
        return true;
      }
      case 'punches': {
        const step = this.steps[this.stepIndex];
        if (this.advanceAt !== null && t >= this.advanceAt) this.nextPunch(t);
        else if (step.status === 'waiting' && t - this.stepStart >= PUNCH_WAIT_MS) {
          this.steps[this.stepIndex] = { ...step, status: 'missed', tip: tipFor(step.punch, null, framing) };
        }
        return false;
      }
      default:
        return false;
    }
  }

  /** A punch the tracker saw while a prompt was up. */
  onPunch(event: PunchDetected) {
    if (this.phase !== 'punches' || this.advanceAt !== null) return;
    const step = this.steps[this.stepIndex];
    if (step.status === 'skipped') return;
    if (event.punch === step.punch || event.punch === 'punch') {
      this.steps[this.stepIndex] = { ...step, status: event.punch === 'punch' ? 'unnamed' : 'seen', seenAs: event.punch, tip: null };
      this.advanceAt = event.t + SEEN_HOLD_MS;
      return;
    }
    this.steps[this.stepIndex] = { ...step, status: 'wrong', seenAs: event.punch, tip: tipFor(step.punch, event) };
  }

  view(): CalibrationView {
    return {
      phase: this.phase,
      framing: this.framing,
      setupProgress: this.setupProgress,
      secondsLeft: this.secondsLeft,
      stepIndex: this.stepIndex,
      steps: this.steps,
      result: this.result,
      skipped: this.skipped,
    };
  }

  /** Changes only when something on screen would, so a page can redraw on change rather than every frame. */
  key(): string {
    const step = this.steps[this.stepIndex];
    return [this.phase, this.framing, Math.floor(this.setupProgress * 10), this.secondsLeft, this.stepIndex, step?.status, step?.seenAs].join('|');
  }

  private startGuard() {
    this.phase = 'guard';
    this.check = new StartCheck();
    this.secondsLeft = Math.ceil(this.check.remaining(0));
  }

  private startPunches(t: number) {
    this.phase = 'punches';
    this.stepIndex = 0;
    this.stepStart = t;
    this.advanceAt = null;
  }

  private nextPunch(t: number) {
    this.advanceAt = null;
    if (this.stepIndex + 1 >= this.steps.length) {
      this.phase = 'result';
      return;
    }
    this.stepIndex += 1;
    this.stepStart = t;
  }
}

/** The line under a punch prompt, for where that punch stands. */
export function stepLine(step: CalibrationStep): string {
  switch (step.status) {
    case 'waiting':
      return `${promptFor(step.punch)}.`;
    case 'seen':
      return 'Got it.';
    case 'unnamed':
      return "Counted. From this spot it won't name punches.";
    case 'wrong':
      return `Looked like a ${PUNCH_LABELS[step.seenAs ?? 'punch'].toLowerCase()}.`;
    case 'missed':
      return "Didn't see it.";
    case 'skipped':
      return 'Skipped.';
  }
}

/** What's said out loud as calibration moves along. Null says nothing new. */
export function voiceLine(view: CalibrationView): string | null {
  if (view.phase === 'guard') return 'Hands up. Hold still.';
  if (view.phase === 'result') return 'Calibration done.';
  if (view.phase !== 'punches') return null;
  const step = view.steps[view.stepIndex];
  if (step.status === 'waiting') return promptFor(step.punch);
  if (step.status === 'skipped') return null;
  return stepLine(step).split('.')[0];
}

/** "Saw 5 of 6 punches", counting the ones counted without a name. */
export function tallyLine(steps: CalibrationStep[]): string {
  const seen = steps.filter((step) => step.status === 'seen' || step.status === 'unnamed').length;
  return `Saw ${seen} of ${steps.length} punches.`;
}
