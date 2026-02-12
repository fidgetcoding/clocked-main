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
  role: string;
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
 * Uses a SECURITY DEFINER function that only exposes safe public fields
 */
export function usePublicProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['public-profile', userId],
    queryFn: async (): Promise<PublicProfile | null> => {
      if (!userId) return null;

      // Use the secure function that only returns public fields
      const { data, error } = await supabase.rpc('get_public_profile', {
        target_user_id: userId
      });

      if (error) {
        console.error('Error fetching public profile:', error);
        return null;
      }

      if (!data || data.length === 0) return null;

      const profile = data[0];

      // Calculate level from XP
      const prestige = (profile.prestige || 'rookie') as Prestige;
      const totalXP = profile.total_xp || 0;
      const calculatedLevel = getLevelFromXP(prestige, totalXP);

      return {
        id: profile.id,
        user_id: profile.user_id,
        name: profile.name || 'Fighter',
        handle: profile.handle,
        bio: profile.bio,
        avatar_url: profile.avatar_url,
        role: profile.role || 'fighter',
        total_xp: totalXP,
        current_streak: profile.current_streak || 0,
        workouts_completed: profile.workouts_completed || 0,
        prestige,
        current_level: calculatedLevel,
        total_training_seconds: profile.total_training_seconds || 0,
        created_at: profile.created_at,
      };
    },
    enabled: !!userId,
    staleTime: 60000, // Cache for 1 minute
  });
}
