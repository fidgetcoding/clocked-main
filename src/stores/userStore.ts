import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserProfile } from '@/types';

interface UserStore {
  user: UserProfile | null;
  isOnboarding: boolean;
  setUser: (user: UserProfile | null) => void;
  updateUser: (updates: Partial<UserProfile>) => void;
  setOnboarding: (isOnboarding: boolean) => void;
  completeOnboarding: () => void;
  addXP: (amount: number) => void;
  incrementStreak: () => void;
  resetStreak: () => void;
}

const defaultPreferences = {
  voiceType: 'system' as const,
  soundEnabled: true,
  hapticEnabled: true,
};

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      user: null,
      isOnboarding: true,

      setUser: (user) => set({ user }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      setOnboarding: (isOnboarding) => set({ isOnboarding }),

      completeOnboarding: () =>
        set((state) => ({
          isOnboarding: false,
          user: state.user
            ? { ...state.user, onboardingComplete: true }
            : null,
        })),

      addXP: (amount) =>
        set((state) => ({
          user: state.user
            ? { ...state.user, totalXP: state.user.totalXP + amount }
            : null,
        })),

      incrementStreak: () =>
        set((state) => {
          if (!state.user) return state;
          const newStreak = state.user.currentStreak + 1;
          return {
            user: {
              ...state.user,
              currentStreak: newStreak,
              longestStreak: Math.max(newStreak, state.user.longestStreak),
            },
          };
        }),

      resetStreak: () =>
        set((state) => ({
          user: state.user ? { ...state.user, currentStreak: 0 } : null,
        })),
    }),
    {
      name: 'get-clocked-user',
    }
  )
);

// Helper to create a new user
export function createNewUser(
  role: 'fighter' | 'coach',
  name: string = 'Fighter'
): UserProfile {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date(),
    onboardingComplete: false,
    role,
    name,
    isActive: true,
    isInWorkout: false,
    lastActiveAt: new Date(),
    totalXP: 0,
    currentStreak: 0,
    longestStreak: 0,
    workoutsCompleted: 0,
    preferences: defaultPreferences,
  };
}
