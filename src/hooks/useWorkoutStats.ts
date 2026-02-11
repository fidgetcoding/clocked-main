import { useMemo } from 'react';
import { useWorkoutHistory } from './useWorkoutHistory';
import { useProfile } from './useProfile';
import { startOfWeek, subWeeks, isAfter, isBefore, parseISO } from 'date-fns';

// Difficulty feedback to intensity score mapping (1-5 scale)
const DIFFICULTY_TO_INTENSITY: Record<string, number> = {
  'too_easy': 2,
  'just_right': 3,
  'too_hard': 5,
};

// Calorie estimation rates (calories per minute) - fallback when no weight
const CALORIE_RATES: Record<string, number> = {
  'too_easy': 8,
  'just_right': 10,
  'too_hard': 12,
  'default': 10,
};

// MET values from the Compendium of Physical Activities (boxing)
const DIFFICULTY_TO_MET: Record<string, number> = {
  'too_easy': 5.5,   // Light/shadowboxing
  'just_right': 7.8, // Moderate bag work
  'too_hard': 12.8,  // Intense sparring-level
  'default': 7.8,
};

// MET-based calorie calculation: cal/min = MET × weight(kg) × 3.5 / 200
function metCaloriesPerMinute(met: number, weightKg: number): number {
  return (met * weightKg * 3.5) / 200;
}

export interface PeriodStats {
  xp: number;
  workouts: number;
  trainingMinutes: number;
  rounds: number;
  calories: number;
  intensitySum: number;
  intensityCount: number;
}

export interface WeeklyChange {
  value: number;
  period: string;
}

export interface WorkoutStats {
  totalTrainingMinutes: number;
  totalTrainingHours: number;
  totalRounds: number;
  avgIntensity: number | null; // null if no feedback exists
  totalCalories: number;
  workoutsWithFeedback: number;
  // Weekly changes (real data)
  changes: {
    xp: WeeklyChange | null;
    workouts: WeeklyChange | null;
    hours: WeeklyChange | null;
    rounds: WeeklyChange | null;
    calories: WeeklyChange | null;
    intensity: WeeklyChange | null;
  };
}

function calculatePeriodStats(entries: any[], weightKg?: number | null): PeriodStats {
  let xp = 0;
  let trainingSeconds = 0;
  let rounds = 0;
  let calories = 0;
  let intensitySum = 0;
  let intensityCount = 0;

  for (const entry of entries) {
    xp += entry.xp_earned || 0;
    trainingSeconds += entry.duration || 0;

    // Count rounds
    if (entry.round_feedback && Array.isArray(entry.round_feedback) && entry.round_feedback.length > 0) {
      rounds += entry.round_feedback.length;
    } else if (entry.duration) {
      rounds += Math.max(1, Math.floor(entry.duration / 180));
    }

    // Calculate calories
    const durationMinutes = (entry.duration || 0) / 60;
    if (weightKg && weightKg > 0) {
      const met = entry.difficulty && DIFFICULTY_TO_MET[entry.difficulty]
        ? DIFFICULTY_TO_MET[entry.difficulty]
        : DIFFICULTY_TO_MET.default;
      calories += Math.round(durationMinutes * metCaloriesPerMinute(met, weightKg));
    } else {
      const calorieRate = entry.difficulty && CALORIE_RATES[entry.difficulty] 
        ? CALORIE_RATES[entry.difficulty] 
        : CALORIE_RATES.default;
      calories += Math.round(durationMinutes * calorieRate);
    }

    // Intensity
    if (entry.difficulty && DIFFICULTY_TO_INTENSITY[entry.difficulty]) {
      intensitySum += DIFFICULTY_TO_INTENSITY[entry.difficulty];
      intensityCount++;
    }
  }

  return {
    xp,
    workouts: entries.length,
    trainingMinutes: Math.floor(trainingSeconds / 60),
    rounds,
    calories,
    intensitySum,
    intensityCount,
  };
}

function calculateChange(current: number, previous: number): WeeklyChange | null {
  // If both are 0, no change to show
  if (current === 0 && previous === 0) {
    return null;
  }
  
  // If previous was 0 but current has value, show as new (don't divide by 0)
  if (previous === 0 && current > 0) {
    return { value: 100, period: 'this week' };
  }
  
  // Calculate percentage change
  const change = Math.round(((current - previous) / previous) * 100);
  return { value: change, period: 'this week' };
}

