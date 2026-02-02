// =====================================================
// Get Clocked Badge Definitions
// =====================================================

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'milestone' | 'streak' | 'volume' | 'special';
  xpReward: number;
  requirement: {
    type: 'workouts_completed' | 'streak_days' | 'prestige_complete' | 'first_workout' | 'combos_landed' | 'training_hours';
    value: number | string;
  };
}

// =====================================================
// Milestone Badges
// =====================================================

export const MILESTONE_BADGES: Badge[] = [
  {
    id: 'first_blood',
    name: 'First Blood',
    description: 'Complete your first workout',
    icon: '🥊',
    category: 'milestone',
    xpReward: 50,
    requirement: { type: 'first_workout', value: 1 },
  },
  {
    id: 'rookie_complete',
    name: 'Rookie of the Year',
    description: 'Complete Rookie prestige (Level 100)',
    icon: '🌟',
    category: 'milestone',
    xpReward: 500,
    requirement: { type: 'prestige_complete', value: 'rookie' },
  },
  {
    id: 'beginner_complete',
    name: 'Class Act',
    description: 'Complete Beginner prestige (Level 100)',
    icon: '🏅',
    category: 'milestone',
    xpReward: 1500,
    requirement: { type: 'prestige_complete', value: 'beginner' },
  },
  {
    id: 'intermediate_complete',
    name: 'Rising Star',
    description: 'Complete Intermediate prestige (Level 100)',
    icon: '⭐',
    category: 'milestone',
    xpReward: 3000,
    requirement: { type: 'prestige_complete', value: 'intermediate' },
  },
  {
    id: 'advanced_complete',
    name: 'Elite',
    description: 'Complete Advanced prestige (Level 100)',
    icon: '💎',
    category: 'milestone',
    xpReward: 5000,
    requirement: { type: 'prestige_complete', value: 'advanced' },
  },
  {
    id: 'pro_complete',
    name: 'Legend',
    description: 'Complete Pro prestige (Level 100)',
    icon: '👑',
    category: 'milestone',
    xpReward: 10000,
    requirement: { type: 'prestige_complete', value: 'pro' },
  },
];

// =====================================================
// Streak Badges
// =====================================================

export const STREAK_BADGES: Badge[] = [
  {
    id: 'warming_up',
    name: 'Warming Up',
    description: 'Maintain a 7-day streak',
    icon: '🔥',
    category: 'streak',
    xpReward: 150,
    requirement: { type: 'streak_days', value: 7 },
  },
  {
    id: 'on_fire',
    name: 'On Fire',
    description: 'Maintain a 14-day streak',
    icon: '🔥🔥',
    category: 'streak',
    xpReward: 350,
    requirement: { type: 'streak_days', value: 14 },
  },
  {
    id: 'iron_chin',
    name: 'Iron Chin',
    description: 'Maintain a 30-day streak',
    icon: '💪',
    category: 'streak',
    xpReward: 750,
    requirement: { type: 'streak_days', value: 30 },
  },
  {
    id: 'relentless',
    name: 'Relentless',
    description: 'Maintain a 45-day streak',
    icon: '⚡',
    category: 'streak',
    xpReward: 1250,
    requirement: { type: 'streak_days', value: 45 },
  },
  {
    id: 'unbreakable',
    name: 'Unbreakable',
    description: 'Maintain a 60-day streak',
    icon: '🛡️',
    category: 'streak',
    xpReward: 2000,
    requirement: { type: 'streak_days', value: 60 },
  },
  {
    id: 'unstoppable',
    name: 'Unstoppable',
    description: 'Maintain a 90-day streak',
    icon: '🚀',
    category: 'streak',
    xpReward: 3500,
    requirement: { type: 'streak_days', value: 90 },
  },
  {
    id: 'machine',
    name: 'The Machine',
    description: 'Maintain a 180-day streak',
    icon: '🤖',
    category: 'streak',
    xpReward: 7500,
    requirement: { type: 'streak_days', value: 180 },
  },
  {
    id: 'year_warrior',
    name: 'Year Warrior',
    description: 'Maintain a 365-day streak',
    icon: '🏆',
    category: 'streak',
    xpReward: 25000,
    requirement: { type: 'streak_days', value: 365 },
  },
];

// =====================================================
// Volume Badges
// =====================================================

