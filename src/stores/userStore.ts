import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserProfile } from '@/types';

interface UserStore {
  user: UserProfile | null;
  hasCompletedOnboarding: boolean;
  setUser: (user: UserProfile | null) => void;
  updateUser: (updates: Partial<UserProfile>) => void;
  completeOnboarding: (profile: Partial<UserProfile>) => void;
  addXP: (amount: number) => void;
  incrementStreak: () => void;
  resetStreak: () => void;
}

const defaultPreferences = {
  voiceType: 'system' as const,
  soundEnabled: true,
  hapticEnabled: true,
  voiceAnnouncements: true,
};

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      user: null,
      hasCompletedOnboarding: false,

      setUser: (user) => set({ user }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      completeOnboarding: (profile) =>
        set({
          hasCompletedOnboarding: true,
          user: {
            id: crypto.randomUUID(),
            createdAt: new Date(),
            onboardingComplete: true,
            role: profile.role || 'fighter',
            name: profile.name || 'Fighter',
            isActive: true,
            isInWorkout: false,
            lastActiveAt: new Date(),
            totalXP: 0,
            currentStreak: 0,
            longestStreak: 0,
            workoutsCompleted: 0,
            prestige: profile.prestige || 'beginner',
            currentLevel: profile.currentLevel || 1,
            preferences: { ...defaultPreferences, ...profile.preferences },
            experienceLevel: profile.experienceLevel,
            equipment: profile.equipment,
            goals: profile.goals,
          } as UserProfile,
        }),

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
