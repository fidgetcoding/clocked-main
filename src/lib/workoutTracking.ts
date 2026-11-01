import { supabase } from '@/integrations/supabase/client';
import { Prestige, getLevelFromXP } from '@/lib/xpSystem';
import { GUEST_USER_ID } from '@/lib/guest';
import { useHistoryStore } from '@/stores/historyStore';
import { MIN_REWARD_SECONDS, qualifiesForRewards } from '@/lib/sessionEffort';

/**
 * Calculate streak and workout count after logging a session.
 * Call this in handleLog's onSuccess callback.
 */
export async function computePostLogStats(
  userId: string,
  profile: {
    user_id?: string;
    last_workout_date: string | null;
    current_streak: number;
    longest_streak: number;
  },
  sessionSeconds: number
) {
  let workoutsCompleted: number;
  let totalTrainingSeconds: number | undefined;

  if (profile.user_id === GUEST_USER_ID) {
    // Guest history lives in the browser, so the same totals come from there
    const { guestHistory } = useHistoryStore.getState();
    workoutsCompleted = guestHistory.filter((entry) => entry.duration >= MIN_REWARD_SECONDS).length;
    totalTrainingSeconds = guestHistory.reduce((sum, entry) => sum + (entry.duration || 0), 0);
  } else {
    // 1. Self-healing workout count: get actual count from workout_history
    const { count, error } = await supabase
      .from('workout_history')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('duration', MIN_REWARD_SECONDS);

    if (error) {
      console.error('Failed to count workout history:', error);
      return null;
    }

    workoutsCompleted = count || 0;

    // 2. Self-healing total training seconds: sum all durations from workout_history
    const { data: durationData, error: durationError } = await supabase
      .rpc('get_total_training_seconds' as any, { target_user_id: userId });

    if (durationError) {
      console.error('Failed to sum training seconds:', durationError);
    }

    totalTrainingSeconds = durationError ? undefined : ((durationData as number) || 0);
  }

  // A session under the minimum is on the record but doesn't move the streak
  if (!qualifiesForRewards(sessionSeconds)) {
    const totals: Record<string, any> = { workouts_completed: workoutsCompleted };
    if (totalTrainingSeconds !== undefined) totals.total_training_seconds = totalTrainingSeconds;
    return totals;
  }

  // 3. Streak logic
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let newStreak: number;
  const lastDate = profile.last_workout_date; // date string or null

  if (lastDate === todayStr) {
    // Already worked out today, don't double-count
    newStreak = profile.current_streak;
  } else if (lastDate === yesterdayStr) {
    // Consecutive day
    newStreak = profile.current_streak + 1;
  } else {
    // Gap or first workout ever
    newStreak = 1;
  }

  const longestStreak = Math.max(newStreak, profile.longest_streak);

  const result: Record<string, any> = {
    workouts_completed: workoutsCompleted,
    current_streak: newStreak,
    longest_streak: longestStreak,
    last_workout_date: todayStr,
  };

  if (totalTrainingSeconds !== undefined) {
    result.total_training_seconds = totalTrainingSeconds;
  }

  return result;
}

// =====================================================
// Post-L100 Stat Tracking Helpers
// =====================================================

/**
 * Detect time-of-day category for the current workout.
 */
export function getTimeOfDayStats(): { isMorning: boolean; isNight: boolean } {
  const hour = new Date().getHours();
  return {
    isMorning: hour >= 5 && hour < 10,  // 5am-10am
    isNight: hour >= 21 || hour < 5,     // 9pm-5am
  };
}

/**
 * Detect day-of-week stats for the current workout.
 */
export function getDayOfWeekStats(): {
  isWeekend: boolean;
  isWeekday: boolean;
  isMonday: boolean;
  isFriday: boolean;
  isSunday: boolean;
} {
  const day = new Date().getDay(); // 0=Sun, 6=Sat
  return {
    isWeekend: day === 0 || day === 6,
    isWeekday: day >= 1 && day <= 5,
    isMonday: day === 1,
    isFriday: day === 5,
    isSunday: day === 0,
  };
}

/**
 * Check if today is a double day (already worked out today).
 */
