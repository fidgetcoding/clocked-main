// =====================================================
// Get Clocked Badge Database v1.0
// 88 one-time achievement badges across 7 categories
// All values from XP System Architecture v1.0 document
// =====================================================

export type BadgeCategory = 'streak' | 'combo' | 'volume' | 'time' | 'conditioning' | 'in_workout' | 'prestige';

export type BadgeTrackingStat =
  | 'consecutive_days'
  | 'total_combos'
  | 'complex_combos'
  | 'defense_combos'
  | 'counter_combos'
  | 'total_sessions'
  | 'total_hours'
  | 'single_session_minutes'
  | 'total_pushups'
  | 'total_burpees'
  | 'total_curlups'
  | 'total_jog_run_minutes';

export type BadgeShape = 'circle' | 'hexagon' | 'shield' | 'star' | 'diamond';

export interface Badge {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  xpReward: number;
  trackingStat: BadgeTrackingStat;
  threshold: number;
  shape: BadgeShape;
}

// Category color palettes (for UI)
export const BADGE_CATEGORY_COLORS: Record<BadgeCategory, { bg: string; text: string; glow: string }> = {
  streak:       { bg: 'bg-orange-500/20', text: 'text-orange-400', glow: 'shadow-orange-500/30' },
  combo:        { bg: 'bg-blue-500/20',   text: 'text-blue-400',   glow: 'shadow-blue-500/30' },
  volume:       { bg: 'bg-green-500/20',  text: 'text-green-400',  glow: 'shadow-green-500/30' },
  time:         { bg: 'bg-purple-500/20', text: 'text-purple-400', glow: 'shadow-purple-500/30' },
  conditioning: { bg: 'bg-red-500/20',    text: 'text-red-400',    glow: 'shadow-red-500/30' },
  in_workout:   { bg: 'bg-yellow-500/20', text: 'text-yellow-400', glow: 'shadow-yellow-500/30' },
  prestige:     { bg: 'bg-amber-500/20',  text: 'text-amber-400',  glow: 'shadow-amber-500/30' },
};

export const BADGE_CATEGORY_NAMES: Record<BadgeCategory, string> = {
  streak: 'Streak',
  combo: 'Combo',
  volume: 'Volume',
  time: 'Time',
  conditioning: 'Conditioning',
  in_workout: 'In-Workout',
  prestige: 'Prestige',
};

// =====================================================
// 8.1 Streak Badges (18)  — Category Total: 97,810 XP
// =====================================================

