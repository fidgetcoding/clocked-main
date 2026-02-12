import { supabase } from '@/integrations/supabase/client';

/**
 * Calculate streak and workout count after logging a session.
 * Call this in handleLog's onSuccess callback.
 */
export async function computePostLogStats(
  userId: string,
  profile: {
    last_workout_date: string | null;
    current_streak: number;
    longest_streak: number;
  }
) {
  // 1. Self-healing workout count: get actual count from workout_history
  const { count, error } = await supabase
    .from('workout_history')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to count workout history:', error);
    return null;
  }

  const workoutsCompleted = count || 0;

  // 2. Self-healing total training seconds: sum all durations from workout_history
  const { data: durationData, error: durationError } = await supabase
    .rpc('get_total_training_seconds', { target_user_id: userId });

  if (durationError) {
    console.error('Failed to sum training seconds:', durationError);
  }

  const totalTrainingSeconds = durationError ? undefined : (durationData || 0);

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