export function isDoubleDay(lastWorkoutDate: string | null): boolean {
  if (!lastWorkoutDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return lastWorkoutDate === today.toISOString().split('T')[0];
}

/**
 * Check if today is a holiday (New Year's, or common US holidays).
 */
export function isHolidayWorkout(): { isNewYears: boolean; isHoliday: boolean } {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const day = now.getDate();
  
  const isNewYears = month === 0 && day === 1;
  
  // Common holidays: New Year's, July 4th, Thanksgiving (approx), Christmas, etc.
  const holidays = [
    [0, 1],   // New Year's Day
    [6, 4],   // July 4th
    [11, 25], // Christmas
    [11, 31], // New Year's Eve
  ];
  
  const isHoliday = holidays.some(([m, d]) => month === m && day === d);
  
  return { isNewYears, isHoliday };
}

/**
 * Check if the user was on a broken streak and came back (comeback).
 */
export function isComeback(lastWorkoutDate: string | null, currentStreak: number): boolean {
  if (!lastWorkoutDate || currentStreak > 0) return false;
  // If they had no streak (0) and the last workout was > 7 days ago, it's a comeback
  const last = new Date(lastWorkoutDate);
  const now = new Date();
  const daysSince = Math.floor((now.getTime() - last.getTime()) / 86400000);
  return daysSince >= 7;
}

/**
 * Compute all post-L100 tracking stat increments for a session.
 * Returns an object of field increments to merge into the profile update.
 */
export function computePostL100Increments(
  profile: Record<string, any>,
  sessionXP: number,
  flatSegments: Array<{ combo?: string[]; name: string; segmentType?: string; duration: number }>,
  sessionEffort: number,
): Record<string, any> {
  const increments: Record<string, any> = {};
  if (sessionEffort <= 0) return increments;
  
  const prestige = (profile.prestige || 'beginner') as Prestige;
  const currentLevel = profile.current_level || 1;
  const isAtL100 = currentLevel >= 100;
  
  // Time of day
  const { isMorning, isNight } = getTimeOfDayStats();
  if (isMorning) increments.morning_workouts = (profile.morning_workouts || 0) + 1;
  if (isNight) increments.night_workouts = (profile.night_workouts || 0) + 1;
  
  // Day of week
  const dayStats = getDayOfWeekStats();
  if (dayStats.isWeekend) increments.weekend_workouts = (profile.weekend_workouts || 0) + 1;
  if (dayStats.isWeekday) increments.weekday_workouts = (profile.weekday_workouts || 0) + 1;
  if (dayStats.isMonday) increments.monday_workouts = (profile.monday_workouts || 0) + 1;
  if (dayStats.isFriday) increments.friday_workouts = (profile.friday_workouts || 0) + 1;
  if (dayStats.isSunday) increments.sunday_workouts = (profile.sunday_workouts || 0) + 1;
  
  // Double day
  if (isDoubleDay(profile.last_workout_date)) {
    increments.double_days = (profile.double_days || 0) + 1;
  }
  
  // Holiday tracking
  const { isNewYears, isHoliday } = isHolidayWorkout();
  if (isNewYears) increments.new_years_workout = true;
  if (isHoliday) increments.holiday_workouts = (profile.holiday_workouts || 0) + 1;
  
  // Comeback detection
  if (isComeback(profile.last_workout_date, profile.current_streak || 0)) {
    increments.comeback_count = (profile.comeback_count || 0) + 1;
  }
  
  // Best session XP
  if (sessionXP > (profile.best_session_xp || 0)) {
    increments.best_session_xp = sessionXP;
  }
  
  // Post-L100 session count
  if (isAtL100) {
    increments.post_l100_sessions = (profile.post_l100_sessions || 0) + 1;
    
    // Overflow XP: XP earned while at L100 (beyond the tier threshold)
    increments.overflow_xp = (profile.overflow_xp || 0) + sessionXP;
  }
  
  // Per-punch and defense move counting from actual segments
  let punch1 = 0, punch2 = 0, punch3 = 0, punch4 = 0;
  let punch5 = 0, punch6 = 0, punch7 = 0, punch8 = 0;
  let slips = 0, rolls = 0, pullbacks = 0, circles = 0;
  
  for (const seg of flatSegments) {
    if (!seg.combo) continue;
    for (const move of seg.combo) {
      const m = move.toLowerCase().trim();
      // Punch counting
      if (m === '1') punch1++;
      else if (m === '2') punch2++;
      else if (m === '3') punch3++;
      else if (m === '4') punch4++;
      else if (m === '5') punch5++;
      else if (m === '6') punch6++;
      else if (m === '7') punch7++;
      else if (m === '8') punch8++;
      // Defense counting
      else if (m.startsWith('slip')) slips++;
      else if (m.startsWith('roll')) rolls++;
      else if (m.startsWith('pull')) pullbacks++;
      else if (m.startsWith('circle')) circles++;
    }
  }
  
  // Multiply by estimated reps per combo segment (combos repeat during duration)
  // Each combo segment typically repeats ~5 times in a 30s round
  const REP_MULTIPLIER = 5 * sessionEffort;
  increments.punch_1_count = (profile.punch_1_count || 0) + Math.round(punch1 * REP_MULTIPLIER);
  increments.punch_2_count = (profile.punch_2_count || 0) + Math.round(punch2 * REP_MULTIPLIER);
  increments.punch_3_count = (profile.punch_3_count || 0) + Math.round(punch3 * REP_MULTIPLIER);
  increments.punch_4_count = (profile.punch_4_count || 0) + Math.round(punch4 * REP_MULTIPLIER);
  increments.punch_5_count = (profile.punch_5_count || 0) + Math.round(punch5 * REP_MULTIPLIER);
  increments.punch_6_count = (profile.punch_6_count || 0) + Math.round(punch6 * REP_MULTIPLIER);
  increments.punch_7_count = (profile.punch_7_count || 0) + Math.round(punch7 * REP_MULTIPLIER);
  increments.punch_8_count = (profile.punch_8_count || 0) + Math.round(punch8 * REP_MULTIPLIER);
  increments.slips_count = (profile.slips_count || 0) + Math.round(slips * REP_MULTIPLIER);
  increments.rolls_count = (profile.rolls_count || 0) + Math.round(rolls * REP_MULTIPLIER);
  increments.pullbacks_count = (profile.pullbacks_count || 0) + Math.round(pullbacks * REP_MULTIPLIER);
  increments.circles_count = (profile.circles_count || 0) + Math.round(circles * REP_MULTIPLIER);
  
  return increments;
}