const STREAK_BADGES: Badge[] = [
  { id: 'day_one',         name: 'Day One',        description: '1 consecutive day',    category: 'streak', xpReward: 10,    trackingStat: 'consecutive_days', threshold: 1,   shape: 'circle' },
  { id: 'day_two',         name: 'Day Two',        description: '2 consecutive days',   category: 'streak', xpReward: 25,    trackingStat: 'consecutive_days', threshold: 2,   shape: 'circle' },
  { id: 'warming_up',      name: 'Warming Up',     description: '3 consecutive days',   category: 'streak', xpReward: 50,    trackingStat: 'consecutive_days', threshold: 3,   shape: 'circle' },
  { id: 'building_steam',  name: 'Building Steam', description: '4 consecutive days',   category: 'streak', xpReward: 75,    trackingStat: 'consecutive_days', threshold: 4,   shape: 'hexagon' },
  { id: 'on_a_roll',       name: 'On A Roll',      description: '5 consecutive days',   category: 'streak', xpReward: 150,   trackingStat: 'consecutive_days', threshold: 5,   shape: 'hexagon' },
  { id: 'almost_there',    name: 'Almost There',   description: '6 consecutive days',   category: 'streak', xpReward: 200,   trackingStat: 'consecutive_days', threshold: 6,   shape: 'hexagon' },
  { id: 'week_strong',     name: 'Week Strong',    description: '7 consecutive days',   category: 'streak', xpReward: 300,   trackingStat: 'consecutive_days', threshold: 7,   shape: 'shield' },
  { id: 'double_week',     name: 'Double Week',    description: '10 consecutive days',  category: 'streak', xpReward: 500,   trackingStat: 'consecutive_days', threshold: 10,  shape: 'shield' },
  { id: 'fortnight',       name: 'Fortnight',      description: '14 consecutive days',  category: 'streak', xpReward: 800,   trackingStat: 'consecutive_days', threshold: 14,  shape: 'shield' },
  { id: 'three_weeks',     name: 'Three Weeks',    description: '21 consecutive days',  category: 'streak', xpReward: 1200,  trackingStat: 'consecutive_days', threshold: 21,  shape: 'star' },
  { id: 'iron_chin',       name: 'Iron Chin',      description: '30 consecutive days',  category: 'streak', xpReward: 2000,  trackingStat: 'consecutive_days', threshold: 30,  shape: 'star' },
  { id: 'steel_will',      name: 'Steel Will',     description: '45 consecutive days',  category: 'streak', xpReward: 3500,  trackingStat: 'consecutive_days', threshold: 45,  shape: 'star' },
  { id: 'unbreakable',     name: 'Unbreakable',    description: '60 consecutive days',  category: 'streak', xpReward: 5000,  trackingStat: 'consecutive_days', threshold: 60,  shape: 'diamond' },
  { id: 'diamond_mind',    name: 'Diamond Mind',   description: '75 consecutive days',  category: 'streak', xpReward: 7000,  trackingStat: 'consecutive_days', threshold: 75,  shape: 'diamond' },
  { id: 'machine',         name: 'Machine',        description: '100 consecutive days', category: 'streak', xpReward: 10000, trackingStat: 'consecutive_days', threshold: 100, shape: 'diamond' },
  { id: 'terminator',      name: 'Terminator',     description: '150 consecutive days', category: 'streak', xpReward: 15000, trackingStat: 'consecutive_days', threshold: 150, shape: 'diamond' },
  { id: 'inhuman',         name: 'Inhuman',        description: '200 consecutive days', category: 'streak', xpReward: 22000, trackingStat: 'consecutive_days', threshold: 200, shape: 'diamond' },
  { id: 'transcendent',    name: 'Transcendent',   description: '250 consecutive days', category: 'streak', xpReward: 30000, trackingStat: 'consecutive_days', threshold: 250, shape: 'diamond' },
];

// =====================================================
// 8.2 Combo Badges (23)  — Category Total: 93,930 XP
// =====================================================

