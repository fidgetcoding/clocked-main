import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useUserStore } from '@/stores/userStore';
import { ALL_BADGES, checkBadges, sumBadgeXP, getBadgeProgress, Badge, BadgeStats, BadgeCategory, BADGE_CATEGORY_COLORS, BADGE_CATEGORY_NAMES } from '@/data/badges';
import { ALL_POST_L100_BADGES, PostL100Badge, PostL100Category, PostL100Stats, POST_L100_CATEGORY_COLORS, POST_L100_CATEGORY_NAMES, POST_L100_BADGE_CATEGORIES, checkPostL100Badges, getPostL100BadgeProgress } from '@/data/postL100Badges';

export interface EarnedBadge {
  id: string;
  badge_id: string;
  earned_at: string;
  xp_rewarded: number;
}

export function useBadges() {
  const { user, isGuest } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const guestBadges = useUserStore((state) => state.guestBadges);

  // Fetch earned badges from DB
  const { data: dbBadges = [], isLoading } = useQuery({
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

  const earnedBadges = isGuest ? guestBadges : dbBadges;
  const earnedBadgeIds = earnedBadges.map(b => b.badge_id);

  // Build current stats from profile
  const currentStats: BadgeStats = {
    consecutiveDays: profile?.current_streak || 0,
    totalCombos: profile?.combos_landed || 0,
    complexCombos: (profile)?.complex_combos || 0,
    defenseCombos: (profile)?.defense_combos || 0,
    counterCombos: (profile)?.counter_combos || 0,
    totalSessions: profile?.workouts_completed || 0,
    totalHours: (profile?.total_training_seconds || 0) / 3600,
    singleSessionMinutes: 0, // Set per-session
    totalPushups: (profile)?.total_pushups || 0,
    totalBurpees: (profile)?.total_burpees || 0,
    totalCurlups: (profile)?.total_curlups || 0,
    totalJogRunMinutes: (profile)?.total_jog_run_minutes || 0,
  };

  // Build post-L100 stats from profile
  const postL100Stats: PostL100Stats = {
    ...currentStats,
    postL100Sessions: profile?.post_l100_sessions || 0,
    overflowXp: profile?.overflow_xp || 0,
    tiersCompleted: profile?.tiers_completed || 0,
    totalLevelsEarned: profile?.total_levels_earned || 0,
    rookieSessionsToL100: profile?.rookie_sessions_to_l100 || 0,
    beginnerSessionsToL100: profile?.beginner_sessions_to_l100 || 0,
    intermediateSessionsToL100: profile?.intermediate_sessions_to_l100 || 0,
    advancedSessionsToL100: profile?.advanced_sessions_to_l100 || 0,
    proSessionsToL100: profile?.pro_sessions_to_l100 || 0,
    doubleDays: (profile)?.double_days || 0,
    morningWorkouts: (profile)?.morning_workouts || 0,
    nightWorkouts: (profile)?.night_workouts || 0,
    weekendWorkouts: (profile)?.weekend_workouts || 0,
    weekdayWorkouts: (profile)?.weekday_workouts || 0,
    perfectMonths: profile?.perfect_months || 0,
    comebackCount: (profile)?.comeback_count || 0,
    mondayWorkouts: profile?.monday_workouts || 0,
    fridayWorkouts: profile?.friday_workouts || 0,
    sundayWorkouts: profile?.sunday_workouts || 0,
    accountAgeDays: profile?.created_at ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000) : 0,
    newYearsWorkout: profile?.new_years_workout ? 1 : 0,
    birthdayWorkout: profile?.birthday_workout ? 1 : 0,
    holidayWorkouts: profile?.holiday_workouts || 0,
    singleSessionXp: profile?.best_session_xp || 0,
    totalBadges: earnedBadges.length,
    streakRecoveries: profile?.streak_recoveries || 0,
    avgXpPerSession: profile?.workouts_completed ? Math.round((profile?.total_xp || 0) / profile.workouts_completed) : 0,
    punch1Count: (profile)?.punch_1_count || 0,
    punch2Count: (profile)?.punch_2_count || 0,
    punch3Count: (profile)?.punch_3_count || 0,
    punch4Count: (profile)?.punch_4_count || 0,
    punch5Count: (profile)?.punch_5_count || 0,
    punch6Count: (profile)?.punch_6_count || 0,
    punch7Count: (profile)?.punch_7_count || 0,
    punch8Count: (profile)?.punch_8_count || 0,
    slipsCount: (profile)?.slips_count || 0,
    rollsCount: (profile)?.rolls_count || 0,
    pullbacksCount: (profile)?.pullbacks_count || 0,
    circlesCount: (profile)?.circles_count || 0,
  };

  // Award badges mutation
  const awardBadges = useMutation({
    mutationFn: async (badges: (Badge | PostL100Badge)[]) => {
      if (isGuest) {
        useUserStore.getState().addGuestBadges(badges.map(b => ({ badge_id: b.id, xp_rewarded: b.xpReward })));
        return [];
      }
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

  // Check for new post-L100 badges
  const checkForNewPostL100Badges = (statsOverride?: Partial<PostL100Stats>): PostL100Badge[] => {
    const stats = { ...postL100Stats, ...statsOverride };
    return checkPostL100Badges(stats, earnedBadgeIds);
  };

  // Combined badge count
  const allBadgesTotal = ALL_BADGES.length + ALL_POST_L100_BADGES.length;

  // Get all badges organized by category (base + post-L100)
  type AnyBadgeCategory = BadgeCategory | PostL100Category;
  
  const getBadgesByCategory = (): { category: AnyBadgeCategory; badges: ((Badge | PostL100Badge) & { earned: boolean; earnedAt?: string; progress: number })[] }[] => {
    const baseCategories: BadgeCategory[] = ['streak', 'combo', 'volume', 'time', 'conditioning', 'in_workout', 'prestige'];
    
    const baseResults = baseCategories.map(category => ({
      category: category as AnyBadgeCategory,
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

    const postL100Results = POST_L100_BADGE_CATEGORIES.map(({ category, badges }) => ({
      category: category as AnyBadgeCategory,
      badges: badges.map(b => {
        const earned = earnedBadges.find(e => e.badge_id === b.id);
        return {
          ...b,
          earned: !!earned,
          earnedAt: earned?.earned_at,
          progress: earned ? 1 : getPostL100BadgeProgress(b, postL100Stats),
        };
      }),
    }));

    return [...baseResults, ...postL100Results];
  };

  return {
    earnedBadges,
    earnedBadgeIds,
    isLoading,
    currentStats,
    postL100Stats,
    checkForNewBadges,
    checkForNewPostL100Badges,
    awardBadges,
    getBadgesByCategory,
    totalBadgeCount: allBadgesTotal,
    earnedCount: earnedBadges.length,
  };
}
