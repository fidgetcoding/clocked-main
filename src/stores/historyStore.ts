import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CompletedWorkout } from '@/types';

interface HistoryStore {
  completedWorkouts: CompletedWorkout[];
  addCompletedWorkout: (workout: CompletedWorkout) => void;
  updateCompletedWorkout: (id: string, updates: Partial<CompletedWorkout>) => void;
  deleteCompletedWorkout: (id: string) => void;
}

// Mock data for demo
const mockWorkouts: CompletedWorkout[] = [
  {
    id: 'mock-1',
    workoutId: undefined,
    workoutName: 'Morning Heavy Bag Session',
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // Yesterday
    duration: 1800, // 30 min
    xpEarned: 300,
    difficulty: 'just_right',
    notes: 'Felt strong today. Focus was on power shots and body work. Need to keep my hands up after throwing hooks. Good sweat, legs felt fresh.',
    isManualEntry: false,
    roundFeedback: [
      { roundNumber: 1, rating: 4, notes: 'Good warmup' },
      { roundNumber: 2, rating: 5, notes: 'Strong combos' },
      { roundNumber: 3, rating: 4, notes: 'Started feeling it' },
      { roundNumber: 4, rating: 3, notes: 'Cardio dropped' },
      { roundNumber: 5, rating: 4, notes: 'Pushed through' },
      { roundNumber: 6, rating: 5, notes: 'Strong finish' },
    ],
  },
  {
    id: 'mock-2',
    workoutId: undefined,
    workoutName: 'Shadow Boxing Flow',
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
    duration: 1200, // 20 min
    xpEarned: 200,
    difficulty: 'too_easy',
    notes: 'Quick session before work. Worked on footwork and head movement. Should increase intensity next time.',
    isManualEntry: false,
  },
  {
    id: 'mock-3',
    workoutId: undefined,
    workoutName: 'Conditioning Circuit',
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 72), // 3 days ago
    duration: 2700, // 45 min
    xpEarned: 450,
    difficulty: 'too_hard',
    notes: 'Brutal session. Legs were burning by round 4. Made it through but need to work on conditioning more. Hip escapes need work.',
    isManualEntry: true,
  },
];

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set) => ({
      completedWorkouts: mockWorkouts,

      addCompletedWorkout: (workout) =>
        set((state) => ({
          completedWorkouts: [workout, ...state.completedWorkouts],
        })),

      updateCompletedWorkout: (id, updates) =>
        set((state) => ({
          completedWorkouts: state.completedWorkouts.map((w) =>
            w.id === id ? { ...w, ...updates } : w
          ),
        })),

      deleteCompletedWorkout: (id) =>
        set((state) => ({
          completedWorkouts: state.completedWorkouts.filter((w) => w.id !== id),
        })),
    }),
    {
      name: 'get-clocked-history',
    }
  )
);
