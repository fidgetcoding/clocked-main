import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserProfile } from '@/types';
import { getLevelFromXP, Prestige } from '@/lib/xpSystem';
import { playSoundEffect } from '@/hooks/useSoundEffects';

interface UserStore {
  user: UserProfile | null;
  hasCompletedOnboarding: boolean;
  setUser: (user: UserProfile | null) => void;
  updateUser: (updates: Partial<UserProfile>) => void;
  completeOnboarding: (profile: Partial<UserProfile>) => void;
  addXP: (amount: number, playSound?: boolean) => void;
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

      addXP: (amount, playSound = false) =>
        set((state) => {
          if (!state.user) return state;
          
          const newTotalXP = state.user.totalXP + amount;
          const prestige = (state.user.prestige || 'beginner') as Prestige;
          const currentLevel = state.user.currentLevel || 1;
          const newLevel = getLevelFromXP(prestige, newTotalXP);
          
          // Check for level up
          if (newLevel > currentLevel) {
            // Play level up sound
            playSoundEffect.levelUp();
          } else if (playSound) {
            // Play subtle XP sound
            playSoundEffect.xp();
          }
          
          return {
            user: {
              ...state.user,
              totalXP: newTotalXP,
              currentLevel: newLevel,
            },
          };
        }),

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
