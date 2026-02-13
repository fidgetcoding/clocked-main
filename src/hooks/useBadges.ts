import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { ALL_BADGES, checkBadges, sumBadgeXP, getBadgeProgress, Badge, BadgeStats, BadgeCategory } from '@/data/badges';

export interface EarnedBadge {
  id: string;
  badge_id: string;
  earned_at: string;
  xp_rewarded: number;
}

export function useBadges() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();

  // Fetch earned badges from DB
  const { data: earnedBadges = [], isLoading } = useQuery({
    queryKey: ['badges', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('badges')
        .select('*')
        .eq('user_id', user.id);
      if (error) throw error;
      return (data || []) as EarnedBadge[];
    },
    enabled: !!user?.id,
  });

  const earnedBadgeIds = earnedBadges.map(b => b.badge_id);

  // Build current stats from profile
  const currentStats: BadgeStats = {
    consecutiveDays: profile?.current_streak || 0,
    totalCombos: profile?.combos_landed || 0,
    complexCombos: (profile as any)?.complex_combos || 0,
    defenseCombos: (profile as any)?.defense_combos || 0,
    counterCombos: (profile as any)?.counter_combos || 0,
    totalSessions: profile?.workouts_completed || 0,
    totalHours: (profile?.total_training_seconds || 0) / 3600,
    singleSessionMinutes: 0, // Set per-session
    totalPushups: (profile as any)?.total_pushups || 0,
    totalBurpees: (profile as any)?.total_burpees || 0,
    totalCurlups: (profile as any)?.total_curlups || 0,
    totalJogRunMinutes: (profile as any)?.total_jog_run_minutes || 0,
  };

  // Award badges mutation
  const awardBadges = useMutation({
    mutationFn: async (badges: Badge[]) => {
      if (!user?.id || badges.length === 0) return [];
      
      const rows = badges.map(b => ({
        user_id: user.id,
        badge_id: b.id,
        xp_rewarded: b.xpReward,
      }));
      
      const { data, error } = await supabase
        .from('badges')
        .insert(rows)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['badges', user?.id] });
    },
  });

  // Check for new badges based on updated stats
  const checkForNewBadges = (statsOverride?: Partial<BadgeStats>): Badge[] => {
    const stats = { ...currentStats, ...statsOverride };
    return checkBadges(stats, earnedBadgeIds);
  };

  // Get all badges organized by category
  const getBadgesByCategory = (): { category: BadgeCategory; badges: (Badge & { earned: boolean; earnedAt?: string; progress: number })[] }[] => {
    const categories: BadgeCategory[] = ['streak', 'combo', 'volume', 'time', 'conditioning', 'in_workout', 'prestige'];
    
    return categories.map(category => ({
      category,
      badges: ALL_BADGES
        .filter(b => b.category === category)
        .map(b => {
          const earned = earnedBadges.find(e => e.badge_id === b.id);
          return {
            ...b,
            earned: !!earned,
            earnedAt: earned?.earned_at,
            progress: earned ? 1 : getBadgeProgress(b, currentStats),
          };
        }),
    }));
  };

  return {
    earnedBadges,
    earnedBadgeIds,
    isLoading,
    currentStats,
    checkForNewBadges,
    awardBadges,
    getBadgesByCategory,
    totalBadgeCount: ALL_BADGES.length,
    earnedCount: earnedBadges.length,
  };
}
