import { PUNCH_CONFIG, type PunchConfig } from './config';
import type { FormIssue, Hand, PunchClass, PunchEvent } from './types';

/** The cues a detector event calls for, named for the hand at fault. */
export function cuesFor(event: PunchEvent): string[] {
  if (event.type === 'form') return [cueFor(event.issue, event.hand)];
  const opposite = event.hand === 'lead' ? 'rear' : 'lead';
  return event.issues.map((issue) => cueFor(issue, issue === 'other_hand_left_guard' ? opposite : event.hand));
}

/** "1 punch", "2 punches", for a count on screen or in the log. */
export const punchWord = (count: number) => (count === 1 ? 'punch' : 'punches');

export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export const PUNCH_LABELS: Record<PunchClass, string> = {
  jab: 'Jab',
  cross: 'Cross',
  lead_hook: 'Lead hook',
  rear_hook: 'Rear hook',
  lead_uppercut: 'Lead uppercut',
  rear_uppercut: 'Rear uppercut',
  punch: 'Punch',
};

/** The same numbering the combo builder uses. Unclassified punches have no number. */
export const PUNCH_NUMBERS: Record<PunchClass, string> = {
  jab: '1',
  cross: '2',
  lead_hook: '3',
  rear_hook: '4',
  lead_uppercut: '5',
  rear_uppercut: '6',
  punch: '?',
};

export const PUNCH_ORDER: PunchClass[] = [
  'jab',
  'cross',
  'lead_hook',
  'rear_hook',
  'lead_uppercut',
  'rear_uppercut',
  'punch',
];

/** The short spoken and on-screen cue for an issue. `hand` is the hand that was at fault. */
export function cueFor(issue: FormIssue, hand: Hand): string {
  switch (issue) {
    case 'other_hand_left_guard':
      return hand === 'lead' ? 'Lead hand up' : 'Rear hand up';
    case 'slow_return':
      return 'Bring it back';
    case 'chin_exposed':
      return 'Hands up';
    case 'arm_not_extended':
      return 'Reach all the way';
    case 'elbow_flare':
      return 'Elbow in';
    case 'no_rotation':
      return 'Turn your hips';
  }
}

export const FIX_ADVICE: Record<FormIssue, string> = {
  other_hand_left_guard: 'Keep the other hand at your cheek while you punch.',
  slow_return: 'Bring each hand straight back to your guard.',
  chin_exposed: 'Keep your hands high enough to cover your chin.',
  arm_not_extended: 'Finish your jabs and crosses with a long arm.',
  elbow_flare: 'Keep your elbow level with your fist on hooks.',
  no_rotation: 'Turn your hips and shoulders through the cross.',
};

export interface RoundState {
  counts: Record<PunchClass, number>;
  total: number;
  /** Issues per punch id. A punch missing from here was clean so far. */
  punchIssues: Map<number, Set<FormIssue>>;
  /** Issues flagged between punches, which are not tied to any one punch. */
  idleIssues: Partial<Record<FormIssue, number>>;
  /** The latest punches in the current combo, capped for the readout. */
  combo: string[];
  comboLength: number;
  comboLastT: number;
  longestCombo: number;
}

export function newRound(): RoundState {
  return {
    counts: { jab: 0, cross: 0, lead_hook: 0, rear_hook: 0, lead_uppercut: 0, rear_uppercut: 0, punch: 0 },
    total: 0,
    punchIssues: new Map(),
    idleIssues: {},
    combo: [],
    comboLength: 0,
    comboLastT: -Infinity,
    longestCombo: 0,
  };
}

const COMBO_READOUT_LENGTH = 8;

