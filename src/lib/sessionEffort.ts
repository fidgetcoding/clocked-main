import { BadgeStats } from '@/data/badges';
import { PER_SESSION_ESTIMATES, Prestige, TIER_COMBO_STATS } from '@/lib/xpSystem';

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
 * The per-session estimates, pro-rated by time actually trained. A full session gets exactly the
 * documented numbers. The constants themselves are the design and don't change here.
 */
export function getSessionCredit(sessionSeconds: number, tier: Prestige): SessionCredit {
  const effort = getSessionEffort(sessionSeconds);
  const tierStats = TIER_COMBO_STATS[tier];
  const scale = (estimate: number) => Math.round(estimate * effort);

  return {
    sessions: effort > 0 ? 1 : 0,
    combos: scale(PER_SESSION_ESTIMATES.combosLanded),
    pushups: scale(PER_SESSION_ESTIMATES.pushups),
    burpees: scale(PER_SESSION_ESTIMATES.burpees),
    curlups: scale(PER_SESSION_ESTIMATES.curlups),
    jogRunMinutes: scale(PER_SESSION_ESTIMATES.jogRunMinutes),
    complexCombos: scale(tierStats.complex),
    defenseCombos: scale(tierStats.defense),
    counterCombos: scale(tierStats.counter),
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
): BadgeStats {
  const credit = getSessionCredit(sessionSeconds, tier);

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
  };
}
