import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserProfile } from '@/types';
import { getLevelFromXP, Prestige } from '@/lib/xpSystem';
import { playSoundEffect } from '@/hooks/useSoundEffects';
import type { Profile } from '@/hooks/useProfile';
import type { EarnedBadge } from '@/hooks/useBadges';

interface UserStore {
  user: UserProfile | null;
  hasCompletedOnboarding: boolean;
  setUser: (user: UserProfile | null) => void;
  updateUser: (updates: Partial<UserProfile>) => void;
  completeOnboarding: (profile: Partial<UserProfile>) => void;
  addXP: (amount: number, playSound?: boolean) => void;
  incrementStreak: () => void;
  resetStreak: () => void;
  // Guest state. `user` and `hasCompletedOnboarding` belong to whoever is active right now;
  // while an account is signed in, the guest's copy of them waits in stashedGuest.
  userIsGuest: boolean;
  stashedGuest: { user: UserProfile | null; hasCompletedOnboarding: boolean } | null;
  guestProfile: Partial<Profile> | null;
  guestBadges: EarnedBadge[];
  enterGuest: () => void;
  enterAccount: () => void;
  clearAccount: () => void;
  updateGuestProfile: (updates: Partial<Profile>) => void;
  addGuestBadges: (badges: Pick<EarnedBadge, 'badge_id' | 'xp_rewarded'>[]) => void;
}

const defaultPreferences = {
  voiceType: 'system' as const,
  soundEnabled: true,
  voiceAnnouncements: true,
};

const buildLocalUser = (profile: Partial<UserProfile>) =>
  ({
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
  }) as UserProfile;

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      user: null,
      hasCompletedOnboarding: false,
      userIsGuest: false,
      stashedGuest: null,
      guestProfile: null,
      guestBadges: [],

      // No session: become the guest again, picking up where they left off
      enterGuest: () =>
        set((state) => {
          if (state.userIsGuest) return state;
          return {
            userIsGuest: true,
            user: state.stashedGuest?.user ?? buildLocalUser({}),
            hasCompletedOnboarding: state.stashedGuest?.hasCompletedOnboarding ?? false,
            stashedGuest: null,
          };
        }),

      // Session arrived: set the guest aside so account data never mixes with it
      enterAccount: () =>
        set((state) => {
          if (!state.userIsGuest) return state;
          return {
            userIsGuest: false,
            stashedGuest: { user: state.user, hasCompletedOnboarding: state.hasCompletedOnboarding },
            user: null,
            hasCompletedOnboarding: false,
          };
        }),

      clearAccount: () =>
        set((state) => (state.userIsGuest ? state : { user: null, hasCompletedOnboarding: false })),

      updateGuestProfile: (updates) =>
        set((state) => ({
          guestProfile: {
            created_at: new Date().toISOString(),
            ...state.guestProfile,
            ...updates,
            updated_at: new Date().toISOString(),
          },
        })),

      addGuestBadges: (badges) =>
        set((state) => {
          const owned = new Set(state.guestBadges.map((b) => b.badge_id));
          const earned_at = new Date().toISOString();
          return {
            guestBadges: [
              ...state.guestBadges,
              ...badges
                .filter((b) => !owned.has(b.badge_id))
                .map((b) => ({ ...b, id: crypto.randomUUID(), earned_at })),
            ],
          };
        }),

      setUser: (user) => set({ user }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      completeOnboarding: (profile) =>
        set({
          hasCompletedOnboarding: true,
          user: buildLocalUser(profile),
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
