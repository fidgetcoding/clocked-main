import { PUNCH_CONFIG, type PunchConfig } from './config';
import { cueFor, FIX_ADVICE, PUNCH_NUMBERS } from './round';
import type { FormIssue, Hand, PunchClass, PunchEvent, Side } from './types';

// The full record of a camera session: every punch, combo, round and form cue. Plain JSON, so one
// shape goes into browser storage and into workout_history.punch_log.

/** Far more than a long session throws. Past it the totals keep counting and the detail stops. */
export const MAX_LOGGED_ENTRIES = 5000;

export interface LoggedPunch {
  /** Milliseconds of training time since the session started. Pauses don't count. */
  t: number;
  punch: PunchClass;
  hand: Hand;
  side: Side;
  round: number;
  issues: FormIssue[];
}

/** A form cue given between punches. */
export interface LoggedCue {
  t: number;
  round: number;
  hand: Hand;
  issue: FormIssue;
}

export interface LoggedCombo {
  t: number;
  round: number;
  /** In the combo builder's numbering, like "1-2-3". */
  sequence: string;
  length: number;
}

/** One stretch of training. A pause ends a round and resuming starts the next. */
export interface LoggedRound {
  number: number;
  startSeconds: number;
  endSeconds: number | null;
  punches: number;
}

export interface PunchLogTotals {
  punches: number;
  byType: Record<PunchClass, number>;
  byHand: Record<Hand, number>;
  /** Punches with no form cue against them. */
  clean: number;
  /** 0 to 100, null when no punches were seen. */
  cleanPercent: number | null;
  cues: Partial<Record<FormIssue, number>>;
  combos: number;
  longestCombo: number;
}

export interface PunchLog {
  version: 1;
  /** False until the camera has actually run. A session it never saw has no log. */
  tracked: boolean;
  durationSeconds: number;
  /** True once the detail lists hit MAX_LOGGED_ENTRIES. The totals are still complete. */
  truncated: boolean;
  rounds: LoggedRound[];
  punches: LoggedPunch[];
  cues: LoggedCue[];
  combos: LoggedCombo[];
  totals: PunchLogTotals;
}

const emptyTotals = (): PunchLogTotals => ({
  punches: 0,
  byType: { jab: 0, cross: 0, lead_hook: 0, rear_hook: 0, lead_uppercut: 0, rear_uppercut: 0, punch: 0 },
  byHand: { lead: 0, rear: 0 },
  clean: 0,
  cleanPercent: null,
  cues: {},
  combos: 0,
  longestCombo: 0,
});

/** Runs of two or more punches close enough to count as one combo. A round break ends a run. */
export function combosOf(punches: LoggedPunch[], gapMs: number): LoggedCombo[] {
  const combos: LoggedCombo[] = [];
  let run: LoggedPunch[] = [];
  const flush = () => {
    if (run.length >= 2) {
      combos.push({
        t: run[0].t,
        round: run[0].round,
        sequence: run.map((punch) => PUNCH_NUMBERS[punch.punch]).join('-'),
        length: run.length,
      });
    }
    run = [];
  };
  for (const punch of punches) {
    const last = run[run.length - 1];
    if (last && (punch.round !== last.round || punch.t - last.t > gapMs)) flush();
    run.push(punch);
  }
  flush();
  return combos;
}

/** The hand a cue is about. A dropped guard is the other hand from the one punching. */
export const cueOnPunch = (issue: FormIssue, punch: Pick<LoggedPunch, 'hand'>): string =>
  cueFor(issue, issue === 'other_hand_left_guard' ? (punch.hand === 'lead' ? 'rear' : 'lead') : punch.hand);

/** The most common cue, and what to do about it. */
export function topFixOf(totals: PunchLogTotals): { issue: FormIssue; count: number; advice: string } | null {
  const worst = (Object.entries(totals.cues) as [FormIssue, number][]).sort((a, b) => b[1] - a[1])[0];
  return worst ? { issue: worst[0], count: worst[1], advice: FIX_ADVICE[worst[0]] } : null;
}

/** Builds up the log from detector events. The caller says when rounds start and end. */
export class PunchLogRecorder {
  private log: PunchLog;
  /** Where the open round started, on the session clock and on the detector's clock. */
  private openRound: { elapsedMs: number; t: number } | null = null;
  /** Form flags can land after their punch, and they refer to it by the detector's id. */
  private byDetectorId = new Map<number, LoggedPunch>();
  private flagged: number;
  lastCue: string | null = null;

  constructor(
    saved?: PunchLog | null,
    private readonly config: PunchConfig = PUNCH_CONFIG,
    private readonly maxEntries = MAX_LOGGED_ENTRIES,
  ) {
    this.log = saved
      ? { ...saved, rounds: [...saved.rounds], punches: [...saved.punches], cues: [...saved.cues], totals: { ...saved.totals } }
      : {
          version: 1,
          tracked: false,
          durationSeconds: 0,
          truncated: false,
          rounds: [],
          punches: [],
          cues: [],
          combos: [],
          totals: emptyTotals(),
        };
    this.flagged = this.log.totals.punches - this.log.totals.clean;
    // A saved round can't still be running: whatever saved it has gone
    const last = this.log.rounds[this.log.rounds.length - 1];
    if (last && last.endSeconds === null) {
      this.log.rounds[this.log.rounds.length - 1] = { ...last, endSeconds: this.log.durationSeconds };
    }
  }

