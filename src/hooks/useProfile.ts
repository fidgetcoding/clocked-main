import type { Database } from '@/integrations/supabase/types';
import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { useUserStore } from '@/stores/userStore';
import { GUEST_USER_ID } from '@/lib/guest';
import type { Stance } from '@/lib/punch/types';
import { Prestige, Ranking, getRankingFromLevel, experienceLevelToPrestige, getLevelFromXP } from '@/lib/xpSystem';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

// Columns only the badge checks read, so they stay optional for guests and older rows
type BadgeProgressColumns = Partial<Pick<ProfileRow,
  | 'post_l100_sessions' | 'overflow_xp' | 'tiers_completed' | 'total_levels_earned'
  | 'rookie_sessions_to_l100' | 'beginner_sessions_to_l100' | 'intermediate_sessions_to_l100'
  | 'advanced_sessions_to_l100' | 'pro_sessions_to_l100' | 'perfect_months'
  | 'monday_workouts' | 'friday_workouts' | 'sunday_workouts'
  | 'new_years_workout' | 'birthday_workout' | 'holiday_workouts'
  | 'best_session_xp' | 'streak_recoveries'
>>;

export interface Profile extends BadgeProgressColumns {
  id: string;
  user_id: string;
  name: string;
  handle: string | null;
  bio: string | null;
  role: 'fighter' | 'coach';
  avatar_url: string | null;
  experience_level: string | null;
  equipment: Record<string, boolean | string>;
  goals: string[];
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  workouts_completed: number;
  preferences: {
    voiceType: string;
    soundEnabled: boolean;
    voiceAnnouncements: boolean;
    stance?: Stance;
  };
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
  // New gamification fields
  prestige: Prestige;
  current_level: number;
  combos_landed: number;
  total_training_seconds: number;
  sessions_completed_this_year: number;
  last_workout_date: string | null;
  streak_multiplier: number;
  weight_kg: number | null;
  height_cm: number | null;
  // Lifetime stats for badge tracking
  total_pushups: number;
  total_burpees: number;
  total_curlups: number;
  total_jog_run_minutes: number;
  complex_combos: number;
  defense_combos: number;
  counter_combos: number;
  // Gloves
  equipped_glove: string;
  unlocked_gloves: string[];
  // Coach-relevant stats
  comeback_count: number;
  double_days: number;
  morning_workouts: number;
  night_workouts: number;
  weekend_workouts: number;
  weekday_workouts: number;
  punch_1_count: number;
  punch_2_count: number;
  punch_3_count: number;
  punch_4_count: number;
  punch_5_count: number;
  punch_6_count: number;
  punch_7_count: number;
  punch_8_count: number;
  slips_count: number;
  rolls_count: number;
  pullbacks_count: number;
  circles_count: number;
}

// Helper to generate handle from name
export function generateHandleFromName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '');
}

// Helper to get ranking from profile
export function getProfileRanking(profile: Profile | null): Ranking {
  if (!profile) return 'prospect';
  return getRankingFromLevel(profile.current_level);
}

// Helper to get prestige from experience level (for new users)
export function getPrestigeFromExperience(experienceLevel: string | null): Prestige {
  return experienceLevelToPrestige(experienceLevel || 'beginner');
}

// A brand-new account's profile is a bare trigger row, while finishing onboarding always
// saves equipment. The XP and session checks catch accounts that predate that step.
export function hasFinishedOnboarding(profile: Profile): boolean {
  return (
    Object.keys(profile.equipment || {}).length > 0 ||
    (profile.total_xp || 0) > 0 ||
    (profile.workouts_completed || 0) > 0
  );
}

// Fills a guest's stored fields out to a full Profile, same defaults as a fresh database row
export function buildGuestProfile(row: Partial<Profile> | null): Profile {
  const now = new Date().toISOString();
  const prestige = (row?.prestige || experienceLevelToPrestige(row?.experience_level || 'beginner')) as Prestige;
  const totalXP = row?.total_xp || 0;

  return {
    name: 'Fighter',
    handle: null,
    bio: null,
    role: 'fighter',
    avatar_url: null,
    experience_level: 'beginner',
    equipment: {},
    goals: [],
    current_streak: 0,
    longest_streak: 0,
    workouts_completed: 0,
    preferences: { voiceType: 'system', soundEnabled: true, voiceAnnouncements: true },
    last_active_at: null,
    created_at: now,
    updated_at: now,
    combos_landed: 0,
    total_training_seconds: 0,
    sessions_completed_this_year: 0,
    last_workout_date: null,
    streak_multiplier: 1.0,
    weight_kg: null,
    height_cm: null,
    total_pushups: 0,
    total_burpees: 0,
    total_curlups: 0,
    total_jog_run_minutes: 0,
    complex_combos: 0,
    defense_combos: 0,
    counter_combos: 0,
    equipped_glove: 'default',
    unlocked_gloves: ['default'],
    comeback_count: 0,
    double_days: 0,
    morning_workouts: 0,
    night_workouts: 0,
    weekend_workouts: 0,
    weekday_workouts: 0,
    punch_1_count: 0,
    punch_2_count: 0,
    punch_3_count: 0,
    punch_4_count: 0,
    punch_5_count: 0,
    punch_6_count: 0,
    punch_7_count: 0,
    punch_8_count: 0,
    slips_count: 0,
    rolls_count: 0,
    pullbacks_count: 0,
    circles_count: 0,
    ...row,
    id: GUEST_USER_ID,
    user_id: GUEST_USER_ID,
    prestige,
    total_xp: totalXP,
    current_level: getLevelFromXP(prestige, totalXP),
  };
}

