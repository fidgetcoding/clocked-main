// What a logged session adds to the profile, in the shape credit_session_to_profile takes. Keep both
// lists in step with that function in supabase/migrations/20261105090000_atomic_reorder_and_session_credit.sql.

/** Counters the server adds to. */
export const PROFILE_COUNTERS = [
  'total_xp', 'combos_landed', 'total_pushups', 'total_burpees', 'total_curlups', 'total_jog_run_minutes',
  'complex_combos', 'defense_combos', 'counter_combos',
  'morning_workouts', 'night_workouts', 'weekend_workouts', 'weekday_workouts', 'monday_workouts',
  'friday_workouts', 'sunday_workouts', 'double_days', 'holiday_workouts', 'comeback_count',
  'post_l100_sessions', 'overflow_xp',
  'punch_1_count', 'punch_2_count', 'punch_3_count', 'punch_4_count',
  'punch_5_count', 'punch_6_count', 'punch_7_count', 'punch_8_count',
  'slips_count', 'rolls_count', 'pullbacks_count', 'circles_count',
] as const;

/** Whole-profile values the server sets, keeping the larger or newer one where that matters. */
export const PROFILE_FIELDS = [
  'current_streak', 'longest_streak', 'last_workout_date', 'workouts_completed',
  'total_training_seconds', 'new_years_workout', 'best_session_xp',
] as const;

const COUNTERS = new Set<string>(PROFILE_COUNTERS);
const FIELDS = new Set<string>(PROFILE_FIELDS);

export interface SessionCredit {
  totals: Partial<Record<(typeof PROFILE_COUNTERS)[number], number>>;
  fields: Partial<Record<(typeof PROFILE_FIELDS)[number], number | string | boolean | null>>;
}

/**
 * The stats helpers return new values built on the browser's copy of the profile. Only the
 * difference is sent for counters, so the server adds it to whatever another tab already saved.
 */
export function toSessionCredit(profile: object, update: object): SessionCredit {
  const known = profile as Record<string, unknown>;
  const credit: SessionCredit = { totals: {}, fields: {} };
  for (const [key, value] of Object.entries(update)) {
    if (value === undefined) continue;
    if (COUNTERS.has(key)) {
      const added = Math.round(Number(value) - (Number(known[key]) || 0));
      if (Number.isFinite(added) && added > 0) credit.totals[key as keyof SessionCredit['totals']] = added;
    } else if (FIELDS.has(key)) {
      credit.fields[key as keyof SessionCredit['fields']] = value as number | string | boolean | null;
    } else {
      throw new Error(`${key} can't be credited from a session`);
    }
  }
  return credit;
}
