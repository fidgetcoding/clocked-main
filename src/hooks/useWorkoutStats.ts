import { useMemo } from 'react';
import { useWorkoutHistory } from './useWorkoutHistory';

// Difficulty feedback to intensity score mapping (1-5 scale)
const DIFFICULTY_TO_INTENSITY: Record<string, number> = {
  'too_easy': 2,
  'just_right': 3,
  'too_hard': 5,
};

// Calorie estimation rates (calories per minute)
const CALORIE_RATES: Record<string, number> = {
  'too_easy': 8,
  'just_right': 10,
  'too_hard': 12,
  'default': 10,
};

export interface WorkoutStats {
  totalTrainingMinutes: number;
  totalTrainingHours: number;
  totalRounds: number;
  avgIntensity: number | null; // null if no feedback exists
  totalCalories: number;
  workoutsWithFeedback: number;
}

export function useWorkoutStats() {
  const { history, isLoading, error } = useWorkoutHistory();

  const stats = useMemo<WorkoutStats>(() => {
    if (!history || history.length === 0) {
      return {
        totalTrainingMinutes: 0,
        totalTrainingHours: 0,
        totalRounds: 0,
        avgIntensity: null,
        totalCalories: 0,
        workoutsWithFeedback: 0,
      };
    }

    let totalDurationSeconds = 0;
    let totalRounds = 0;
    let intensitySum = 0;
    let intensityCount = 0;
    let totalCalories = 0;

    for (const entry of history) {
      // Sum duration
      totalDurationSeconds += entry.duration || 0;

      // Count rounds from round_feedback array or estimate from duration
      if (entry.round_feedback && Array.isArray(entry.round_feedback) && entry.round_feedback.length > 0) {
        totalRounds += entry.round_feedback.length;
      } else if (entry.duration) {
        // Estimate rounds: assume ~3 min per round
        totalRounds += Math.max(1, Math.floor(entry.duration / 180));
      }

      // Calculate intensity from difficulty feedback
      if (entry.difficulty && DIFFICULTY_TO_INTENSITY[entry.difficulty]) {
        intensitySum += DIFFICULTY_TO_INTENSITY[entry.difficulty];
        intensityCount++;
      }

      // Estimate calories based on duration and difficulty
      const durationMinutes = (entry.duration || 0) / 60;
      const calorieRate = entry.difficulty && CALORIE_RATES[entry.difficulty] 
        ? CALORIE_RATES[entry.difficulty] 
        : CALORIE_RATES.default;
      totalCalories += Math.round(durationMinutes * calorieRate);
    }

    const totalMinutes = Math.floor(totalDurationSeconds / 60);
    const totalHours = totalMinutes / 60;

    return {
      totalTrainingMinutes: totalMinutes,
      totalTrainingHours: Math.round(totalHours * 10) / 10, // 1 decimal place
      totalRounds,
      avgIntensity: intensityCount > 0 ? Math.round((intensitySum / intensityCount) * 10) / 10 : null,
      totalCalories,
      workoutsWithFeedback: intensityCount,
    };
  }, [history]);

  return {
    stats,
    history,
    isLoading,
    error,
  };
}