/** Updates the round in place with one detector event. */
export function applyEvent(round: RoundState, event: PunchEvent, config: PunchConfig = PUNCH_CONFIG) {
  if (event.type === 'form') {
    if (event.punchId === null) {
      round.idleIssues[event.issue] = (round.idleIssues[event.issue] ?? 0) + 1;
      return;
    }
    const issues = round.punchIssues.get(event.punchId) ?? new Set<FormIssue>();
    issues.add(event.issue);
    round.punchIssues.set(event.punchId, issues);
    return;
  }

  round.counts[event.punch] += 1;
  round.total += 1;
  if (event.issues.length > 0) round.punchIssues.set(event.id, new Set(event.issues));
  if (event.t - round.comboLastT > config.combo.gapMs) {
    round.combo = [];
    round.comboLength = 0;
  }
  round.combo = [...round.combo, PUNCH_NUMBERS[event.punch]].slice(-COMBO_READOUT_LENGTH);
  round.comboLength += 1;
  round.comboLastT = event.t;
  round.longestCombo = Math.max(round.longestCombo, round.comboLength);
}

/** The combo being thrown, or the last one until it has gone stale. */
export function comboReadout(round: RoundState, t: number, config: PunchConfig = PUNCH_CONFIG): string {
  if (round.combo.length === 0 || t - round.comboLastT > config.combo.gapMs * 2) return '';
  return round.combo.join('-');
}

export interface RoundSummary {
  total: number;
  counts: Record<PunchClass, number>;
  /** 0 to 100, null when no punches were thrown. */
  cleanPercent: number | null;
  /** The most common issue, with how many punches or moments it covered. */
  topFix: { issue: FormIssue; count: number; advice: string } | null;
  issueCounts: Partial<Record<FormIssue, number>>;
  longestCombo: number;
}

export function summarize(round: RoundState): RoundSummary {
  const issueCounts: Partial<Record<FormIssue, number>> = { ...round.idleIssues };
  for (const issues of round.punchIssues.values()) {
    for (const issue of issues) issueCounts[issue] = (issueCounts[issue] ?? 0) + 1;
  }
  const worst = (Object.entries(issueCounts) as [FormIssue, number][]).sort((a, b) => b[1] - a[1])[0];
  const flagged = round.punchIssues.size;
  return {
    total: round.total,
    counts: { ...round.counts },
    cleanPercent: round.total === 0 ? null : Math.round(((round.total - flagged) / round.total) * 100),
    topFix: worst ? { issue: worst[0], count: worst[1], advice: FIX_ADVICE[worst[0]] } : null,
    issueCounts,
    longestCombo: round.longestCombo,
  };
}

/** What a camera panel hands back to the session it sits in. */
export interface PunchSessionReport extends RoundSummary {
  /** One line for the workout log. */
  note: string;
}

/** One line for the workout log. */
export function summaryNote(summary: RoundSummary): string {
  const counts = PUNCH_ORDER.filter((punch) => summary.counts[punch] > 0)
    .map((punch) => `${PUNCH_LABELS[punch]} ${summary.counts[punch]}`)
    .join(', ');
  const parts = [`${summary.total} ${punchWord(summary.total)}`];
  if (summary.cleanPercent !== null) parts.push(`${summary.cleanPercent}% clean`);
  if (counts) parts.push(counts);
  if (summary.topFix) parts.push(`Top fix: ${summary.topFix.advice}`);
  return parts.join('. ');
}

/** Shows one cue at a time: each stays up for a while, and the same cue can't repeat straight away. */
export class CueQueue {
  private current: { text: string; since: number } | null = null;
  private pending: string | null = null;
  private lastShown = new Map<string, number>();

  constructor(private readonly config: PunchConfig = PUNCH_CONFIG) {}

  offer(text: string, t: number) {
    const last = this.lastShown.get(text);
    if (last !== undefined && t - last < this.config.cues.repeatMs) return;
    if (this.current?.text === text) return;
    this.pending = text;
  }

  /** The cue to show at time t. Returns a new cue at most once per hold time. */
  read(t: number): string | null {
    const free = !this.current || t - this.current.since >= this.config.cues.holdMs;
    if (free && this.pending) {
      this.current = { text: this.pending, since: t };
      this.lastShown.set(this.pending, t);
      this.pending = null;
    } else if (free) {
      this.current = null;
    }
    return this.current?.text ?? null;
  }
}