  /** The camera is running. A new run means a new detector, so old punch ids stop meaning anything. */
  markTracking() {
    this.log.tracked = true;
    this.byDetectorId.clear();
  }

  startRound(elapsedSeconds: number, t: number) {
    if (this.openRound) return;
    this.openRound = { elapsedMs: elapsedSeconds * 1000, t };
    this.log.rounds.push({ number: this.log.rounds.length + 1, startSeconds: elapsedSeconds, endSeconds: null, punches: 0 });
  }

  endRound(elapsedSeconds: number) {
    if (!this.openRound) return;
    this.openRound = null;
    const last = this.log.rounds.length - 1;
    this.log.rounds[last] = { ...this.log.rounds[last], endSeconds: elapsedSeconds };
  }

  record(event: PunchEvent) {
    // A flag for a punch already logged, wherever the session has got to since
    if (event.type === 'form' && event.punchId !== null) {
      const punch = this.byDetectorId.get(event.punchId);
      if (punch && !punch.issues.includes(event.issue)) this.addIssues(punch, [event.issue]);
      return;
    }

    const round = this.log.rounds[this.log.rounds.length - 1];
    if (!round) return;
    const t = this.sessionTime(event.t);

    if (event.type === 'form') {
      this.countCue(event.issue);
      this.lastCue = cueFor(event.issue, event.hand);
      this.addDetail(this.log.cues, { t, round: round.number, hand: event.hand, issue: event.issue });
      return;
    }

    const punch: LoggedPunch = { t, punch: event.punch, hand: event.hand, side: event.side, round: round.number, issues: [] };
    const { totals } = this.log;
    totals.punches += 1;
    totals.byType = { ...totals.byType, [event.punch]: totals.byType[event.punch] + 1 };
    totals.byHand = { ...totals.byHand, [event.hand]: totals.byHand[event.hand] + 1 };
    this.log.rounds[round.number - 1] = { ...round, punches: round.punches + 1 };
    this.byDetectorId.set(event.id, punch);
    this.addDetail(this.log.punches, punch);
    this.addIssues(punch, event.issues);
  }

  /** The log as it stands. Safe to save, since nothing in it changes afterwards. */
  snapshot(elapsedSeconds: number): PunchLog {
    const fresh = combosOf(this.log.punches, this.config.combo.gapMs);
    const { punches } = this.log.totals;
    return {
      ...this.log,
      durationSeconds: elapsedSeconds,
      rounds: [...this.log.rounds],
      punches: this.log.punches.map((punch) => ({ ...punch, issues: [...punch.issues] })),
      cues: [...this.log.cues],
      combos: fresh,
      totals: {
        ...this.log.totals,
        clean: punches - this.flagged,
        cleanPercent: punches === 0 ? null : Math.round(((punches - this.flagged) / punches) * 100),
        cues: { ...this.log.totals.cues },
        combos: fresh.length,
        longestCombo: fresh.reduce((longest, combo) => Math.max(longest, combo.length), 0),
      },
    };
  }

  /** What to keep for this session: nothing at all if the camera never ran. */
  finish(elapsedSeconds: number): PunchLog | null {
    return this.log.tracked ? this.snapshot(elapsedSeconds) : null;
  }

  private sessionTime(t: number): number {
    if (this.openRound) return Math.max(0, Math.round(this.openRound.elapsedMs + t - this.openRound.t));
    const last = this.log.rounds[this.log.rounds.length - 1];
    return (last.endSeconds ?? last.startSeconds) * 1000;
  }

  private addIssues(punch: LoggedPunch, issues: FormIssue[]) {
    if (issues.length === 0) return;
    if (punch.issues.length === 0) this.flagged += 1;
    punch.issues.push(...issues);
    for (const issue of issues) {
      this.countCue(issue);
      this.lastCue = cueOnPunch(issue, punch);
    }
  }

  private countCue(issue: FormIssue) {
    const { totals } = this.log;
    totals.cues = { ...totals.cues, [issue]: (totals.cues[issue] ?? 0) + 1 };
  }

  private addDetail<T>(list: T[], entry: T) {
    if (list.length < this.maxEntries) list.push(entry);
    else this.log.truncated = true;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** A log read back from storage or the database, or null if it isn't one this version can show. */
export function parsePunchLog(value: unknown): PunchLog | null {
  if (!isRecord(value) || value.version !== 1) return null;
  const { totals } = value;
  const lists = [value.rounds, value.punches, value.cues, value.combos];
  if (!lists.every(Array.isArray) || !isRecord(totals)) return null;
  if (!Number.isFinite(value.durationSeconds) || !Number.isFinite(totals.punches)) return null;
  if (!isRecord(totals.byType) || !isRecord(totals.byHand) || !isRecord(totals.cues)) return null;
  return value as unknown as PunchLog;
}

/** The same log without the punch-by-punch detail, for rows old enough not to need it. */
export const withoutDetail = (log: PunchLog): PunchLog => ({ ...log, punches: [], cues: [], combos: [], truncated: true });