// Writes to the browser and hands back the updated profile, like the database branch does
function updateGuest(updates: Partial<Profile>): Profile {
  const store = useUserStore.getState();
  store.updateGuestProfile(updates);
  return buildGuestProfile(useUserStore.getState().guestProfile);
}

export function useProfile() {
  const { user, isGuest } = useAuth();
  const queryClient = useQueryClient();
  const guestRow = useUserStore((state) => state.guestProfile);
  const guestProfile = useMemo(() => buildGuestProfile(guestRow), [guestRow]);

  const { data: dbProfile, isLoading, error } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      
      // Transform the data to match our Profile interface
      if (data) {
        const prestige = (data.prestige || experienceLevelToPrestige(data.experience_level || 'beginner')) as Prestige;
        const totalXP = data.total_xp || 0;
        // Calculate level dynamically from XP - this is the source of truth
        const calculatedLevel = getLevelFromXP(prestige, totalXP);
        
        return {
          ...data,
          equipment: (data.equipment || {}) as Record<string, boolean>,
          goals: data.goals || [],
        preferences: (data.preferences || {
            voiceType: 'system',
            soundEnabled: true,
            voiceAnnouncements: true,
          }) as Profile['preferences'],
          prestige,
          current_level: calculatedLevel, // Use calculated level, not stored
          combos_landed: data.combos_landed || 0,
          total_training_seconds: data.total_training_seconds || 0,
          sessions_completed_this_year: data.sessions_completed_this_year || 0,
          streak_multiplier: Number(data.streak_multiplier) || 1.0,
          weight_kg: data.weight_kg ? Number(data.weight_kg) : null,
          height_cm: data.height_cm ? Number(data.height_cm) : null,
          total_pushups: data.total_pushups || 0,
          total_burpees: data.total_burpees || 0,
          total_curlups: data.total_curlups || 0,
          total_jog_run_minutes: data.total_jog_run_minutes || 0,
          complex_combos: data.complex_combos || 0,
          defense_combos: data.defense_combos || 0,
          counter_combos: data.counter_combos || 0,
          equipped_glove: data.equipped_glove || 'default',
          unlocked_gloves: data.unlocked_gloves || ['default'],
          comeback_count: data.comeback_count || 0,
          double_days: data.double_days || 0,
          morning_workouts: data.morning_workouts || 0,
          night_workouts: data.night_workouts || 0,
          weekend_workouts: data.weekend_workouts || 0,
          weekday_workouts: data.weekday_workouts || 0,
          punch_1_count: data.punch_1_count || 0,
          punch_2_count: data.punch_2_count || 0,
          punch_3_count: data.punch_3_count || 0,
          punch_4_count: data.punch_4_count || 0,
          punch_5_count: data.punch_5_count || 0,
          punch_6_count: data.punch_6_count || 0,
          punch_7_count: data.punch_7_count || 0,
          punch_8_count: data.punch_8_count || 0,
          slips_count: data.slips_count || 0,
          rolls_count: data.rolls_count || 0,
          pullbacks_count: data.pullbacks_count || 0,
          circles_count: data.circles_count || 0,
        } as Profile;
      }
      return null;
    },
    enabled: !!user?.id,
  });

  const profile = isGuest ? guestProfile : dbProfile;

  const updateProfile = useMutation({
    mutationFn: async (updates: Partial<Omit<Profile, 'id' | 'user_id' | 'created_at'>>) => {
      if (isGuest) return updateGuest(updates);
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data as unknown as Profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    },
  });

  const addXP = useMutation({
    mutationFn: async (amount: number) => {
      if (isGuest) {
        return updateGuest({ total_xp: (useUserStore.getState().guestProfile?.total_xp || 0) + amount });
      }
      if (!user?.id || !profile) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('profiles')
        .update({ total_xp: profile.total_xp + amount })
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data as unknown as Profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    },
  });

  const incrementStreak = useMutation({
    mutationFn: async () => {
      if (isGuest) {
        const newStreak = guestProfile.current_streak + 1;
        return updateGuest({
          current_streak: newStreak,
          longest_streak: Math.max(newStreak, guestProfile.longest_streak),
        });
      }
      if (!user?.id || !profile) throw new Error('Not authenticated');
      
      const newStreak = profile.current_streak + 1;
      const { data, error } = await supabase
        .from('profiles')
        .update({ 
          current_streak: newStreak,
          longest_streak: Math.max(newStreak, profile.longest_streak),
        })
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data as unknown as Profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    },
  });

  // Update prestige based on experience level (for onboarding)
  const setInitialPrestige = useMutation({
    mutationFn: async (experienceLevel: string) => {
      if (isGuest) {
        return updateGuest({
          prestige: experienceLevelToPrestige(experienceLevel),
          current_level: 1,
          experience_level: experienceLevel,
        });
      }
      if (!user?.id) throw new Error('Not authenticated');
      
      const prestige = experienceLevelToPrestige(experienceLevel);
      
      const { data, error } = await supabase
        .from('profiles')
        .update({ 
          prestige,
          current_level: 1,
          experience_level: experienceLevel,
        })
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data as unknown as Profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    },
  });

  return {
    profile,
    isLoading,
    error,
    updateProfile,
    addXP,
    incrementStreak,
    setInitialPrestige,
    getProfileRanking: () => getProfileRanking(profile),
  };
}