const COMBO_BADGES: Badge[] = [
  { id: 'first_combo',       name: 'First Combo',       description: '1 total combo',                    category: 'combo', xpReward: 5,     trackingStat: 'total_combos',   threshold: 1,     shape: 'circle' },
  { id: 'combo_starter',     name: 'Combo Starter',     description: '25 total combos',                  category: 'combo', xpReward: 25,    trackingStat: 'total_combos',   threshold: 25,    shape: 'circle' },
  { id: 'combo_student',     name: 'Combo Student',     description: '50 total combos',                  category: 'combo', xpReward: 50,    trackingStat: 'total_combos',   threshold: 50,    shape: 'circle' },
  { id: 'combo_regular',     name: 'Combo Regular',     description: '100 total combos',                 category: 'combo', xpReward: 100,   trackingStat: 'total_combos',   threshold: 100,   shape: 'hexagon' },
  { id: 'combo_enthusiast',  name: 'Combo Enthusiast',  description: '250 total combos',                 category: 'combo', xpReward: 250,   trackingStat: 'total_combos',   threshold: 250,   shape: 'hexagon' },
  { id: 'combo_adept',       name: 'Combo Adept',       description: '500 total combos',                 category: 'combo', xpReward: 500,   trackingStat: 'total_combos',   threshold: 500,   shape: 'hexagon' },
  { id: 'combo_fighter',     name: 'Combo Fighter',     description: '750 total combos',                 category: 'combo', xpReward: 750,   trackingStat: 'total_combos',   threshold: 750,   shape: 'shield' },
  { id: 'combo_artist',      name: 'Combo Artist',      description: '1,000 total combos',               category: 'combo', xpReward: 1000,  trackingStat: 'total_combos',   threshold: 1000,  shape: 'shield' },
  { id: 'combo_specialist',  name: 'Combo Specialist',  description: '1,500 total combos',               category: 'combo', xpReward: 1500,  trackingStat: 'total_combos',   threshold: 1500,  shape: 'shield' },
  { id: 'combo_expert',      name: 'Combo Expert',      description: '2,500 total combos',               category: 'combo', xpReward: 2500,  trackingStat: 'total_combos',   threshold: 2500,  shape: 'star' },
  { id: 'combo_veteran',     name: 'Combo Veteran',     description: '3,500 total combos',               category: 'combo', xpReward: 3500,  trackingStat: 'total_combos',   threshold: 3500,  shape: 'star' },
  { id: 'combo_master',      name: 'Combo Master',      description: '5,000 total combos',               category: 'combo', xpReward: 5000,  trackingStat: 'total_combos',   threshold: 5000,  shape: 'star' },
  { id: 'combo_commander',   name: 'Combo Commander',   description: '7,500 total combos',               category: 'combo', xpReward: 6500,  trackingStat: 'total_combos',   threshold: 7500,  shape: 'diamond' },
  { id: 'combo_king',        name: 'Combo King',        description: '10,000 total combos',              category: 'combo', xpReward: 8000,  trackingStat: 'total_combos',   threshold: 10000, shape: 'diamond' },
  { id: 'combo_emperor',     name: 'Combo Emperor',     description: '15,000 total combos',              category: 'combo', xpReward: 10000, trackingStat: 'total_combos',   threshold: 15000, shape: 'diamond' },
  { id: 'combo_god',         name: 'Combo God',         description: '25,000 total combos',              category: 'combo', xpReward: 15000, trackingStat: 'total_combos',   threshold: 25000, shape: 'diamond' },
  { id: 'combo_immortal',    name: 'Combo Immortal',    description: '50,000 total combos',              category: 'combo', xpReward: 25000, trackingStat: 'total_combos',   threshold: 50000, shape: 'diamond' },
  { id: 'complex_fighter',   name: 'Complex Fighter',   description: '100 complex combos (6+ moves)',    category: 'combo', xpReward: 500,   trackingStat: 'complex_combos', threshold: 100,   shape: 'hexagon' },
  { id: 'complex_master',    name: 'Complex Master',    description: '500 complex combos (6+ moves)',    category: 'combo', xpReward: 2500,  trackingStat: 'complex_combos', threshold: 500,   shape: 'star' },
  { id: 'complex_god',       name: 'Complex God',       description: '2,500 complex combos (6+ moves)',  category: 'combo', xpReward: 7500,  trackingStat: 'complex_combos', threshold: 2500,  shape: 'diamond' },
  { id: 'defense_specialist',name: 'Defense Specialist', description: '100 defense combos (2+ def)',     category: 'combo', xpReward: 500,   trackingStat: 'defense_combos', threshold: 100,   shape: 'shield' },
  { id: 'defense_master',    name: 'Defense Master',    description: '500 defense combos (2+ def)',      category: 'combo', xpReward: 2500,  trackingStat: 'defense_combos', threshold: 500,   shape: 'star' },
  { id: 'counter_puncher',   name: 'Counter Puncher',   description: '100 counter combos (def-first)',   category: 'combo', xpReward: 750,   trackingStat: 'counter_combos', threshold: 100,   shape: 'shield' },
];

// =====================================================
// 8.3 Volume Badges (11)  — Category Total: 15,600 XP
// =====================================================

const VOLUME_BADGES: Badge[] = [
  { id: 'first_blood',      name: 'First Blood',     description: '1 total session',    category: 'volume', xpReward: 25,   trackingStat: 'total_sessions', threshold: 1,   shape: 'circle' },
  { id: 'getting_going',    name: 'Getting Going',   description: '3 total sessions',   category: 'volume', xpReward: 50,   trackingStat: 'total_sessions', threshold: 3,   shape: 'circle' },
  { id: 'punching_in',      name: 'Punching In',     description: '5 total sessions',   category: 'volume', xpReward: 75,   trackingStat: 'total_sessions', threshold: 5,   shape: 'hexagon' },
  { id: 'getting_started',  name: 'Getting Started', description: '10 total sessions',  category: 'volume', xpReward: 150,  trackingStat: 'total_sessions', threshold: 10,  shape: 'hexagon' },
  { id: 'building_habits',  name: 'Building Habits', description: '25 total sessions',  category: 'volume', xpReward: 300,  trackingStat: 'total_sessions', threshold: 25,  shape: 'shield' },
  { id: 'regular',          name: 'Regular',         description: '50 total sessions',  category: 'volume', xpReward: 600,  trackingStat: 'total_sessions', threshold: 50,  shape: 'shield' },
  { id: 'committed',        name: 'Committed',       description: '75 total sessions',  category: 'volume', xpReward: 900,  trackingStat: 'total_sessions', threshold: 75,  shape: 'star' },
  { id: 'dedicated',        name: 'Dedicated',       description: '100 total sessions', category: 'volume', xpReward: 1500, trackingStat: 'total_sessions', threshold: 100, shape: 'star' },
  { id: 'dialed_in',        name: 'Dialed In',       description: '150 total sessions', category: 'volume', xpReward: 2500, trackingStat: 'total_sessions', threshold: 150, shape: 'diamond' },
  { id: 'obsessed',         name: 'Obsessed',        description: '200 total sessions', category: 'volume', xpReward: 4000, trackingStat: 'total_sessions', threshold: 200, shape: 'diamond' },
  { id: 'relentless',       name: 'Relentless',      description: '250 total sessions', category: 'volume', xpReward: 5500, trackingStat: 'total_sessions', threshold: 250, shape: 'diamond' },
];

