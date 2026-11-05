import { toComboMove } from '@/components/broadcast/run/moves';
import { COACH_GROUPS, type CoachLine } from './lines';

/** The bits of a workout segment the coach talk looks at. */
export interface TalkSegment {
  type: string;
  segmentType?: string;
  duration: number;
  /** Set on every segment of a round, counting from 1 across the workout. */
  cumulativeRound?: number;
}

/** A gap between any two bits of coach talk, so it never nags. */
export const TALK_GAP_S = 20;
/** Encouragement needs the combo call well out of the way first. */
const SETTLE_S = 6;
/** Keeps clear of "10 seconds" and "3, 2, 1" at the end. */
const END_CLEAR_S = 12;
/** Chance per second of a word of encouragement once the gap has passed, about one every 25 to 30 seconds. */
const ENCOURAGE_CHANCE = 0.15;
const HALFWAY_MIN_S = 60;
/** How far back "pace right now" looks, and how much of the round has to have gone before it's judged. */
const PACE_WINDOW_S = 15;
const PACE_SETTLE_S = 30;
/** Well below their pace: under half of it. Only for someone actually throwing, 20 a minute or more. */
const PACE_DROP = 0.5;
const PACE_MIN_PER_S = 20 / 60;
/** Gaps for the camera's pace nudge and for praising a clean combo. */
export const PACE_GAP_S = 30;
export const NAILED_GAP_S = 8;
const REST_WORD_AT_S = 4;
const BACK_TO_WORK_AT_S = 6;
const REST_MIN_S = 20;

const BOXING = new Set(['shadowboxing', 'combo', 'doubleend', 'speedbag']);

/** A working round on the bag or in the air: where the coach talks. */
export const isWorkRound = (segment: TalkSegment | undefined) =>
  !!segment && segment.type !== 'rest' && segment.cumulativeRound !== undefined && BOXING.has(segment.segmentType ?? '');

/** The round this segment starts, if it's the first work of one. */
export function roundStart(segments: TalkSegment[], index: number): { round: number; last: boolean } | null {
  const segment = segments[index];
  const round = segment?.cumulativeRound;
  if (!segment || round === undefined || segment.type === 'rest') return null;
  const opened = segments.slice(0, index).some((earlier) => earlier.cumulativeRound === round && earlier.type !== 'rest');
  if (opened) return null;
  const last = Math.max(...segments.map((entry) => entry.cumulativeRound ?? 0));
  return { round, last: last > 1 && round === last };
}

/** A round just ended into a rest: "Time". */
export const endsRound = (segments: TalkSegment[], index: number) => segments[index]?.type === 'rest' && isWorkRound(segments[index - 1]);

/** The punches of a called combo as the camera reads them, "1-2-3". Null when there's nothing to match. */
export function comboTarget(combo: string[] | undefined): string | null {
  const punches = (combo ?? []).map(toComboMove).filter((move) => move.type === 'punch');
  if (punches.length < 2 || punches.some((move) => !/^[1-6]$/.test(move.display))) return null;
  return punches.map((move) => move.display).join('-');
}

/** One sample of the camera's running punch count. */
export interface PunchSample {
  at: number;
  punches: number;
}

/** Keep the round's baseline, the window boundary, and newer samples. Called once per clock tick. */
export function appendPunchSample(samples: PunchSample[], sample: PunchSample): void {
  samples.push(sample);
  let boundary = 1;
  while (boundary + 1 < samples.length && samples[boundary + 1].at <= sample.at - PACE_WINDOW_S) boundary++;
  if (boundary > 1) samples.splice(1, boundary - 1);
}

/** Whether the last stretch of punching has fallen well below this round's own pace so far. */
export function paceDropped(samples: PunchSample[], now: number): boolean {
  if (samples.length < 2) return false;
  const first = samples[0];
  const latest = samples[samples.length - 1];
  const elapsed = now - first.at;
  if (elapsed < PACE_SETTLE_S) return false;
  const pace = (latest.punches - first.punches) / elapsed;
  if (pace < PACE_MIN_PER_S) return false;
  let windowStart: PunchSample | undefined;
  for (let i = samples.length - 1; i >= 0; i--) {
    if (now - samples[i].at >= PACE_WINDOW_S) {
      windowStart = samples[i];
      break;
    }
  }
  if (!windowStart) return false;
  const recent = (latest.punches - windowStart.punches) / (now - windowStart.at);
  return recent < pace * PACE_DROP;
}

export interface TickState {
  segment: TalkSegment;
  next: TalkSegment | undefined;
  timeRemaining: number;
  /** Seconds since the workout started, for the gaps between bits of talk. */
  now: number;
  /** When the coach last said something of their own, or -Infinity. */
  lastTalk: number;
  lastPace: number;
  /** Whether the camera says the punching has slowed right down. */
  slowing: boolean;
  random: () => number;
}

export interface Talk {
  /** Say one of these. */
  lines: readonly CoachLine[];
  /** It's the pace nudge, which has a longer gap of its own. */
  pace?: boolean;
}

/** What the coach says on this second of the workout, if anything. */
export function talkAt(state: TickState): Talk | null {
  const { segment, next, timeRemaining, now, lastTalk, lastPace, slowing, random } = state;
  const elapsed = segment.duration - timeRemaining;
  if (segment.type === 'rest') {
    if (segment.duration < REST_MIN_S) return null;
    if (elapsed === REST_WORD_AT_S) return { lines: COACH_GROUPS.rest };
    if (timeRemaining === BACK_TO_WORK_AT_S && isWorkRound(next)) return { lines: ['backToWork'] };
    return null;
  }
  if (!isWorkRound(segment)) return null;
  const half = Math.floor(segment.duration / 2);
  if (segment.duration >= HALFWAY_MIN_S && timeRemaining === half) return { lines: ['halfway'] };
  if (elapsed < SETTLE_S || timeRemaining <= END_CLEAR_S || Math.abs(timeRemaining - half) <= 2) return null;
  if (now - lastTalk < TALK_GAP_S) return null;
  if (slowing && now - lastPace >= PACE_GAP_S) return { lines: COACH_GROUPS.pace, pace: true };
  return random() < ENCOURAGE_CHANCE ? { lines: COACH_GROUPS.encourage } : null;
}

/** A random line from a group, not the one said last time. */
export function pickLine<T>(lines: readonly T[], random: () => number, last: T | null): T {
  const choices = lines.length > 1 ? lines.filter((line) => line !== last) : lines;
  return choices[Math.floor(random() * choices.length) % choices.length];
}
