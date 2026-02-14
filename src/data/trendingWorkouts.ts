// Trending workouts data - tier presets are now served from the database via useTierPresets hook.
// This file retains only the category filter list and the TrendingWorkout type for community shared presets.

import { Workout } from '@/types';

export interface TrendingWorkout extends Workout {
  author: string;
  authorHandle: string;
  rating: number;
  ratingCount: number;
  downloads: number;
  tags: string[];
}

// No more static trending workouts — they come from tier_presets DB table
export const TRENDING_WORKOUTS: TrendingWorkout[] = [];

export const WORKOUT_CATEGORIES = ['All', 'Boxing', 'HIIT', 'Conditioning', 'Rookie', 'Beginner', 'Intermediate', 'Advanced', 'Pro', 'Cardio'] as const;
export type WorkoutCategory = typeof WORKOUT_CATEGORIES[number];
