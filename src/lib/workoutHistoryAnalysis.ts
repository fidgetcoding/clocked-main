// =====================================================
// Workout History Analysis - AI Coach Intelligence
// =====================================================

import { WorkoutHistoryEntry } from '@/hooks/useWorkoutHistory';

// =====================================================
// Types
// =====================================================

export interface HistoryInsights {
  averageDifficulty: 'too_easy' | 'just_right' | 'too_hard' | null;
  recentTrend: 'getting_easier' | 'stable' | 'getting_harder' | null;
  weakRounds: number[]; // Rounds consistently rated low (1-2)
  strongRounds: number[]; // Rounds consistently rated high (4-5)
  preferredDuration: number; // Average workout duration in minutes
  lastWorkoutDate: Date | null;
  totalWorkouts: number;
  suggestedAdjustments: string[];
  // AI generation hints
  suggestedDifficultyAdjust: -1 | 0 | 1; // -1 = easier, 0 = same, 1 = harder
  suggestedRestAdjust: number; // Percentage adjustment (e.g., 1.2 = 20% more rest)
  suggestedRoundsAdjust: number; // Number of rounds to add/subtract
}

export interface RoundFeedbackEntry {
  roundNumber: number;
  rating: number; // 1-5
}

// =====================================================
// Main Analysis Function
// =====================================================

/**
 * Analyze workout history to generate personalized insights for AI coach
 * @param history - Array of workout history entries
 * @param recentCount - Number of recent workouts to analyze (default 10)
 */
export function analyzeWorkoutHistory(
  history: WorkoutHistoryEntry[],
  recentCount: number = 10
): HistoryInsights {
  // Initialize default insights
  const insights: HistoryInsights = {
    averageDifficulty: null,
    recentTrend: null,
    weakRounds: [],
    strongRounds: [],
    preferredDuration: 30, // Default 30 minutes
    lastWorkoutDate: null,
    totalWorkouts: history.length,
    suggestedAdjustments: [],
    suggestedDifficultyAdjust: 0,
    suggestedRestAdjust: 1.0,
    suggestedRoundsAdjust: 0,
  };

  if (history.length === 0) {
    insights.suggestedAdjustments.push('Complete your first workout to get personalized recommendations!');
    return insights;
  }

  // Sort by date (most recent first)
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
  );

  // Get recent workouts for analysis
  const recentWorkouts = sortedHistory.slice(0, recentCount);
  
  // Set last workout date
  insights.lastWorkoutDate = new Date(sortedHistory[0].completed_at);

  // Calculate average difficulty
  insights.averageDifficulty = calculateAverageDifficulty(recentWorkouts);
  
  // Detect trend over time
  insights.recentTrend = detectDifficultyTrend(recentWorkouts);
  
  // Analyze round feedback
  const roundAnalysis = analyzeRoundFeedback(recentWorkouts);
  insights.weakRounds = roundAnalysis.weakRounds;
  insights.strongRounds = roundAnalysis.strongRounds;
  
  // Calculate preferred duration
  insights.preferredDuration = calculatePreferredDuration(recentWorkouts);
  
  // Generate suggestions and adjustments
  generateSuggestionsAndAdjustments(insights);

  return insights;
}

// =====================================================
// Helper Functions
// =====================================================

/**
 * Calculate the average difficulty rating from recent workouts
 */
function calculateAverageDifficulty(
  workouts: WorkoutHistoryEntry[]
): 'too_easy' | 'just_right' | 'too_hard' | null {
  const ratings = workouts
    .filter(w => w.difficulty)
    .map(w => w.difficulty as 'too_easy' | 'just_right' | 'too_hard');

  if (ratings.length === 0) return null;

  // Count occurrences
  const counts = {
    too_easy: ratings.filter(r => r === 'too_easy').length,
    just_right: ratings.filter(r => r === 'just_right').length,
    too_hard: ratings.filter(r => r === 'too_hard').length,
  };

  // Return the most common rating
  const max = Math.max(counts.too_easy, counts.just_right, counts.too_hard);
  if (counts.too_easy === max) return 'too_easy';
  if (counts.too_hard === max) return 'too_hard';
  return 'just_right';
}

/**
 * Detect if workouts are getting easier or harder over time
 */
function detectDifficultyTrend(
  workouts: WorkoutHistoryEntry[]
): 'getting_easier' | 'stable' | 'getting_harder' | null {
  if (workouts.length < 3) return null;

  // Map difficulty to numeric value
  const difficultyValue = (d: string | null): number => {
    if (d === 'too_easy') return 1;
    if (d === 'just_right') return 2;
    if (d === 'too_hard') return 3;
    return 2; // Default to just_right
  };

  // Get ratings in chronological order (oldest first)
  const chronological = [...workouts]
    .reverse()
    .filter(w => w.difficulty)
    .map(w => difficultyValue(w.difficulty));

  if (chronological.length < 3) return null;

  // Compare first half to second half
  const midpoint = Math.floor(chronological.length / 2);
  const firstHalf = chronological.slice(0, midpoint);
  const secondHalf = chronological.slice(midpoint);

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const difference = secondAvg - firstAvg;

  if (difference < -0.3) return 'getting_easier';
  if (difference > 0.3) return 'getting_harder';
  return 'stable';
}

/**
 * Analyze round-by-round feedback across workouts
 */