export const VOLUME_BADGES: Badge[] = [
  {
    id: 'punching_in',
    name: 'Punching In',
    description: 'Complete 10 workouts',
    icon: '👊',
    category: 'volume',
    xpReward: 150,
    requirement: { type: 'workouts_completed', value: 10 },
  },
  {
    id: 'regular',
    name: 'Regular',
    description: 'Complete 50 workouts',
    icon: '📅',
    category: 'volume',
    xpReward: 500,
    requirement: { type: 'workouts_completed', value: 50 },
  },
  {
    id: 'dedicated',
    name: 'Dedicated',
    description: 'Complete 100 workouts',
    icon: '🎯',
    category: 'volume',
    xpReward: 1500,
    requirement: { type: 'workouts_completed', value: 100 },
  },
  {
    id: 'committed',
    name: 'Committed',
    description: 'Complete 250 workouts',
    icon: '💎',
    category: 'volume',
    xpReward: 4000,
    requirement: { type: 'workouts_completed', value: 250 },
  },
  {
    id: 'obsessed',
    name: 'Obsessed',
    description: 'Complete 500 workouts',
    icon: '🔱',
    category: 'volume',
    xpReward: 10000,
    requirement: { type: 'workouts_completed', value: 500 },
  },
  {
    id: 'lifetime_fighter',
    name: 'Lifetime Fighter',
    description: 'Complete 1000 workouts',
    icon: '👑',
    category: 'volume',
    xpReward: 25000,
    requirement: { type: 'workouts_completed', value: 1000 },
  },
  // Training hours badges
  {
    id: 'hour_one',
    name: 'First Hour',
    description: 'Train for 1 total hour',
    icon: '⏱️',
    category: 'volume',
    xpReward: 50,
    requirement: { type: 'training_hours', value: 1 },
  },
  {
    id: 'ten_hours',
    name: 'Getting Serious',
    description: 'Train for 10 total hours',
    icon: '⏰',
    category: 'volume',
    xpReward: 250,
    requirement: { type: 'training_hours', value: 10 },
  },
  {
    id: 'hundred_hours',
    name: 'Century Club',
    description: 'Train for 100 total hours',
    icon: '💯',
    category: 'volume',
    xpReward: 2500,
    requirement: { type: 'training_hours', value: 100 },
  },
  {
    id: 'thousand_hours',
    name: '10,000 Hour Rule',
    description: 'Train for 1000 total hours',
    icon: '🌟',
    category: 'volume',
    xpReward: 50000,
    requirement: { type: 'training_hours', value: 1000 },
  },
];

// =====================================================
// Special Badges
// =====================================================

export const SPECIAL_BADGES: Badge[] = [
  {
    id: 'combo_century',
    name: 'Combo Century',
    description: 'Land 100 combos',
    icon: '💥',
    category: 'special',
    xpReward: 200,
    requirement: { type: 'combos_landed', value: 100 },
  },
  {
    id: 'combo_thousand',
    name: 'Combo Master',
    description: 'Land 1000 combos',
    icon: '⚡',
    category: 'special',
    xpReward: 1000,
    requirement: { type: 'combos_landed', value: 1000 },
  },
  {
    id: 'combo_legend',
    name: 'Combo Legend',
    description: 'Land 10,000 combos',
    icon: '🌩️',
    category: 'special',
    xpReward: 5000,
    requirement: { type: 'combos_landed', value: 10000 },
  },
];

// =====================================================
// All Badges Combined
// =====================================================

export const ALL_BADGES: Badge[] = [
  ...MILESTONE_BADGES,
  ...STREAK_BADGES,
  ...VOLUME_BADGES,
  ...SPECIAL_BADGES,
];

// Helper to find badge by ID
export function getBadgeById(badgeId: string): Badge | undefined {
  return ALL_BADGES.find(b => b.id === badgeId);
}

// Helper to check if user qualifies for a badge
export function checkBadgeEligibility(
  badge: Badge,
  stats: {
    workoutsCompleted: number;
    streakDays: number;
    prestige: string;
    level: number;
    combosLanded: number;
    trainingHours: number;
  },
  earnedBadges: string[]
): boolean {
  // Already earned
  if (earnedBadges.includes(badge.id)) return false;
  
  const { type, value } = badge.requirement;
  
  switch (type) {
    case 'first_workout':
      return stats.workoutsCompleted >= 1;
    case 'workouts_completed':
      return stats.workoutsCompleted >= (value as number);
    case 'streak_days':
      return stats.streakDays >= (value as number);
    case 'prestige_complete':
      // Check if prestige matches and level is 100
      return stats.prestige === value && stats.level >= 100;
    case 'combos_landed':
      return stats.combosLanded >= (value as number);
    case 'training_hours':
      return stats.trainingHours >= (value as number);
    default:
      return false;
  }
}

// Get all badges user is eligible for
export function getEligibleBadges(
  stats: {
    workoutsCompleted: number;
    streakDays: number;
    prestige: string;
    level: number;
    combosLanded: number;
    trainingHours: number;
  },
  earnedBadges: string[]
): Badge[] {
  return ALL_BADGES.filter(badge => 
    checkBadgeEligibility(badge, stats, earnedBadges)
  );
}