export function useWorkoutStats() {
  const { history, isLoading, error } = useWorkoutHistory();
  const { profile } = useProfile();
  const weightKg = profile?.weight_kg;

  const stats = useMemo<WorkoutStats>(() => {
    const emptyChanges = {
      xp: null,
      workouts: null,
      hours: null,
      rounds: null,
      calories: null,
      intensity: null,
    };

    if (!history || history.length === 0) {
      return {
        totalTrainingMinutes: 0,
        totalTrainingHours: 0,
        totalRounds: 0,
        avgIntensity: null,
        totalCalories: 0,
        workoutsWithFeedback: 0,
        changes: emptyChanges,
      };
    }

    // Calculate total stats
    let totalDurationSeconds = 0;
    let totalRounds = 0;
    let intensitySum = 0;
    let intensityCount = 0;
    let totalCalories = 0;

    for (const entry of history) {
      totalDurationSeconds += entry.duration || 0;

      if (entry.round_feedback && Array.isArray(entry.round_feedback) && entry.round_feedback.length > 0) {
        totalRounds += entry.round_feedback.length;
      } else if (entry.duration) {
        totalRounds += Math.max(1, Math.floor(entry.duration / 180));
      }

      if (entry.difficulty && DIFFICULTY_TO_INTENSITY[entry.difficulty]) {
        intensitySum += DIFFICULTY_TO_INTENSITY[entry.difficulty];
        intensityCount++;
      }

      const durationMinutes = (entry.duration || 0) / 60;
      if (weightKg && weightKg > 0) {
        const met = entry.difficulty && DIFFICULTY_TO_MET[entry.difficulty]
          ? DIFFICULTY_TO_MET[entry.difficulty]
          : DIFFICULTY_TO_MET.default;
        totalCalories += Math.round(durationMinutes * metCaloriesPerMinute(met, weightKg));
      } else {
        const calorieRate = entry.difficulty && CALORIE_RATES[entry.difficulty] 
          ? CALORIE_RATES[entry.difficulty] 
          : CALORIE_RATES.default;
        totalCalories += Math.round(durationMinutes * calorieRate);
      }
    }

    const totalMinutes = Math.floor(totalDurationSeconds / 60);
    const totalHours = totalMinutes / 60;

    // Calculate weekly changes
    const now = new Date();
    const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
    const lastWeekStart = subWeeks(thisWeekStart, 1);
    const lastWeekEnd = thisWeekStart;

    const thisWeekEntries = history.filter(entry => {
      const date = parseISO(entry.completed_at);
      return isAfter(date, thisWeekStart) || date.getTime() === thisWeekStart.getTime();
    });

    const lastWeekEntries = history.filter(entry => {
      const date = parseISO(entry.completed_at);
      return (isAfter(date, lastWeekStart) || date.getTime() === lastWeekStart.getTime()) && isBefore(date, lastWeekEnd);
    });

    const thisWeekStats = calculatePeriodStats(thisWeekEntries, weightKg);
    const lastWeekStats = calculatePeriodStats(lastWeekEntries, weightKg);

    // Calculate changes
    const changes = {
      xp: calculateChange(thisWeekStats.xp, lastWeekStats.xp),
      workouts: calculateChange(thisWeekStats.workouts, lastWeekStats.workouts),
      hours: calculateChange(thisWeekStats.trainingMinutes, lastWeekStats.trainingMinutes),
      rounds: calculateChange(thisWeekStats.rounds, lastWeekStats.rounds),
      calories: calculateChange(thisWeekStats.calories, lastWeekStats.calories),
      intensity: thisWeekStats.intensityCount > 0 && lastWeekStats.intensityCount > 0
        ? calculateChange(
            thisWeekStats.intensitySum / thisWeekStats.intensityCount,
            lastWeekStats.intensitySum / lastWeekStats.intensityCount
          )
        : null,
    };

    return {
      totalTrainingMinutes: totalMinutes,
      totalTrainingHours: Math.round(totalHours * 10) / 10,
      totalRounds,
      avgIntensity: intensityCount > 0 ? Math.round((intensitySum / intensityCount) * 10) / 10 : null,
      totalCalories,
      workoutsWithFeedback: intensityCount,
      changes,
    };
  }, [history, weightKg]);

  return {
    stats,
    history,
    isLoading,
    error,
  };
}