function analyzeRoundFeedback(workouts: WorkoutHistoryEntry[]): {
  weakRounds: number[];
  strongRounds: number[];
} {
  // Aggregate ratings by round number
  const roundRatings: Map<number, number[]> = new Map();

  for (const workout of workouts) {
    const feedback = workout.round_feedback as RoundFeedbackEntry[] | null;
    if (!feedback || !Array.isArray(feedback)) continue;

    for (const entry of feedback) {
      if (typeof entry.roundNumber !== 'number' || typeof entry.rating !== 'number') continue;
      
      const existing = roundRatings.get(entry.roundNumber) || [];
      existing.push(entry.rating);
      roundRatings.set(entry.roundNumber, existing);
    }
  }

  const weakRounds: number[] = [];
  const strongRounds: number[] = [];

  for (const [roundNum, ratings] of roundRatings) {
    if (ratings.length < 2) continue; // Need at least 2 data points

    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    
    if (avg <= 2) {
      weakRounds.push(roundNum);
    } else if (avg >= 4) {
      strongRounds.push(roundNum);
    }
  }

  return {
    weakRounds: weakRounds.sort((a, b) => a - b),
    strongRounds: strongRounds.sort((a, b) => a - b),
  };
}

/**
 * Calculate preferred workout duration in minutes
 */
function calculatePreferredDuration(workouts: WorkoutHistoryEntry[]): number {
  const durations = workouts.map(w => w.duration / 60); // Convert to minutes

  if (durations.length === 0) return 30;

  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  return Math.round(avg);
}

/**
 * Generate suggestions and AI adjustment parameters based on insights
 */
function generateSuggestionsAndAdjustments(insights: HistoryInsights): void {
  // Based on average difficulty
  if (insights.averageDifficulty === 'too_easy') {
    insights.suggestedAdjustments.push('Your recent workouts have been too easy - time to step it up!');
    insights.suggestedDifficultyAdjust = 1;
    insights.suggestedRoundsAdjust = 1;
    insights.suggestedRestAdjust = 0.9; // 10% less rest
  } else if (insights.averageDifficulty === 'too_hard') {
    insights.suggestedAdjustments.push('You\'ve been pushing hard - consider dialing back intensity.');
    insights.suggestedDifficultyAdjust = -1;
    insights.suggestedRoundsAdjust = -1;
    insights.suggestedRestAdjust = 1.2; // 20% more rest
  } else if (insights.averageDifficulty === 'just_right') {
    insights.suggestedAdjustments.push('You\'re in the zone! Keep up the great work.');
  }

  // Based on trend
  if (insights.recentTrend === 'getting_easier') {
    insights.suggestedAdjustments.push('Workouts are feeling easier - you\'re getting stronger!');
    // Encourage progression
    if (insights.suggestedDifficultyAdjust === 0) {
      insights.suggestedDifficultyAdjust = 1;
    }
  } else if (insights.recentTrend === 'getting_harder') {
    insights.suggestedAdjustments.push('Workouts are getting tougher - make sure to recover properly.');
  }

  // Based on weak rounds
  if (insights.weakRounds.length > 0) {
    const roundList = insights.weakRounds.slice(0, 3).join(', ');
    insights.suggestedAdjustments.push(`Rounds ${roundList} are consistently challenging - focus on pacing.`);
  }

  // Based on strong rounds
  if (insights.strongRounds.length > 0) {
    insights.suggestedAdjustments.push('You\'re crushing the early rounds - great conditioning!');
  }

  // If no history to analyze
  if (insights.totalWorkouts === 0) {
    insights.suggestedAdjustments = ['Complete your first workout to get personalized recommendations!'];
  } else if (insights.totalWorkouts < 3) {
    insights.suggestedAdjustments.push('Complete a few more workouts for better personalization.');
  }
}

// =====================================================
// AI Generation Helpers
// =====================================================

/**
 * Get adjusted difficulty based on history insights
 */
export function getAdjustedDifficulty(
  baseDifficulty: 'beginner' | 'intermediate' | 'advanced',
  insights: HistoryInsights
): 'beginner' | 'intermediate' | 'advanced' {
  const levels = ['beginner', 'intermediate', 'advanced'] as const;
  const currentIndex = levels.indexOf(baseDifficulty);
  const newIndex = Math.max(0, Math.min(2, currentIndex + insights.suggestedDifficultyAdjust));
  return levels[newIndex];
}

/**
 * Get adjusted rest duration based on history insights
 */
export function getAdjustedRestDuration(baseRest: number, insights: HistoryInsights): number {
  return Math.round(baseRest * insights.suggestedRestAdjust);
}

/**
 * Get adjusted round count based on history insights
 */
export function getAdjustedRounds(baseRounds: number, insights: HistoryInsights): number {
  return Math.max(1, baseRounds + insights.suggestedRoundsAdjust);
}

/**
 * Generate a summary string for displaying insights in UI
 */
export function getInsightsSummary(insights: HistoryInsights): string | null {
  if (insights.totalWorkouts === 0) return null;
  
  const parts: string[] = [];
  
  if (insights.averageDifficulty === 'too_easy') {
    parts.push('ready for more challenge');
  } else if (insights.averageDifficulty === 'too_hard') {
    parts.push('might benefit from lighter intensity');
  } else if (insights.averageDifficulty === 'just_right') {
    parts.push('workouts feel just right');
  }
  
  if (insights.recentTrend === 'getting_easier') {
    parts.push('getting stronger');
  }
  
  if (parts.length === 0) return null;
  
  return `Based on your last ${Math.min(insights.totalWorkouts, 10)} workouts: ${parts.join(', ')}.`;
}
