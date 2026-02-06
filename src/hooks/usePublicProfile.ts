import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Prestige, getLevelFromXP } from '@/lib/xpSystem';

export interface PublicProfile {
  id: string;
  user_id: string;
  name: string;
  handle: string | null;
  bio: string | null;
  avatar_url: string | null;
  total_xp: number;
  current_streak: number;
  workouts_completed: number;
  prestige: Prestige;
  current_level: number;
  total_training_seconds: number;
  created_at: string;
}

/**
 * Fetches a public profile by user_id for viewing other users' profiles
 * Only selects public-safe columns to protect sensitive user data
 */
export function usePublicProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['public-profile', userId],
    queryFn: async (): Promise<PublicProfile | null> => {
      if (!userId) return null;

      // Only select public-safe columns (no preferences, equipment, goals, etc.)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, name, handle, bio, avatar_url, total_xp, current_streak, workouts_completed, prestige, current_level, total_training_seconds, created_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching public profile:', error);
        return null;
      }

      if (!data) return null;

      // Calculate level from XP
      const prestige = (data.prestige || 'rookie') as Prestige;
      const totalXP = data.total_xp || 0;
      const calculatedLevel = getLevelFromXP(prestige, totalXP);

      return {
        id: data.id,
        user_id: data.user_id,
        name: data.name || 'Fighter',
        handle: data.handle,
        bio: data.bio,
        avatar_url: data.avatar_url,
        total_xp: totalXP,
        current_streak: data.current_streak || 0,
        workouts_completed: data.workouts_completed || 0,
        prestige,
        current_level: calculatedLevel,
        total_training_seconds: data.total_training_seconds || 0,
        created_at: data.created_at,
      };
    },
    enabled: !!userId,
    staleTime: 60000, // Cache for 1 minute
  });
}
