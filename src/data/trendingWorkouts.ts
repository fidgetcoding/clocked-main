import { Workout } from '@/types';

export interface TrendingWorkout extends Workout {
  author: string;
  authorHandle: string;
  rating: number;
  ratingCount: number;
  downloads: number;
  tags: string[];
}

export const TRENDING_WORKOUTS: TrendingWorkout[] = [
  {
    id: 'demo-workout',
    name: 'Quick Morning Jabs',
    icon: '🏃',
    difficulty: 'beginner',
    totalDuration: 900,
    isPreset: true,
    isArchived: false,
    createdAt: new Date(),
    timesCompleted: 0,
    author: 'Demo',
    authorHandle: '@demo',
    rating: 4.9,
    ratingCount: 156,
    downloads: 8200,
    tags: ['Boxing', 'Beginner', 'Quick'],
    sections: {
      warmup: [
        {
          id: 'w1',
          name: 'Quick Warmup',
          repeats: 1,
          segments: [
            { id: 'w1s1', name: 'Jumping Jacks', type: 'active', segmentType: 'exercise', duration: 60 },
            { id: 'w1s2', name: 'Shadow Box', type: 'active', segmentType: 'shadowboxing', duration: 90 },
          ],
        },
      ],
      grind: [
        {
          id: 'g1',
          name: 'Jab Drills',
          repeats: 4,
          segments: [
            { id: 'g1s1', name: 'Jab Practice', type: 'active', segmentType: 'combo', duration: 120 },
            { id: 'g1s2', name: 'Rest', type: 'rest', segmentType: 'rest', duration: 30 },
          ],
        },
      ],
      cooldown: [
        {
          id: 'c1',
          name: 'Stretch',
          repeats: 1,
          segments: [
            { id: 'c1s1', name: 'Cool Down', type: 'active', segmentType: 'exercise', duration: 90 },
          ],
        },
      ],
    },
    combos: [['jab', 'jab'], ['jab', 'cross']],
  },
];

export const WORKOUT_CATEGORIES = ['All', 'Boxing', 'HIIT', 'Conditioning', 'Beginner', 'Advanced', 'Cardio'] as const;
export type WorkoutCategory = typeof WORKOUT_CATEGORIES[number];
