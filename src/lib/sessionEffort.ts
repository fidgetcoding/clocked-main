import { BadgeStats } from '@/data/badges';
import { getActivityTypeFromName, PER_SESSION_ESTIMATES, Prestige, TIER_COMBO_STATS } from '@/lib/xpSystem';

// Below this, a session keeps the XP its timer earned, but earns no badges, doesn't count as a
// session and doesn't touch the streak. Otherwise tapping start then finish fires every
// first-session badge.
export const MIN_REWARD_SECONDS = 5 * 60;

// The estimates in PER_SESSION_ESTIMATES describe one full workout of this length
const FULL_SESSION_SECONDS = PER_SESSION_ESTIMATES.workoutDurationHours * 3600;

export function qualifiesForRewards(sessionSeconds: number): boolean {
  return sessionSeconds >= MIN_REWARD_SECONDS;
}

/** How much of a full session this one was worth: 0 below the minimum, capped at 1. */
export function getSessionEffort(sessionSeconds: number): number {
  if (!qualifiesForRewards(sessionSeconds)) return 0;
  return Math.min(1, sessionSeconds / FULL_SESSION_SECONDS);
}

/** The kinds of training a session really spent time on. */
export interface SessionContent {
  combos: boolean;
  pushups: boolean;
  burpees: boolean;
  curlups: boolean;
  jogRun: boolean;
}

export const NOTHING_TRAINED: SessionContent = { combos: false, pushups: false, burpees: false, curlups: false, jogRun: false };
// The mix the per-session estimates were written for
export const FULL_MIX: SessionContent = { combos: true, pushups: true, burpees: true, curlups: true, jogRun: true };

interface SegmentShape {
  name: string;
  type: 'active' | 'rest';
  segmentType?: string;
  combo?: string[];
  drill?: string[];
}

const BOXING_SEGMENT_TYPES = ['combo', 'shadowboxing', 'doubleend'];

/** A round that calls out real moves. Freestyle has nothing to land, and speed bag drills aren't combos. */
export function isComboRound(segment: SegmentShape): boolean {
  if (segment.type !== 'active' || !BOXING_SEGMENT_TYPES.includes(segment.segmentType ?? '')) return false;
  const moves = segment.combo?.length ? segment.combo : segment.drill;
  return !!moves?.length && !moves.every((move) => move.toUpperCase() === 'FREESTYLE');
}

/** What a second spent on this segment counts as. */
export function contentOfSegment(segment: SegmentShape): keyof SessionContent | null {
  if (segment.type !== 'active') return null;
  if (isComboRound(segment)) return 'combos';
  const activity = getActivityTypeFromName(segment.name, segment.segmentType);
  if (activity === 'pushups' || activity === 'burpees' || activity === 'curlups') return activity;
  if (activity === 'jog' || activity === 'jog_in_place' || activity === 'treadmill') return 'jogRun';
  return null;
}

/** What the session has done so far. Updated as it runs, and started over on a restart. */
export interface SessionLog {
  content: SessionContent;
  paused: boolean;
  cutShort: boolean;
  ranToEnd: boolean;
}

export const FRESH_SESSION: SessionLog = { content: NOTHING_TRAINED, paused: false, cutShort: false, ranToEnd: false };

/** Records time on a segment. Returns the same log when nothing changed, so it can run on every tick. */
export function noteTraining(log: SessionLog, segment: SegmentShape): SessionLog {
  const kind = contentOfSegment(segment);
  if (!kind || log.content[kind]) return log;
  return { ...log, content: { ...log.content, [kind]: true } };
}

/** What the badge checks need to know about this session, beyond how long it was. */
export interface SessionFacts {
  content: SessionContent;
  finished: boolean;
  unpaused: boolean;
  comboRounds: number;
}

export const NOTHING_DONE: SessionFacts = { content: NOTHING_TRAINED, finished: false, unpaused: false, comboRounds: 0 };

export function toSessionFacts(log: SessionLog, segments: SegmentShape[]): SessionFacts {
  const finished = log.ranToEnd && !log.cutShort;
  return {
    content: log.content,
    finished,
    unpaused: finished && !log.paused,
    comboRounds: finished ? segments.filter(isComboRound).length : 0,
  };
}

export interface SessionCredit {
  sessions: number;
  combos: number;
  pushups: number;
  burpees: number;
  curlups: number;
  jogRunMinutes: number;
  complexCombos: number;
  defenseCombos: number;
  counterCombos: number;
}

/**
 * The per-session estimates, pro-rated by time actually trained, for only the kinds of training the
 * session really had. A full session of the full mix gets exactly the documented numbers. The
 * constants themselves are the design and don't change here.
 */
export function getSessionCredit(sessionSeconds: number, tier: Prestige, content: SessionContent): SessionCredit {
  const effort = getSessionEffort(sessionSeconds);
  const tierStats = TIER_COMBO_STATS[tier];
  const scale = (estimate: number, trained: boolean) => (trained ? Math.round(estimate * effort) : 0);

  return {
    sessions: effort > 0 ? 1 : 0,
    combos: scale(PER_SESSION_ESTIMATES.combosLanded, content.combos),
    pushups: scale(PER_SESSION_ESTIMATES.pushups, content.pushups),
    burpees: scale(PER_SESSION_ESTIMATES.burpees, content.burpees),
    curlups: scale(PER_SESSION_ESTIMATES.curlups, content.curlups),
    jogRunMinutes: scale(PER_SESSION_ESTIMATES.jogRunMinutes, content.jogRun),
    complexCombos: scale(tierStats.complex, content.combos),
    defenseCombos: scale(tierStats.defense, content.combos),
    counterCombos: scale(tierStats.counter, content.combos),
  };
}

export interface LifetimeStats {
  combos_landed?: number | null;
  complex_combos?: number | null;
  defense_combos?: number | null;
  counter_combos?: number | null;
  workouts_completed?: number | null;
  total_training_seconds?: number | null;
  total_pushups?: number | null;
  total_burpees?: number | null;
  total_curlups?: number | null;
  total_jog_run_minutes?: number | null;
}

/** Lifetime stats plus this session's credit, in the shape the badge checks read. */
export function buildSessionBadgeStats(
  profile: LifetimeStats,
  tier: Prestige,
  sessionSeconds: number,
  consecutiveDays: number,
  facts: SessionFacts,
): BadgeStats {
  const credit = getSessionCredit(sessionSeconds, tier, facts.content);
  const earned = getSessionEffort(sessionSeconds) > 0;

  return {
    consecutiveDays,
    totalCombos: (profile.combos_landed || 0) + credit.combos,
    complexCombos: (profile.complex_combos || 0) + credit.complexCombos,
    defenseCombos: (profile.defense_combos || 0) + credit.defenseCombos,
    counterCombos: (profile.counter_combos || 0) + credit.counterCombos,
    totalSessions: (profile.workouts_completed || 0) + credit.sessions,
    totalHours: ((profile.total_training_seconds || 0) + sessionSeconds) / 3600,
    singleSessionMinutes: sessionSeconds / 60,
    totalPushups: (profile.total_pushups || 0) + credit.pushups,
    totalBurpees: (profile.total_burpees || 0) + credit.burpees,
    totalCurlups: (profile.total_curlups || 0) + credit.curlups,
    totalJogRunMinutes: (profile.total_jog_run_minutes || 0) + credit.jogRunMinutes,
    sessionFinished: earned && facts.finished ? 1 : 0,
    sessionFinishedUnpaused: earned && facts.unpaused ? 1 : 0,
    sessionComboRounds: earned ? facts.comboRounds : 0,
  };
}
