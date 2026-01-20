import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Workout } from '@/types';
import { BEGINNER_PRESET_WORKOUTS, INTERMEDIATE_PRESET_WORKOUTS, ADVANCED_PRESET_WORKOUTS } from '@/data/presetWorkouts';

interface WorkoutStore {
  workouts: Workout[];
  archivedWorkouts: Workout[];
  addWorkout: (workout: Workout) => void;
  updateWorkout: (id: string, updates: Partial<Workout>) => void;
  deleteWorkout: (id: string) => void;
  archiveWorkout: (id: string) => void;
  restoreWorkout: (id: string) => void;
  permanentlyDeleteArchived: (id: string) => void;
  loadBeginnerPresets: () => void;
  loadIntermediatePresets: () => void;
  loadAdvancedPresets: () => void;
  markWorkoutUsed: (id: string) => void;
}

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set, get) => ({
      workouts: [],
      archivedWorkouts: [],

      addWorkout: (workout) =>
        set((state) => ({
          workouts: [...state.workouts, workout],
        })),

      updateWorkout: (id, updates) =>
        set((state) => ({
          workouts: state.workouts.map((w) =>
            w.id === id ? { ...w, ...updates } : w
          ),
        })),

      deleteWorkout: (id) =>
        set((state) => ({
          workouts: state.workouts.filter((w) => w.id !== id),
        })),

      archiveWorkout: (id) =>
        set((state) => {
          const workout = state.workouts.find((w) => w.id === id);
          if (!workout) return state;
          return {
            workouts: state.workouts.filter((w) => w.id !== id),
            archivedWorkouts: [
              ...state.archivedWorkouts,
              { ...workout, isArchived: true },
            ],
          };
        }),

      restoreWorkout: (id) =>
        set((state) => {
          const workout = state.archivedWorkouts.find((w) => w.id === id);
          if (!workout) return state;
          return {
            archivedWorkouts: state.archivedWorkouts.filter((w) => w.id !== id),
            workouts: [...state.workouts, { ...workout, isArchived: false }],
          };
        }),

      permanentlyDeleteArchived: (id) =>
        set((state) => ({
          archivedWorkouts: state.archivedWorkouts.filter((w) => w.id !== id),
        })),

      loadBeginnerPresets: () => {
        const { workouts } = get();
        const existingIds = workouts.map((w) => w.id);
        const newPresets = BEGINNER_PRESET_WORKOUTS.filter(
          (p) => !existingIds.includes(p.id)
        );
        if (newPresets.length > 0) {
          set((state) => ({
            workouts: [...newPresets, ...state.workouts],
          }));
        }
      },

      loadIntermediatePresets: () => {
        const { workouts } = get();
        const existingIds = workouts.map((w) => w.id);
        const newPresets = INTERMEDIATE_PRESET_WORKOUTS.filter(
          (p) => !existingIds.includes(p.id)
        );
        if (newPresets.length > 0) {
          set((state) => ({
            workouts: [...newPresets, ...state.workouts],
          }));
        }
      },

      loadAdvancedPresets: () => {
        const { workouts } = get();
        const existingIds = workouts.map((w) => w.id);
        const newPresets = ADVANCED_PRESET_WORKOUTS.filter(
          (p) => !existingIds.includes(p.id)
        );
        if (newPresets.length > 0) {
          set((state) => ({
            workouts: [...newPresets, ...state.workouts],
          }));
        }
      },

      markWorkoutUsed: (id) =>
        set((state) => ({
          workouts: state.workouts.map((w) =>
            w.id === id
              ? {
                  ...w,
                  lastUsed: new Date(),
                  timesCompleted: w.timesCompleted + 1,
                }
              : w
          ),
        })),
    }),
    {
      name: 'get-clocked-workouts',
    }
  )
);
