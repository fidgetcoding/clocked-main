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
    id: 'trending-1',
    name: '30-Min Boxing Blast',
    icon: '⚡',
    difficulty: 'intermediate',
    totalDuration: 1800,
    isPreset: true,
    isArchived: false,
    createdAt: new Date(),
    timesCompleted: 0,
    author: 'Mike Thompson',
    authorHandle: '@MikeTysonFan',
    rating: 4.8,
    ratingCount: 342,
    downloads: 12400,
    tags: ['Boxing', 'HIIT', 'Cardio'],
    sections: {
      warmup: [
        {
          id: 'w1',
          name: 'Dynamic Warmup',
          repeats: 1,
          segments: [
            { id: 'w1s1', name: 'Jump Rope', type: 'active', segmentType: 'work', duration: 120 },
            { id: 'w1s2', name: 'Arm Circles', type: 'active', segmentType: 'work', duration: 60 },
            { id: 'w1s3', name: 'Rest', type: 'rest', segmentType: 'rest', duration: 30 },
          ],
        },
      ],
      grind: [
        {
          id: 'g1',
          name: 'Power Rounds',
          repeats: 6,
          segments: [
            { id: 'g1s1', name: 'Heavy Bag', type: 'active', segmentType: 'work', duration: 180 },
            { id: 'g1s2', name: 'Rest', type: 'rest', segmentType: 'rest', duration: 60 },
          ],
        },
      ],
      cooldown: [
        {
          id: 'c1',
          name: 'Cooldown',
          repeats: 1,
          segments: [
            { id: 'c1s1', name: 'Shadow Box Light', type: 'active', segmentType: 'shadowboxing', duration: 120 },
            { id: 'c1s2', name: 'Stretch', type: 'active', segmentType: 'work', duration: 90 },
          ],
        },
      ],
    },
    combos: [['jab', 'cross', 'hook', 'cross'], ['jab', 'jab', 'cross']],
  },
  {
    id: 'trending-2',
    name: 'Quick Morning Jabs',
    icon: '🏃',
    difficulty: 'beginner',
    totalDuration: 900,
    isPreset: true,
    isArchived: false,
    createdAt: new Date(),
    timesCompleted: 0,
    author: 'Sarah Chen',
    authorHandle: '@EarlyBirdBoxer',
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
            { id: 'w1s1', name: 'Jumping Jacks', type: 'active', segmentType: 'work', duration: 60 },
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
            { id: 'c1s1', name: 'Cool Down', type: 'active', segmentType: 'work', duration: 90 },
          ],
        },
      ],
    },
    combos: [['jab', 'jab'], ['jab', 'cross']],
  },
  {
    id: 'trending-3',
    name: 'HIIT Knockout',
    icon: '💥',
    difficulty: 'advanced',
    totalDuration: 2400,
    isPreset: true,
    isArchived: false,
    createdAt: new Date(),
    timesCompleted: 0,
    author: 'James Wilson',
    authorHandle: '@HeavyHitter',
    rating: 4.7,
    ratingCount: 89,
    downloads: 5600,
    tags: ['HIIT', 'Advanced', 'Cardio'],
    sections: {
      warmup: [
        {
          id: 'w1',
          name: 'Intense Warmup',
          repeats: 1,
          segments: [
            { id: 'w1s1', name: 'Burpees', type: 'active', segmentType: 'work', duration: 90 },
            { id: 'w1s2', name: 'High Knees', type: 'active', segmentType: 'work', duration: 60 },
            { id: 'w1s3', name: 'Rest', type: 'rest', segmentType: 'rest', duration: 30 },
          ],
        },
      ],
      grind: [
        {
          id: 'g1',
          name: 'HIIT Rounds',
          repeats: 8,
          segments: [
            { id: 'g1s1', name: 'All Out', type: 'active', segmentType: 'work', duration: 45 },
            { id: 'g1s2', name: 'Active Rest', type: 'rest', segmentType: 'rest', duration: 15 },
            { id: 'g1s3', name: 'Combo Work', type: 'active', segmentType: 'combo', duration: 150 },
            { id: 'g1s4', name: 'Rest', type: 'rest', segmentType: 'rest', duration: 60 },
          ],
        },
      ],
      cooldown: [
        {
          id: 'c1',
          name: 'Recovery',
          repeats: 1,
          segments: [
            { id: 'c1s1', name: 'Walk It Out', type: 'active', segmentType: 'work', duration: 120 },
            { id: 'c1s2', name: 'Deep Stretch', type: 'active', segmentType: 'work', duration: 180 },
          ],
        },
      ],
    },
    combos: [['jab', 'cross', 'hook', 'uppercut'], ['slip', 'cross', 'hook', 'cross']],
  },
  {
    id: 'trending-4',
    name: 'Cardio Warrior',
    icon: '🔥',
    difficulty: 'intermediate',
    totalDuration: 1500,
    isPreset: true,
    isArchived: false,
    createdAt: new Date(),
    timesCompleted: 0,
    author: 'Alex Rodriguez',
    authorHandle: '@CardioKing',
    rating: 4.6,
    ratingCount: 234,
    downloads: 9800,
    tags: ['Cardio', 'Conditioning', 'Endurance'],
    sections: {
      warmup: [
        {
          id: 'w1',
          name: 'Cardio Start',
          repeats: 1,
          segments: [
            { id: 'w1s1', name: 'Light Jog', type: 'active', segmentType: 'work', duration: 120 },
            { id: 'w1s2', name: 'Dynamic Stretches', type: 'active', segmentType: 'work', duration: 60 },
          ],
        },
      ],
      grind: [
        {
          id: 'g1',
          name: 'Endurance Sets',
          repeats: 5,
          segments: [
            { id: 'g1s1', name: 'Speed Bag', type: 'active', segmentType: 'work', duration: 120 },
            { id: 'g1s2', name: 'Shadow Boxing', type: 'active', segmentType: 'shadowboxing', duration: 90 },
            { id: 'g1s3', name: 'Rest', type: 'rest', segmentType: 'rest', duration: 30 },
          ],
        },
      ],
      cooldown: [
        {
          id: 'c1',
          name: 'Wind Down',
          repeats: 1,
          segments: [
            { id: 'c1s1', name: 'Slow Shadow Box', type: 'active', segmentType: 'shadowboxing', duration: 90 },
          ],
        },
      ],
    },
    combos: [['jab', 'cross'], ['jab', 'jab', 'cross', 'hook']],
  },
  {
    id: 'trending-5',
    name: 'Fighter Foundation',
    icon: '🥊',
    difficulty: 'beginner',
    totalDuration: 1200,
    isPreset: true,
    isArchived: false,
    createdAt: new Date(),
    timesCompleted: 0,
    author: 'Coach Davis',
    authorHandle: '@CoachDavis',
    rating: 4.9,
    ratingCount: 567,
    downloads: 24500,
    tags: ['Beginner', 'Fundamentals', 'Boxing'],
    sections: {
      warmup: [
        {
          id: 'w1',
          name: 'Basics Warmup',
          repeats: 1,
          segments: [
            { id: 'w1s1', name: 'Light Movement', type: 'active', segmentType: 'work', duration: 90 },
            { id: 'w1s2', name: 'Stance Practice', type: 'active', segmentType: 'work', duration: 60 },
          ],
        },
      ],
      grind: [
        {
          id: 'g1',
          name: 'Fundamental Drills',
          repeats: 4,
          segments: [
            { id: 'g1s1', name: 'Basic Punches', type: 'active', segmentType: 'combo', duration: 150 },
            { id: 'g1s2', name: 'Footwork', type: 'active', segmentType: 'work', duration: 60 },
            { id: 'g1s3', name: 'Rest', type: 'rest', segmentType: 'rest', duration: 30 },
          ],
        },
      ],
      cooldown: [
        {
          id: 'c1',
          name: 'Cool Down',
          repeats: 1,
          segments: [
            { id: 'c1s1', name: 'Light Shadow Box', type: 'active', segmentType: 'shadowboxing', duration: 90 },
            { id: 'c1s2', name: 'Stretch', type: 'active', segmentType: 'work', duration: 90 },
          ],
        },
      ],
    },
    combos: [['jab'], ['jab', 'cross'], ['jab', 'jab']],
  },
  {
    id: 'trending-6',
    name: 'Speed Demon',
    icon: '⚡',
    difficulty: 'advanced',
    totalDuration: 1800,
    isPreset: true,
    isArchived: false,
    createdAt: new Date(),
    timesCompleted: 0,
    author: 'Flash Martinez',
    authorHandle: '@SpeedKills',
    rating: 4.5,
    ratingCount: 123,
    downloads: 4200,
    tags: ['Speed', 'Advanced', 'Conditioning'],
    sections: {
      warmup: [
        {
          id: 'w1',
          name: 'Speed Prep',
          repeats: 1,
          segments: [
            { id: 'w1s1', name: 'Fast Feet', type: 'active', segmentType: 'work', duration: 60 },
            { id: 'w1s2', name: 'Quick Punches', type: 'active', segmentType: 'work', duration: 90 },
          ],
        },
      ],
      grind: [
        {
          id: 'g1',
          name: 'Speed Rounds',
          repeats: 6,
          segments: [
            { id: 'g1s1', name: 'Speed Bag Blast', type: 'active', segmentType: 'work', duration: 60 },
            { id: 'g1s2', name: 'Rapid Combos', type: 'active', segmentType: 'combo', duration: 120 },
            { id: 'g1s3', name: 'Rest', type: 'rest', segmentType: 'rest', duration: 45 },
          ],
        },
      ],
      cooldown: [
        {
          id: 'c1',
          name: 'Slow Down',
          repeats: 1,
          segments: [
            { id: 'c1s1', name: 'Controlled Shadow', type: 'active', segmentType: 'shadowboxing', duration: 120 },
            { id: 'c1s2', name: 'Stretch', type: 'active', segmentType: 'work', duration: 135 },
          ],
        },
      ],
    },
    combos: [['jab', 'jab', 'cross'], ['slip', 'cross', 'hook', 'cross', 'hook']],
  },
];

export const WORKOUT_CATEGORIES = ['All', 'Boxing', 'HIIT', 'Conditioning', 'Beginner', 'Advanced', 'Cardio'] as const;
export type WorkoutCategory = typeof WORKOUT_CATEGORIES[number];
