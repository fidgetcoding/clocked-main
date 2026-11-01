import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CompletedWorkout } from '@/types';
import type { WorkoutHistoryEntry } from '@/hooks/useWorkoutHistory';
import { GUEST_USER_ID } from '@/lib/guest';
import { withoutDetail } from '@/lib/punch/sessionLog';

// Browser storage is small, so only the newest guest sessions keep their punch-by-punch detail
const GUEST_LOGS_WITH_DETAIL = 20;
const trimGuestLogs = (rows: WorkoutHistoryEntry[]) =>
  rows.map((row, i) => (i >= GUEST_LOGS_WITH_DETAIL && row.punch_log ? { ...row, punch_log: withoutDetail(row.punch_log) } : row));

interface HistoryStore {
  completedWorkouts: CompletedWorkout[];
  addCompletedWorkout: (workout: CompletedWorkout) => void;
  updateCompletedWorkout: (id: string, updates: Partial<CompletedWorkout>) => void;
  deleteCompletedWorkout: (id: string) => void;
  // Guest rows keep the database row shape so useWorkoutHistory returns the same thing either way
  guestHistory: WorkoutHistoryEntry[];
  addGuestEntry: (entry: Omit<WorkoutHistoryEntry, 'id' | 'user_id' | 'created_at'>) => WorkoutHistoryEntry;
  updateGuestEntry: (id: string, updates: Partial<WorkoutHistoryEntry>) => WorkoutHistoryEntry;
  deleteGuestEntry: (id: string) => void;
}

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set, get) => ({
      completedWorkouts: [],
      guestHistory: [],

      addGuestEntry: (entry) => {
        const row: WorkoutHistoryEntry = {
          ...entry,
          id: crypto.randomUUID(),
          user_id: GUEST_USER_ID,
          created_at: new Date().toISOString(),
        };
        set((state) => ({ guestHistory: trimGuestLogs([row, ...state.guestHistory]) }));
        return row;
      },

      updateGuestEntry: (id, updates) => {
        const existing = get().guestHistory.find((e) => e.id === id);
        if (!existing) throw new Error('Entry not found');
        const row: WorkoutHistoryEntry = { ...existing, ...updates };
        set((state) => ({
          guestHistory: state.guestHistory.map((e) => (e.id === id ? row : e)),
        }));
        return row;
      },

      deleteGuestEntry: (id) =>
        set((state) => ({
          guestHistory: state.guestHistory.filter((e) => e.id !== id),
        })),

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