// =====================================================
// 8.4 Time Badges (11)  — Category Total: 12,135 XP
// =====================================================

const TIME_BADGES: Badge[] = [
  { id: 'first_minutes',      name: 'First Minutes',    description: '15 min total training',  category: 'time', xpReward: 10,   trackingStat: 'total_hours',             threshold: 0.25, shape: 'circle' },
  { id: 'half_hour',          name: 'Half Hour',        description: '30 min total training',  category: 'time', xpReward: 25,   trackingStat: 'total_hours',             threshold: 0.5,  shape: 'circle' },
  { id: 'hour_one',           name: 'Hour One',         description: '1 hour total training',  category: 'time', xpReward: 50,   trackingStat: 'total_hours',             threshold: 1,    shape: 'hexagon' },
  { id: 'two_hours',          name: 'Two Hours',        description: '2 hours total training', category: 'time', xpReward: 100,  trackingStat: 'total_hours',             threshold: 2,    shape: 'hexagon' },
  { id: 'five_hours',         name: 'Five Hours',       description: '5 hours total training', category: 'time', xpReward: 200,  trackingStat: 'total_hours',             threshold: 5,    shape: 'shield' },
  { id: 'ten_spot',           name: 'Ten Spot',         description: '10 hours total',         category: 'time', xpReward: 400,  trackingStat: 'total_hours',             threshold: 10,   shape: 'shield' },
  { id: 'quarter_century',    name: 'Quarter Century',  description: '25 hours total',         category: 'time', xpReward: 800,  trackingStat: 'total_hours',             threshold: 25,   shape: 'star' },
  { id: 'fifty_club',         name: 'Fifty Club',       description: '50 hours total',         category: 'time', xpReward: 1500, trackingStat: 'total_hours',             threshold: 50,   shape: 'star' },
  { id: 'century',            name: 'Century',          description: '100 hours total',        category: 'time', xpReward: 3000, trackingStat: 'total_hours',             threshold: 100,  shape: 'diamond' },
  { id: 'double_century',     name: 'Double Century',   description: '200 hours total',        category: 'time', xpReward: 6000, trackingStat: 'total_hours',             threshold: 200,  shape: 'diamond' },
  { id: 'single_session_30',  name: 'Single Session 30',description: 'Complete a 30+ min workout', category: 'time', xpReward: 50, trackingStat: 'single_session_minutes', threshold: 30,   shape: 'circle' },
];

// =====================================================
// 8.5 Conditioning Badges (19) — Category Total: 21,350 XP
// =====================================================

