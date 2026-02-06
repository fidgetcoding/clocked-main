import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Prestige, Ranking, getRankingFromLevel, experienceLevelToPrestige, getLevelFromXP } from '@/lib/xpSystem';

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  handle: string | null;
  bio: string | null;
  role: 'fighter' | 'coach';
  avatar_url: string | null;
  experience_level: string | null;
  equipment: Record<string, boolean>;
  goals: string[];
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  workouts_completed: number;
  preferences: {
    voiceType: string;
    soundEnabled: boolean;
    voiceAnnouncements: boolean;
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

export function useProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading, error } = useQuery({
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
        } as Profile;
      }
      return null;
    },
    enabled: !!user?.id,
  });

  const updateProfile = useMutation({
    mutationFn: async (updates: Partial<Omit<Profile, 'id' | 'user_id' | 'created_at'>>) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('profiles')
        .update(updates as any)
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
