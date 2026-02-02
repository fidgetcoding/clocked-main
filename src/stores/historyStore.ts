import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CompletedWorkout } from '@/types';

interface HistoryStore {
  completedWorkouts: CompletedWorkout[];
  addCompletedWorkout: (workout: CompletedWorkout) => void;
  updateCompletedWorkout: (id: string, updates: Partial<CompletedWorkout>) => void;
  deleteCompletedWorkout: (id: string) => void;
}

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set) => ({
      completedWorkouts: [],

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