const CONDITIONING_BADGES: Badge[] = [
  { id: 'pushup_starter',  name: 'Push-up Starter',  description: '50 total pushups',           category: 'conditioning', xpReward: 50,   trackingStat: 'total_pushups',         threshold: 50,   shape: 'circle' },
  { id: 'pushup_regular',  name: 'Push-up Regular',  description: '100 total pushups',          category: 'conditioning', xpReward: 100,  trackingStat: 'total_pushups',         threshold: 100,  shape: 'circle' },
  { id: 'pushup_novice',   name: 'Push-up Novice',   description: '250 total pushups',          category: 'conditioning', xpReward: 200,  trackingStat: 'total_pushups',         threshold: 250,  shape: 'hexagon' },
  { id: 'pushup_pro',      name: 'Push-up Pro',      description: '1,000 total pushups',        category: 'conditioning', xpReward: 500,  trackingStat: 'total_pushups',         threshold: 1000, shape: 'shield' },
  { id: 'pushup_machine',  name: 'Push-up Machine',  description: '5,000 total pushups',        category: 'conditioning', xpReward: 2000, trackingStat: 'total_pushups',         threshold: 5000, shape: 'star' },
  { id: 'pushup_god',      name: 'Push-up God',      description: '25,000 total pushups',       category: 'conditioning', xpReward: 5000, trackingStat: 'total_pushups',         threshold: 25000,shape: 'diamond' },
  { id: 'burpee_beginner', name: 'Burpee Beginner',  description: '50 total burpees',           category: 'conditioning', xpReward: 100,  trackingStat: 'total_burpees',         threshold: 50,   shape: 'circle' },
  { id: 'burpee_beast',    name: 'Burpee Beast',     description: '500 total burpees',          category: 'conditioning', xpReward: 500,  trackingStat: 'total_burpees',         threshold: 500,  shape: 'shield' },
  { id: 'burpee_demon',    name: 'Burpee Demon',     description: '2,500 total burpees',        category: 'conditioning', xpReward: 2000, trackingStat: 'total_burpees',         threshold: 2500, shape: 'diamond' },
  { id: 'core_starter',    name: 'Core Starter',     description: '100 total curlups',          category: 'conditioning', xpReward: 50,   trackingStat: 'total_curlups',         threshold: 100,  shape: 'circle' },
  { id: 'core_regular',    name: 'Core Regular',     description: '500 total curlups',          category: 'conditioning', xpReward: 250,  trackingStat: 'total_curlups',         threshold: 500,  shape: 'hexagon' },
  { id: 'core_crusher',    name: 'Core Crusher',     description: '1,000 total curlups',        category: 'conditioning', xpReward: 750,  trackingStat: 'total_curlups',         threshold: 1000, shape: 'shield' },
  { id: 'core_warrior',    name: 'Core Warrior',     description: '2,500 total curlups',        category: 'conditioning', xpReward: 1500, trackingStat: 'total_curlups',         threshold: 2500, shape: 'star' },
  { id: 'core_destroyer',  name: 'Core Destroyer',   description: '5,000 total curlups',        category: 'conditioning', xpReward: 3000, trackingStat: 'total_curlups',         threshold: 5000, shape: 'diamond' },
  { id: 'runner_starter',  name: 'Runner Starter',   description: '30 total jog/run minutes',   category: 'conditioning', xpReward: 50,   trackingStat: 'total_jog_run_minutes', threshold: 30,   shape: 'circle' },
  { id: 'runners_high',    name: 'Runners High',     description: '60 total jog/run minutes',   category: 'conditioning', xpReward: 200,  trackingStat: 'total_jog_run_minutes', threshold: 60,   shape: 'hexagon' },
  { id: 'road_regular',    name: 'Road Regular',     description: '150 total jog/run minutes',  category: 'conditioning', xpReward: 600,  trackingStat: 'total_jog_run_minutes', threshold: 150,  shape: 'shield' },
  { id: 'road_warrior',    name: 'Road Warrior',     description: '300 total jog/run minutes',  category: 'conditioning', xpReward: 1500, trackingStat: 'total_jog_run_minutes', threshold: 300,  shape: 'star' },
  { id: 'road_master',     name: 'Road Master',      description: '600 total jog/run minutes',  category: 'conditioning', xpReward: 3000, trackingStat: 'total_jog_run_minutes', threshold: 600,  shape: 'diamond' },
];

// =====================================================
// 8.6 In-Workout Badges (4) — Category Total: 390 XP
// Trigger on first completed session
// =====================================================

const IN_WORKOUT_BADGES: Badge[] = [
  { id: 'full_send',           name: 'Full Send',           description: 'Complete your first workout',        category: 'in_workout', xpReward: 200, trackingStat: 'total_sessions', threshold: 1, shape: 'star' },
  { id: 'push_through',        name: 'Push Through',        description: 'Push through your first workout',    category: 'in_workout', xpReward: 50,  trackingStat: 'total_sessions', threshold: 1, shape: 'shield' },
  { id: 'beast_mode_achiever', name: 'Beast Mode Achiever', description: 'Achieve beast mode in a workout',    category: 'in_workout', xpReward: 100, trackingStat: 'total_sessions', threshold: 1, shape: 'hexagon' },
  { id: 'rapid_fire',          name: 'Rapid Fire',          description: 'Complete rapid fire combinations',    category: 'in_workout', xpReward: 40,  trackingStat: 'total_sessions', threshold: 1, shape: 'circle' },
];

