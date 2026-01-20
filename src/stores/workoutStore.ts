import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Workout } from '@/types';
import { BEGINNER_PRESET_WORKOUTS, INTERMEDIATE_PRESET_WORKOUTS, ADVANCED_PRESET_WORKOUTS, PRO_PRESET_WORKOUTS, COACH_PRESET_WORKOUTS } from '@/data/presetWorkouts';

interface WorkoutStore {
  workouts: Workout[];
  archivedWorkouts: Workout[];
  presetsLoaded: boolean;
  addWorkout: (workout: Workout) => void;
  updateWorkout: (id: string, updates: Partial<Workout>) => void;
  deleteWorkout: (id: string) => void;
  archiveWorkout: (id: string) => void;
  restoreWorkout: (id: string) => void;
  permanentlyDeleteArchived: (id: string) => void;
  loadBeginnerPresets: () => void;
  loadIntermediatePresets: () => void;
  loadAdvancedPresets: () => void;
  loadProPresets: () => void;
  loadCoachPresets: () => void;
  clearPresets: () => void;
  markWorkoutUsed: (id: string) => void;
}

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set, get) => ({
      workouts: [],
      archivedWorkouts: [],
      presetsLoaded: false,

      addWorkout: (workout) =>
        set((state) => ({
          // Add new workouts to the beginning of the list
          workouts: [workout, ...state.workouts],
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

      clearPresets: () =>
        set((state) => ({
          workouts: state.workouts.filter((w) => !w.isPreset),
          presetsLoaded: false,
        })),

      loadBeginnerPresets: () => {
        const { workouts, presetsLoaded } = get();
        // Clear existing presets first if switching levels
        const nonPresetWorkouts = workouts.filter((w) => !w.isPreset);
        set({
          workouts: [...BEGINNER_PRESET_WORKOUTS, ...nonPresetWorkouts],
          presetsLoaded: true,
        });
      },

      loadIntermediatePresets: () => {
        const { workouts } = get();
        const nonPresetWorkouts = workouts.filter((w) => !w.isPreset);
        set({
          workouts: [...INTERMEDIATE_PRESET_WORKOUTS, ...nonPresetWorkouts],
          presetsLoaded: true,
        });
      },

      loadAdvancedPresets: () => {
        const { workouts } = get();
        const nonPresetWorkouts = workouts.filter((w) => !w.isPreset);
        set({
          workouts: [...ADVANCED_PRESET_WORKOUTS, ...nonPresetWorkouts],
          presetsLoaded: true,
        });
      },

      loadProPresets: () => {
        const { workouts } = get();
        const nonPresetWorkouts = workouts.filter((w) => !w.isPreset);
        set({
          workouts: [...PRO_PRESET_WORKOUTS, ...nonPresetWorkouts],
          presetsLoaded: true,
        });
      },

      loadCoachPresets: () => {
        const { workouts } = get();
        const nonPresetWorkouts = workouts.filter((w) => !w.isPreset);
        set({
          workouts: [...COACH_PRESET_WORKOUTS, ...nonPresetWorkouts],
          presetsLoaded: true,
        });
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
