import { PUNCH_CONFIG, type PunchConfig } from './config';
import { newRound, PUNCH_ORDER, type RoundState } from './round';
import type { FormIssue, FormFlagged, Hand, PunchClass, PunchDetected, PunchEvent } from './types';

/** One punch: when in the session, in seconds, what it was, which hand, and what the form cues said. */
export type LoggedPunch = [seconds: number, punch: PunchClass, hand: Hand, issues: FormIssue[]];

export interface LoggedRound {
  start: number;
  end: number;
  punches: number;
}

/** Everything the camera saw in one session. Plain JSON, for browser storage and the database. */
export interface PunchLog {
  v: 1;
  punches: LoggedPunch[];
  /** Two or more punches in a row, each thrown soon after the last. */
  combos: PunchClass[][];
  /** A long enough break between punches starts a new round. */
  rounds: LoggedRound[];
  counts: Record<PunchClass, number>;
  hands: Record<Hand, number>;
  cues: Partial<Record<FormIssue, number>>;
  /** Cues raised between punches, which belong to no one punch. */
  idleCues: Partial<Record<FormIssue, number>>;
}

export const emptyPunchLog = (): PunchLog => ({
  v: 1,
  punches: [],
  combos: [],
  rounds: [],
  counts: { jab: 0, cross: 0, lead_hook: 0, rear_hook: 0, lead_uppercut: 0, rear_uppercut: 0, punch: 0 },
  hands: { lead: 0, rear: 0 },
  cues: {},
  idleCues: {},
});

/** Builds a PunchLog from detector events, on the session's own clock. */
export class SessionPunchLog {
  private log: PunchLog;
  private indexById = new Map<number, number>();
  private comboStart: number | null = null;

  constructor(
    initial: PunchLog | null = null,
    private readonly config: PunchConfig = PUNCH_CONFIG,
  ) {
    this.log = initial ? structuredClone(initial) : emptyPunchLog();
  }

  add(event: PunchEvent, seconds: number) {
    if (event.type === 'punch') this.addPunch(event, seconds);
    else this.addFlag(event);
  }

  private addPunch(event: PunchDetected, seconds: number) {
    const { log } = this;
    const previous = log.punches[log.punches.length - 1];
    const gap = previous ? seconds - previous[0] : Infinity;

    this.indexById.set(event.id, log.punches.length);
    log.punches.push([seconds, event.punch, event.hand, [...event.issues]]);
    log.counts[event.punch] += 1;
    log.hands[event.hand] += 1;
    for (const issue of event.issues) log.cues[issue] = (log.cues[issue] ?? 0) + 1;

    const round = log.rounds[log.rounds.length - 1];
    if (!round || gap > this.config.log.roundGapSeconds) {
      log.rounds.push({ start: seconds, end: seconds, punches: 1 });
    } else {
      round.end = seconds;
      round.punches += 1;
    }

    if (gap * 1000 > this.config.combo.gapMs) {
      this.comboStart = log.punches.length - 1;
    } else if (this.comboStart !== null) {
      const combo = log.punches.slice(this.comboStart).map((punch) => punch[1]);
      // Still the same combo: replace the shorter version logged a punch ago
      if (combo.length > 2) log.combos[log.combos.length - 1] = combo;
      else log.combos.push(combo);
    }
  }

  private addFlag(event: FormFlagged) {
    const { log } = this;
    if (event.punchId === null) {
      log.idleCues[event.issue] = (log.idleCues[event.issue] ?? 0) + 1;
      return;
    }
    const index = this.indexById.get(event.punchId);
    if (index === undefined) return;
    const issues = log.punches[index][3];
    if (issues.includes(event.issue)) return;
    issues.push(event.issue);
    log.cues[event.issue] = (log.cues[event.issue] ?? 0) + 1;
  }

  snapshot(): PunchLog {
    return structuredClone(this.log);
  }
}

/** The round tally that matches a saved log, so a resumed session keeps counting from where it was. */
export function roundFromLog(log: PunchLog): RoundState {
  const round = newRound();
  round.counts = { ...log.counts };
  round.total = log.punches.length;
  round.idleIssues = { ...log.idleCues };
  log.punches.forEach(([, , , issues], index) => {
    // Negative, so a saved punch can't collide with the new detector's ids
    if (issues.length > 0) round.punchIssues.set(-1 - index, new Set(issues));
  });
  round.longestCombo = log.combos.reduce((longest, combo) => Math.max(longest, combo.length), log.punches.length > 0 ? 1 : 0);
  return round;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** Data from storage or the database is checked before anything draws it. */
export function parsePunchLog(value: unknown): PunchLog | null {
  if (!isRecord(value) || value.v !== 1 || !Array.isArray(value.punches) || !Array.isArray(value.combos) || !Array.isArray(value.rounds)) return null;
  if (!isRecord(value.counts) || !isRecord(value.hands) || !isRecord(value.cues)) return null;
  if (!PUNCH_ORDER.every((punch) => Number.isFinite((value.counts as Record<string, unknown>)[punch]))) return null;
  const punchesFit = value.punches.every(
    (row) => Array.isArray(row) && Number.isFinite(row[0]) && PUNCH_ORDER.includes(row[1]) && (row[2] === 'lead' || row[2] === 'rear') && Array.isArray(row[3]),
  );
  return punchesFit ? (value as unknown as PunchLog) : null;
}