// =====================================================
// 8.7 Prestige Badges (2) — Category Total: 105,500 XP
// =====================================================

const PRESTIGE_BADGES: Badge[] = [
  { id: 'bmf',  name: 'BMF',  description: 'Complete 250 total sessions (Baddest MF)',       category: 'prestige', xpReward: 5500,   trackingStat: 'total_sessions',   threshold: 250, shape: 'diamond' },
  { id: 'bmfk', name: 'BMFK', description: '365 consecutive days (Baddest MF Known)',        category: 'prestige', xpReward: 100000, trackingStat: 'consecutive_days', threshold: 365, shape: 'diamond' },
];

// =====================================================
// All Badges Combined — 88 total, 346,715 XP grand total
// =====================================================

export const ALL_BADGES: Badge[] = [
  ...STREAK_BADGES,
  ...COMBO_BADGES,
  ...VOLUME_BADGES,
  ...TIME_BADGES,
  ...CONDITIONING_BADGES,
  ...IN_WORKOUT_BADGES,
  ...PRESTIGE_BADGES,
];

// Category arrays for iteration
export const BADGE_CATEGORIES: { category: BadgeCategory; badges: Badge[] }[] = [
  { category: 'streak',       badges: STREAK_BADGES },
  { category: 'combo',        badges: COMBO_BADGES },
  { category: 'volume',       badges: VOLUME_BADGES },
  { category: 'time',         badges: TIME_BADGES },
  { category: 'conditioning', badges: CONDITIONING_BADGES },
  { category: 'in_workout',   badges: IN_WORKOUT_BADGES },
  { category: 'prestige',     badges: PRESTIGE_BADGES },
];

// =====================================================
// Badge Helpers
// =====================================================

export function getBadgeById(badgeId: string): Badge | undefined {
  return ALL_BADGES.find(b => b.id === badgeId);
}

/**
 * User's cumulative stats used for badge checking.
 */
export interface BadgeStats {
  consecutiveDays: number;
  totalCombos: number;
  complexCombos: number;
  defenseCombos: number;
  counterCombos: number;
  totalSessions: number;
  totalHours: number;
  singleSessionMinutes: number; // Duration of the current session in minutes
  totalPushups: number;
  totalBurpees: number;
  totalCurlups: number;
  totalJogRunMinutes: number;
}

/**
 * Check all badges against stats, returning newly earned badges.
 * Checks AFTER updating cumulative stats for current session.
 */
export function checkBadges(stats: BadgeStats, earnedBadgeIds: string[]): Badge[] {
  const newBadges: Badge[] = [];
  
  for (const badge of ALL_BADGES) {
    // Skip already earned
    if (earnedBadgeIds.includes(badge.id)) continue;
    
    const value = getStatValue(stats, badge.trackingStat);
    if (value >= badge.threshold) {
      newBadges.push(badge);
    }
  }
  
  return newBadges;
}

function getStatValue(stats: BadgeStats, stat: BadgeTrackingStat): number {
  switch (stat) {
    case 'consecutive_days':       return stats.consecutiveDays;
    case 'total_combos':           return stats.totalCombos;
    case 'complex_combos':         return stats.complexCombos;
    case 'defense_combos':         return stats.defenseCombos;
    case 'counter_combos':         return stats.counterCombos;
    case 'total_sessions':         return stats.totalSessions;
    case 'total_hours':            return stats.totalHours;
    case 'single_session_minutes': return stats.singleSessionMinutes;
    case 'total_pushups':          return stats.totalPushups;
    case 'total_burpees':          return stats.totalBurpees;
    case 'total_curlups':          return stats.totalCurlups;
    case 'total_jog_run_minutes':  return stats.totalJogRunMinutes;
    default: return 0;
  }
}

/**
 * Calculate total XP from an array of badges.
 */
export function sumBadgeXP(badges: Badge[]): number {
  return badges.reduce((sum, b) => sum + b.xpReward, 0);
}

/**
 * Get progress toward a badge (0 to 1).
 */
export function getBadgeProgress(badge: Badge, stats: BadgeStats): number {
  const value = getStatValue(stats, badge.trackingStat);
  return Math.min(1, value / badge.threshold);
}
