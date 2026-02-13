// =====================================================
// Post-L100 Badge Database — 146 endgame badges
// For users who've reached Level 100 in any tier
// =====================================================

import { Badge, BadgeCategory } from './badges';

// Extended categories for post-L100 badges
export type PostL100Category =
  | 'mastery'
  | 'overflow'
  | 'legacy'
  | 'ultra_combo'
  | 'ultra_conditioning'
  | 'ultra_time'
  | 'ultra_volume'
  | 'ultra_cardio'
  | 'consistency'
  | 'milestones'
  | 'performance'
  | 'ultra_streak'
  | 'combat_mastery';

export type ExtendedBadgeCategory = BadgeCategory | PostL100Category;

// Extended tracking stats for post-L100 badges
export type PostL100TrackingStat =
  | 'post_l100_sessions'
  | 'overflow_xp'
  | 'tiers_completed'
  | 'rookie_sessions_to_l100'
  | 'beginner_sessions_to_l100'
  | 'intermediate_sessions_to_l100'
  | 'advanced_sessions_to_l100'
  | 'pro_sessions_to_l100'
  | 'total_levels_earned'
  | 'total_combos'
  | 'total_pushups'
  | 'total_burpees'
  | 'total_curlups'
  | 'total_hours'
  | 'total_sessions'
  | 'total_jog_run_minutes'
  | 'double_days'
  | 'morning_workouts'
  | 'night_workouts'
  | 'weekend_workouts'
  | 'weekday_workouts'
  | 'perfect_months'
  | 'comeback_count'
  | 'monday_workouts'
  | 'friday_workouts'
  | 'sunday_workouts'
  | 'account_age_days'
  | 'new_years_workout'
  | 'birthday_workout'
  | 'holiday_workouts'
  | 'single_session_xp'
  | 'total_badges'
  | 'streak_recoveries'
  | 'avg_xp_per_session'
  | 'consecutive_days'
  | 'punch_1_count'
  | 'punch_2_count'
  | 'punch_3_count'
  | 'punch_4_count'
  | 'punch_5_count'
  | 'punch_6_count'
  | 'punch_7_count'
  | 'punch_8_count'
  | 'slips_count'
  | 'rolls_count'
  | 'pullbacks_count'
  | 'circles_count';

export interface PostL100Badge {
  id: string;
  name: string;
  description: string;
  category: PostL100Category;
  xpReward: number;
  trackingStat: PostL100TrackingStat;
  threshold: number;
  shape: 'circle' | 'hexagon' | 'shield' | 'star' | 'diamond';
  postL100: true;
}

// Category display config
export const POST_L100_CATEGORY_COLORS: Record<PostL100Category, { bg: string; text: string; glow: string }> = {
  mastery:            { bg: 'bg-violet-500/20',  text: 'text-violet-400',  glow: 'shadow-violet-500/30' },
  overflow:           { bg: 'bg-cyan-500/20',    text: 'text-cyan-400',    glow: 'shadow-cyan-500/30' },
  legacy:             { bg: 'bg-slate-300/20',   text: 'text-slate-200',   glow: 'shadow-slate-300/30' },
  ultra_combo:        { bg: 'bg-blue-600/20',    text: 'text-blue-300',    glow: 'shadow-blue-600/30' },
  ultra_conditioning: { bg: 'bg-rose-500/20',    text: 'text-rose-400',    glow: 'shadow-rose-500/30' },
  ultra_time:         { bg: 'bg-indigo-500/20',  text: 'text-indigo-400',  glow: 'shadow-indigo-500/30' },
  ultra_volume:       { bg: 'bg-emerald-500/20', text: 'text-emerald-400', glow: 'shadow-emerald-500/30' },
  ultra_cardio:       { bg: 'bg-teal-500/20',    text: 'text-teal-400',    glow: 'shadow-teal-500/30' },
  consistency:        { bg: 'bg-lime-500/20',    text: 'text-lime-400',    glow: 'shadow-lime-500/30' },
  milestones:         { bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-400', glow: 'shadow-fuchsia-500/30' },
  performance:        { bg: 'bg-sky-500/20',     text: 'text-sky-400',     glow: 'shadow-sky-500/30' },
  ultra_streak:       { bg: 'bg-orange-600/20',  text: 'text-orange-300',  glow: 'shadow-orange-600/30' },
  combat_mastery:     { bg: 'bg-red-600/20',     text: 'text-red-300',     glow: 'shadow-red-600/30' },
};

export const POST_L100_CATEGORY_NAMES: Record<PostL100Category, string> = {
  mastery:            'Mastery',
  overflow:           'Overflow',
  legacy:             'Legacy',
  ultra_combo:        'Ultra Combo',
  ultra_conditioning: 'Ultra Conditioning',
  ultra_time:         'Ultra Time',
  ultra_volume:       'Ultra Volume',
  ultra_cardio:       'Ultra Cardio',
  consistency:        'Consistency',
  milestones:         'Milestones',
  performance:        'Performance',
  ultra_streak:       'Ultra Streak',
  combat_mastery:     'Combat Mastery',
};

function shape(xp: number): 'circle' | 'hexagon' | 'shield' | 'star' | 'diamond' {
  if (xp >= 5000) return 'diamond';
  if (xp >= 2000) return 'star';
  if (xp >= 750) return 'shield';
  if (xp >= 250) return 'hexagon';
  return 'circle';
}

// =====================================================
// Mastery Badges (7)
// =====================================================
const MASTERY_BADGES: PostL100Badge[] = [
  { id: 'pl100_victory_lap',      name: 'Victory Lap',      description: '5 sessions at L100',          category: 'mastery', xpReward: 50,   trackingStat: 'post_l100_sessions', threshold: 5,   shape: 'circle',  postL100: true },
  { id: 'pl100_not_done_yet',     name: 'Not Done Yet',     description: '10 sessions at L100',         category: 'mastery', xpReward: 150,  trackingStat: 'post_l100_sessions', threshold: 10,  shape: 'circle',  postL100: true },
  { id: 'pl100_staying_power',    name: 'Staying Power',    description: '25 sessions at L100',         category: 'mastery', xpReward: 300,  trackingStat: 'post_l100_sessions', threshold: 25,  shape: 'hexagon', postL100: true },
  { id: 'pl100_throne_keeper',    name: 'Throne Keeper',    description: '50 sessions at L100',         category: 'mastery', xpReward: 600,  trackingStat: 'post_l100_sessions', threshold: 50,  shape: 'shield',  postL100: true },
  { id: 'pl100_eternal_champion', name: 'Eternal Champion', description: '100 sessions at L100',        category: 'mastery', xpReward: 1500, trackingStat: 'post_l100_sessions', threshold: 100, shape: 'star',    postL100: true },
  { id: 'pl100_untouchable',      name: 'Untouchable',      description: '150 sessions at L100',        category: 'mastery', xpReward: 3000, trackingStat: 'post_l100_sessions', threshold: 150, shape: 'diamond', postL100: true },
  { id: 'pl100_immortalized',     name: 'Immortalized',     description: '250 sessions at L100',        category: 'mastery', xpReward: 5000, trackingStat: 'post_l100_sessions', threshold: 250, shape: 'diamond', postL100: true },
];

// =====================================================
// Overflow Badges (7)
// =====================================================
const OVERFLOW_BADGES: PostL100Badge[] = [
  { id: 'pl100_overflow',     name: 'Overflow',     description: '5K XP past L100',         category: 'overflow', xpReward: 100,   trackingStat: 'overflow_xp', threshold: 5000,    shape: 'circle',  postL100: true },
  { id: 'pl100_surplus',      name: 'Surplus',      description: '15K surplus XP',           category: 'overflow', xpReward: 250,   trackingStat: 'overflow_xp', threshold: 15000,   shape: 'hexagon', postL100: true },
  { id: 'pl100_abundance',    name: 'Abundance',    description: '50K over the line',        category: 'overflow', xpReward: 500,   trackingStat: 'overflow_xp', threshold: 50000,   shape: 'shield',  postL100: true },
  { id: 'pl100_stockpile',    name: 'Stockpile',    description: '100K XP hoarded',          category: 'overflow', xpReward: 1000,  trackingStat: 'overflow_xp', threshold: 100000,  shape: 'star',    postL100: true },
  { id: 'pl100_war_chest',    name: 'War Chest',    description: '250K XP war chest',        category: 'overflow', xpReward: 2500,  trackingStat: 'overflow_xp', threshold: 250000,  shape: 'star',    postL100: true },
  { id: 'pl100_dragon_hoard', name: 'Dragon Hoard', description: '500K past L100',           category: 'overflow', xpReward: 5000,  trackingStat: 'overflow_xp', threshold: 500000,  shape: 'diamond', postL100: true },
  { id: 'pl100_infinite',     name: 'Infinite',     description: '1M overflow XP',           category: 'overflow', xpReward: 10000, trackingStat: 'overflow_xp', threshold: 1000000, shape: 'diamond', postL100: true },
];

// =====================================================
// Legacy Badges (13)
// =====================================================
const LEGACY_BADGES: PostL100Badge[] = [
  { id: 'pl100_moving_up',          name: 'Moving Up',          description: 'L100 in 1 tier and prestiged',         category: 'legacy', xpReward: 500,  trackingStat: 'tiers_completed',             threshold: 1,   shape: 'shield',  postL100: true },
  { id: 'pl100_two_weight_champ',   name: 'Two-Weight Champ',   description: 'L100 in 2 tiers',                      category: 'legacy', xpReward: 1500, trackingStat: 'tiers_completed',             threshold: 2,   shape: 'star',    postL100: true },
  { id: 'pl100_triple_crown',       name: 'Triple Crown',       description: 'L100 in 3 tiers',                      category: 'legacy', xpReward: 3000, trackingStat: 'tiers_completed',             threshold: 3,   shape: 'diamond', postL100: true },
  { id: 'pl100_four_division_king', name: 'Four-Division King', description: 'L100 in 4 tiers',                      category: 'legacy', xpReward: 5000, trackingStat: 'tiers_completed',             threshold: 4,   shape: 'diamond', postL100: true },
  { id: 'pl100_undisputed',         name: 'Undisputed',         description: 'L100 in all 5 tiers',                   category: 'legacy', xpReward: 10000,trackingStat: 'tiers_completed',             threshold: 5,   shape: 'diamond', postL100: true },
  { id: 'pl100_sr_rookie',          name: 'Speed Runner: Rookie',       description: 'Rookie L100 in under 20 sessions',    category: 'legacy', xpReward: 750,  trackingStat: 'rookie_sessions_to_l100',    threshold: 20,  shape: 'shield',  postL100: true },
  { id: 'pl100_sr_beginner',        name: 'Speed Runner: Beginner',     description: 'Beginner L100 in under 35 sessions',  category: 'legacy', xpReward: 1500, trackingStat: 'beginner_sessions_to_l100',  threshold: 35,  shape: 'star',    postL100: true },
  { id: 'pl100_sr_intermediate',    name: 'Speed Runner: Intermediate', description: 'Intermediate L100 in under 65 sessions', category: 'legacy', xpReward: 2500, trackingStat: 'intermediate_sessions_to_l100', threshold: 65, shape: 'star', postL100: true },
  { id: 'pl100_sr_advanced',        name: 'Speed Runner: Advanced',     description: 'Advanced L100 in under 90 sessions',  category: 'legacy', xpReward: 4000, trackingStat: 'advanced_sessions_to_l100',  threshold: 90,  shape: 'diamond', postL100: true },
  { id: 'pl100_sr_pro',             name: 'Speed Runner: Pro',          description: 'Pro L100 in under 130 sessions',      category: 'legacy', xpReward: 7500, trackingStat: 'pro_sessions_to_l100',       threshold: 130, shape: 'diamond', postL100: true },
  { id: 'pl100_long_road',          name: 'The Long Road',     description: '200 total levels across all tiers',     category: 'legacy', xpReward: 2000, trackingStat: 'total_levels_earned',        threshold: 200, shape: 'star',    postL100: true },
  { id: 'pl100_level_collector',    name: 'Level Collector',   description: '350 total levels',                      category: 'legacy', xpReward: 4000, trackingStat: 'total_levels_earned',        threshold: 350, shape: 'diamond', postL100: true },
  { id: 'pl100_500_club',           name: '500 Club',          description: '500 total levels (full 5-tier run)',     category: 'legacy', xpReward: 8000, trackingStat: 'total_levels_earned',        threshold: 500, shape: 'diamond', postL100: true },
];

// =====================================================
// Ultra Combo Badges (4)
// =====================================================
const ULTRA_COMBO_BADGES: PostL100Badge[] = [
  { id: 'pl100_100k_combos',  name: '100K Club',       description: '100,000 lifetime combos',   category: 'ultra_combo', xpReward: 5000,  trackingStat: 'total_combos', threshold: 100000,  shape: 'diamond', postL100: true },
  { id: 'pl100_250k_combos',  name: 'Quarter Million', description: '250,000 lifetime combos',   category: 'ultra_combo', xpReward: 10000, trackingStat: 'total_combos', threshold: 250000,  shape: 'diamond', postL100: true },
  { id: 'pl100_500k_combos',  name: 'Half Million',    description: '500,000 lifetime combos',   category: 'ultra_combo', xpReward: 20000, trackingStat: 'total_combos', threshold: 500000,  shape: 'diamond', postL100: true },
  { id: 'pl100_1m_combos',    name: 'Million Combo',   description: '1,000,000 lifetime combos', category: 'ultra_combo', xpReward: 50000, trackingStat: 'total_combos', threshold: 1000000, shape: 'diamond', postL100: true },
];

// =====================================================
// Ultra Conditioning Badges (12)
// =====================================================
const ULTRA_CONDITIONING_BADGES: PostL100Badge[] = [
  { id: 'pl100_50k_pushups',   name: '50K Pushups',        description: '50,000 lifetime pushups',   category: 'ultra_conditioning', xpReward: 3000,  trackingStat: 'total_pushups', threshold: 50000,  shape: 'star',    postL100: true },
  { id: 'pl100_100k_pushups',  name: '100K Pushups',       description: '100,000 lifetime pushups',  category: 'ultra_conditioning', xpReward: 7500,  trackingStat: 'total_pushups', threshold: 100000, shape: 'diamond', postL100: true },
  { id: 'pl100_iron_chest',    name: 'Iron Chest',         description: '250,000 lifetime pushups',  category: 'ultra_conditioning', xpReward: 15000, trackingStat: 'total_pushups', threshold: 250000, shape: 'diamond', postL100: true },
  { id: 'pl100_pushup_m',      name: 'Pushup Millionaire', description: '500,000 lifetime pushups',  category: 'ultra_conditioning', xpReward: 30000, trackingStat: 'total_pushups', threshold: 500000, shape: 'diamond', postL100: true },
  { id: 'pl100_5k_burpees',    name: '5K Burpees',         description: '5,000 lifetime burpees',    category: 'ultra_conditioning', xpReward: 2000,  trackingStat: 'total_burpees', threshold: 5000,   shape: 'star',    postL100: true },
  { id: 'pl100_10k_burpees',   name: '10K Burpees',        description: '10,000 lifetime burpees',   category: 'ultra_conditioning', xpReward: 5000,  trackingStat: 'total_burpees', threshold: 10000,  shape: 'diamond', postL100: true },
  { id: 'pl100_burpee_maniac', name: 'Burpee Maniac',      description: '25,000 lifetime burpees',   category: 'ultra_conditioning', xpReward: 10000, trackingStat: 'total_burpees', threshold: 25000,  shape: 'diamond', postL100: true },
  { id: 'pl100_burpee_trans',  name: 'Burpee Transcended', description: '50,000 lifetime burpees',   category: 'ultra_conditioning', xpReward: 20000, trackingStat: 'total_burpees', threshold: 50000,  shape: 'diamond', postL100: true },
  { id: 'pl100_10k_core',      name: '10K Core',           description: '10,000 lifetime curlups',   category: 'ultra_conditioning', xpReward: 2000,  trackingStat: 'total_curlups', threshold: 10000,  shape: 'star',    postL100: true },
  { id: 'pl100_25k_core',      name: '25K Core',           description: '25,000 lifetime curlups',   category: 'ultra_conditioning', xpReward: 5000,  trackingStat: 'total_curlups', threshold: 25000,  shape: 'diamond', postL100: true },
  { id: 'pl100_50k_core',      name: '50K Core',           description: '50,000 lifetime curlups',   category: 'ultra_conditioning', xpReward: 10000, trackingStat: 'total_curlups', threshold: 50000,  shape: 'diamond', postL100: true },
  { id: 'pl100_granite_abs',   name: 'Granite Abs',        description: '100,000 lifetime curlups',  category: 'ultra_conditioning', xpReward: 20000, trackingStat: 'total_curlups', threshold: 100000, shape: 'diamond', postL100: true },
];

// =====================================================
// Ultra Time Badges (5)
// =====================================================
const ULTRA_TIME_BADGES: PostL100Badge[] = [
  { id: 'pl100_500h',   name: '500 Hours',   description: '500 lifetime hours',   category: 'ultra_time', xpReward: 5000,   trackingStat: 'total_hours', threshold: 500,   shape: 'diamond', postL100: true },
  { id: 'pl100_1000h',  name: '1000 Hours',  description: '1,000 lifetime hours', category: 'ultra_time', xpReward: 12000,  trackingStat: 'total_hours', threshold: 1000,  shape: 'diamond', postL100: true },
  { id: 'pl100_2000h',  name: '2000 Hours',  description: '2,000 lifetime hours', category: 'ultra_time', xpReward: 25000,  trackingStat: 'total_hours', threshold: 2000,  shape: 'diamond', postL100: true },
  { id: 'pl100_5000h',  name: '5000 Hours',  description: '5,000 lifetime hours', category: 'ultra_time', xpReward: 50000,  trackingStat: 'total_hours', threshold: 5000,  shape: 'diamond', postL100: true },
  { id: 'pl100_10000h', name: '10K Hours',   description: '10,000 lifetime hours',category: 'ultra_time', xpReward: 100000, trackingStat: 'total_hours', threshold: 10000, shape: 'diamond', postL100: true },
];

// =====================================================
// Ultra Volume Badges (6)
// =====================================================
const ULTRA_VOLUME_BADGES: PostL100Badge[] = [
  { id: 'pl100_300s',  name: '300 Sessions',  description: '300 lifetime sessions',  category: 'ultra_volume', xpReward: 2000,  trackingStat: 'total_sessions', threshold: 300,  shape: 'star',    postL100: true },
  { id: 'pl100_500s',  name: '500 Sessions',  description: '500 lifetime sessions',  category: 'ultra_volume', xpReward: 5000,  trackingStat: 'total_sessions', threshold: 500,  shape: 'diamond', postL100: true },
  { id: 'pl100_750s',  name: '750 Sessions',  description: '750 lifetime sessions',  category: 'ultra_volume', xpReward: 8000,  trackingStat: 'total_sessions', threshold: 750,  shape: 'diamond', postL100: true },
  { id: 'pl100_1000s', name: '1000 Sessions', description: '1,000 lifetime sessions',category: 'ultra_volume', xpReward: 15000, trackingStat: 'total_sessions', threshold: 1000, shape: 'diamond', postL100: true },
  { id: 'pl100_2000s', name: '2000 Sessions', description: '2,000 lifetime sessions',category: 'ultra_volume', xpReward: 30000, trackingStat: 'total_sessions', threshold: 2000, shape: 'diamond', postL100: true },
  { id: 'pl100_5000s', name: '5000 Sessions', description: '5,000 lifetime sessions',category: 'ultra_volume', xpReward: 50000, trackingStat: 'total_sessions', threshold: 5000, shape: 'diamond', postL100: true },
];

// =====================================================
// Ultra Cardio Badges (4)
// =====================================================
const ULTRA_CARDIO_BADGES: PostL100Badge[] = [
  { id: 'pl100_1000min',   name: '1000 Minutes',      description: '1,000 jog/run minutes',     category: 'ultra_cardio', xpReward: 2000,  trackingStat: 'total_jog_run_minutes', threshold: 1000, shape: 'star',    postL100: true },
  { id: 'pl100_marathon',  name: 'Marathon (2620 min)',description: '2,620 jog/run minutes',     category: 'ultra_cardio', xpReward: 5000,  trackingStat: 'total_jog_run_minutes', threshold: 2620, shape: 'diamond', postL100: true },
  { id: 'pl100_ultra_mara',name: 'Ultra Marathon',     description: '5,000 jog/run minutes',     category: 'ultra_cardio', xpReward: 10000, trackingStat: 'total_jog_run_minutes', threshold: 5000, shape: 'diamond', postL100: true },
  { id: 'pl100_100h_run',  name: '100 Hours Running',  description: '6,000 jog/run minutes',    category: 'ultra_cardio', xpReward: 20000, trackingStat: 'total_jog_run_minutes', threshold: 6000, shape: 'diamond', postL100: true },
];

// =====================================================
// Consistency Badges (23)
// =====================================================
const CONSISTENCY_BADGES: PostL100Badge[] = [
  { id: 'pl100_2ad_10',       name: 'Two-A-Days x10',       description: '10 days with 2+ workouts',     category: 'consistency', xpReward: 500,  trackingStat: 'double_days',       threshold: 10,  shape: 'shield',  postL100: true },
  { id: 'pl100_2ad_50',       name: 'Two-A-Days x50',       description: '50 double workout days',       category: 'consistency', xpReward: 2500, trackingStat: 'double_days',       threshold: 50,  shape: 'star',    postL100: true },
  { id: 'pl100_2ad_100',      name: 'Two-A-Days x100',      description: '100 double workout days',      category: 'consistency', xpReward: 5000, trackingStat: 'double_days',       threshold: 100, shape: 'diamond', postL100: true },
  { id: 'pl100_morning_25',   name: 'Morning Person x25',   description: '25 workouts before 8am',       category: 'consistency', xpReward: 500,  trackingStat: 'morning_workouts',  threshold: 25,  shape: 'shield',  postL100: true },
  { id: 'pl100_morning_100',  name: 'Morning Person x100',  description: '100 early bird sessions',      category: 'consistency', xpReward: 2000, trackingStat: 'morning_workouts',  threshold: 100, shape: 'star',    postL100: true },
  { id: 'pl100_morning_365',  name: 'Morning Person x365',  description: 'A full year of dawn training', category: 'consistency', xpReward: 5000, trackingStat: 'morning_workouts',  threshold: 365, shape: 'diamond', postL100: true },
  { id: 'pl100_night_25',     name: 'Night Owl x25',        description: '25 workouts after 9pm',        category: 'consistency', xpReward: 500,  trackingStat: 'night_workouts',    threshold: 25,  shape: 'shield',  postL100: true },
  { id: 'pl100_night_100',    name: 'Night Owl x100',       description: '100 late night sessions',      category: 'consistency', xpReward: 2000, trackingStat: 'night_workouts',    threshold: 100, shape: 'star',    postL100: true },
  { id: 'pl100_weekend_25',   name: 'Weekend Warrior x25',  description: '25 weekend workouts',          category: 'consistency', xpReward: 500,  trackingStat: 'weekend_workouts',  threshold: 25,  shape: 'shield',  postL100: true },
  { id: 'pl100_weekend_100',  name: 'Weekend Warrior x100', description: '100 weekend sessions',         category: 'consistency', xpReward: 2000, trackingStat: 'weekend_workouts',  threshold: 100, shape: 'star',    postL100: true },
  { id: 'pl100_weekday_100',  name: 'Weekday Grinder x100', description: '100 weekday sessions',         category: 'consistency', xpReward: 2000, trackingStat: 'weekday_workouts',  threshold: 100, shape: 'star',    postL100: true },
  { id: 'pl100_weekday_250',  name: 'Weekday Grinder x250', description: '250 weekday sessions',         category: 'consistency', xpReward: 5000, trackingStat: 'weekday_workouts',  threshold: 250, shape: 'diamond', postL100: true },
  { id: 'pl100_pm_1',         name: 'Monthly Perfect x1',   description: '1 month with 20+ workouts',    category: 'consistency', xpReward: 1000, trackingStat: 'perfect_months',    threshold: 1,   shape: 'star',    postL100: true },
  { id: 'pl100_pm_3',         name: 'Monthly Perfect x3',   description: '3 perfect months',             category: 'consistency', xpReward: 3000, trackingStat: 'perfect_months',    threshold: 3,   shape: 'diamond', postL100: true },
  { id: 'pl100_pm_6',         name: 'Monthly Perfect x6',   description: '6 perfect months',             category: 'consistency', xpReward: 6000, trackingStat: 'perfect_months',    threshold: 6,   shape: 'diamond', postL100: true },
  { id: 'pl100_pm_12',        name: 'Monthly Perfect x12',  description: 'A full year of 20+/month',     category: 'consistency', xpReward: 12000,trackingStat: 'perfect_months',    threshold: 12,  shape: 'diamond', postL100: true },
  { id: 'pl100_comeback_1',   name: 'Comeback King',        description: 'Returned after 7+ day absence',category: 'consistency', xpReward: 500,  trackingStat: 'comeback_count',    threshold: 1,   shape: 'shield',  postL100: true },
  { id: 'pl100_comeback_5',   name: 'Comeback King x5',     description: '5 comebacks from 7+ day breaks',category: 'consistency',xpReward: 1500, trackingStat: 'comeback_count',    threshold: 5,   shape: 'star',    postL100: true },
  { id: 'pl100_comeback_10',  name: 'Comeback King x10',    description: '10 comebacks — you always return',category: 'consistency',xpReward: 3000, trackingStat: 'comeback_count', threshold: 10,  shape: 'diamond', postL100: true },
  { id: 'pl100_monday_10',    name: 'Never Skip Monday x10',description: '10 Monday sessions',           category: 'consistency', xpReward: 500,  trackingStat: 'monday_workouts',   threshold: 10,  shape: 'shield',  postL100: true },
  { id: 'pl100_monday_50',    name: 'Never Skip Monday x50',description: '50 Mondays strong',            category: 'consistency', xpReward: 2500, trackingStat: 'monday_workouts',   threshold: 50,  shape: 'star',    postL100: true },
  { id: 'pl100_friday_25',    name: 'Friday Fighter x25',   description: '25 Friday sessions',           category: 'consistency', xpReward: 500,  trackingStat: 'friday_workouts',   threshold: 25,  shape: 'shield',  postL100: true },
  { id: 'pl100_sunday_25',    name: 'Sunday Soldier x25',   description: '25 Sunday sessions',           category: 'consistency', xpReward: 500,  trackingStat: 'sunday_workouts',   threshold: 25,  shape: 'shield',  postL100: true },
];

// =====================================================
// Milestones Badges (7)
// =====================================================
const MILESTONES_BADGES: PostL100Badge[] = [
  { id: 'pl100_founding',    name: 'Founding Member',   description: 'Account 1 year old',         category: 'milestones', xpReward: 1000,  trackingStat: 'account_age_days',  threshold: 365,  shape: 'star',    postL100: true },
  { id: 'pl100_2yr_vet',     name: 'Two Year Vet',      description: '2 years in the game',        category: 'milestones', xpReward: 3000,  trackingStat: 'account_age_days',  threshold: 730,  shape: 'diamond', postL100: true },
  { id: 'pl100_3yr_vet',     name: 'Three Year Vet',    description: 'Three full years',           category: 'milestones', xpReward: 5000,  trackingStat: 'account_age_days',  threshold: 1095, shape: 'diamond', postL100: true },
  { id: 'pl100_og',          name: 'OG',                description: '5 years. Legend.',            category: 'milestones', xpReward: 10000, trackingStat: 'account_age_days',  threshold: 1825, shape: 'diamond', postL100: true },
  { id: 'pl100_new_years',   name: 'New Years Fighter', description: 'Worked out on Jan 1',        category: 'milestones', xpReward: 250,   trackingStat: 'new_years_workout', threshold: 1,    shape: 'hexagon', postL100: true },
  { id: 'pl100_birthday',    name: 'Birthday Boxer',    description: 'Worked out on your birthday',category: 'milestones', xpReward: 250,   trackingStat: 'birthday_workout',  threshold: 1,    shape: 'hexagon', postL100: true },
  { id: 'pl100_holidays',    name: 'Holiday Grinder',   description: '5 workouts on major holidays',category: 'milestones',xpReward: 500,   trackingStat: 'holiday_workouts',  threshold: 5,    shape: 'shield',  postL100: true },
];

// =====================================================
// Performance Badges (14)
// =====================================================
const PERFORMANCE_BADGES: PostL100Badge[] = [
  { id: 'pl100_xp_monster',    name: 'XP Monster',          description: '2,000+ XP in a single session',    category: 'performance', xpReward: 500,  trackingStat: 'single_session_xp',  threshold: 2000,  shape: 'shield',  postL100: true },
  { id: 'pl100_xp_demon',      name: 'XP Demon',            description: '3,000+ XP in one session',         category: 'performance', xpReward: 1500, trackingStat: 'single_session_xp',  threshold: 3000,  shape: 'star',    postL100: true },
  { id: 'pl100_xp_god',        name: 'XP God',              description: '5,000+ XP in one session',         category: 'performance', xpReward: 3000, trackingStat: 'single_session_xp',  threshold: 5000,  shape: 'diamond', postL100: true },
  { id: 'pl100_xp_mythic',     name: 'XP Mythic',           description: '7,500+ XP in one session',         category: 'performance', xpReward: 5000, trackingStat: 'single_session_xp',  threshold: 7500,  shape: 'diamond', postL100: true },
  { id: 'pl100_bc_25',         name: 'Badge Collector x25', description: '25 unique badges earned',          category: 'performance', xpReward: 500,  trackingStat: 'total_badges',       threshold: 25,    shape: 'shield',  postL100: true },
  { id: 'pl100_bc_50',         name: 'Badge Collector x50', description: '50 unique badges',                 category: 'performance', xpReward: 1500, trackingStat: 'total_badges',       threshold: 50,    shape: 'star',    postL100: true },
  { id: 'pl100_bc_100',        name: 'Badge Collector x100',description: '100 unique badges',                category: 'performance', xpReward: 3000, trackingStat: 'total_badges',       threshold: 100,   shape: 'diamond', postL100: true },
  { id: 'pl100_bc_150',        name: 'Badge Collector x150',description: '150 unique badges',                category: 'performance', xpReward: 5000, trackingStat: 'total_badges',       threshold: 150,   shape: 'diamond', postL100: true },
  { id: 'pl100_bc_200',        name: 'Badge Hunter',        description: '200 unique badges. Completionist.',category: 'performance', xpReward: 10000,trackingStat: 'total_badges',       threshold: 200,   shape: 'diamond', postL100: true },
  { id: 'pl100_ss_5',          name: 'Streak Survivor x5',  description: 'Rebuilt streak to 7+ 5 times',     category: 'performance', xpReward: 500,  trackingStat: 'streak_recoveries', threshold: 5,     shape: 'shield',  postL100: true },
  { id: 'pl100_ss_10',         name: 'Streak Survivor x10', description: '10 streak rebuilds',               category: 'performance', xpReward: 1500, trackingStat: 'streak_recoveries', threshold: 10,    shape: 'star',    postL100: true },
  { id: 'pl100_avg_1k',        name: 'XP/Session Average 1K',  description: 'Lifetime avg 1,000+ XP/session',category: 'performance', xpReward: 1000, trackingStat: 'avg_xp_per_session', threshold: 1000, shape: 'star',    postL100: true },
  { id: 'pl100_avg_15k',       name: 'XP/Session Average 1.5K',description: 'Lifetime avg 1,500+ XP/session',category: 'performance', xpReward: 2500, trackingStat: 'avg_xp_per_session', threshold: 1500, shape: 'star',    postL100: true },
  { id: 'pl100_avg_2k',        name: 'XP/Session Average 2K',  description: 'Lifetime avg 2,000+ XP/session',category: 'performance', xpReward: 5000, trackingStat: 'avg_xp_per_session', threshold: 2000, shape: 'diamond', postL100: true },
];

// =====================================================
// Ultra Streak Badges (8)
// =====================================================
const ULTRA_STREAK_BADGES: PostL100Badge[] = [
  { id: 'pl100_300d',  name: '300 Days',             description: '300 consecutive days',  category: 'ultra_streak', xpReward: 35000,  trackingStat: 'consecutive_days', threshold: 300,  shape: 'diamond', postL100: true },
  { id: 'pl100_365d',  name: '365 Days',             description: '365 consecutive days',  category: 'ultra_streak', xpReward: 45000,  trackingStat: 'consecutive_days', threshold: 365,  shape: 'diamond', postL100: true },
  { id: 'pl100_400d',  name: '400 Days',             description: '400 consecutive days',  category: 'ultra_streak', xpReward: 50000,  trackingStat: 'consecutive_days', threshold: 400,  shape: 'diamond', postL100: true },
  { id: 'pl100_500d',  name: '500 Days',             description: '500 consecutive days',  category: 'ultra_streak', xpReward: 65000,  trackingStat: 'consecutive_days', threshold: 500,  shape: 'diamond', postL100: true },
  { id: 'pl100_600d',  name: '600 Days',             description: '600 consecutive days',  category: 'ultra_streak', xpReward: 80000,  trackingStat: 'consecutive_days', threshold: 600,  shape: 'diamond', postL100: true },
  { id: 'pl100_730d',  name: '730 Days (2 Years)',    description: '730 consecutive days',  category: 'ultra_streak', xpReward: 100000, trackingStat: 'consecutive_days', threshold: 730,  shape: 'diamond', postL100: true },
  { id: 'pl100_1000d', name: '1000 Days',            description: '1000 consecutive days', category: 'ultra_streak', xpReward: 150000, trackingStat: 'consecutive_days', threshold: 1000, shape: 'diamond', postL100: true },
  { id: 'pl100_1095d', name: '1095 Days (3 Years)',  description: '1095 consecutive days', category: 'ultra_streak', xpReward: 200000, trackingStat: 'consecutive_days', threshold: 1095, shape: 'diamond', postL100: true },
];

// =====================================================
// Combat Mastery Badges (36)
// =====================================================
const COMBAT_MASTERY_BADGES: PostL100Badge[] = [
  // Jab (punch 1)
  { id: 'pl100_jab_app',  name: 'Jab Apprentice',  description: '5,000 lifetime jabs',    category: 'combat_mastery', xpReward: 500,  trackingStat: 'punch_1_count', threshold: 5000,   shape: 'shield',  postL100: true },
  { id: 'pl100_jab_spec', name: 'Jab Specialist',  description: '25,000 lifetime jabs',   category: 'combat_mastery', xpReward: 2000, trackingStat: 'punch_1_count', threshold: 25000,  shape: 'star',    postL100: true },
  { id: 'pl100_jab_mast', name: 'Jab Master',      description: '100,000 lifetime jabs',  category: 'combat_mastery', xpReward: 5000, trackingStat: 'punch_1_count', threshold: 100000, shape: 'diamond', postL100: true },
  // Cross (punch 2)
  { id: 'pl100_cross_app',  name: 'Cross Apprentice',  description: '5,000 lifetime crosses',    category: 'combat_mastery', xpReward: 500,  trackingStat: 'punch_2_count', threshold: 5000,   shape: 'shield',  postL100: true },
  { id: 'pl100_cross_spec', name: 'Cross Specialist',  description: '25,000 lifetime crosses',   category: 'combat_mastery', xpReward: 2000, trackingStat: 'punch_2_count', threshold: 25000,  shape: 'star',    postL100: true },
  { id: 'pl100_cross_mast', name: 'Cross Master',      description: '100,000 lifetime crosses',  category: 'combat_mastery', xpReward: 5000, trackingStat: 'punch_2_count', threshold: 100000, shape: 'diamond', postL100: true },
  // Lead Hook (punch 3)
  { id: 'pl100_lhook_app',  name: 'Lead Hook Apprentice',  description: '5,000 lifetime lead hooks',    category: 'combat_mastery', xpReward: 500,  trackingStat: 'punch_3_count', threshold: 5000,   shape: 'shield',  postL100: true },
  { id: 'pl100_lhook_spec', name: 'Lead Hook Specialist',  description: '25,000 lifetime lead hooks',   category: 'combat_mastery', xpReward: 2000, trackingStat: 'punch_3_count', threshold: 25000,  shape: 'star',    postL100: true },
  { id: 'pl100_lhook_mast', name: 'Lead Hook Master',      description: '100,000 lifetime lead hooks',  category: 'combat_mastery', xpReward: 5000, trackingStat: 'punch_3_count', threshold: 100000, shape: 'diamond', postL100: true },
  // Rear Hook (punch 4)
  { id: 'pl100_rhook_app',  name: 'Rear Hook Apprentice',  description: '5,000 lifetime rear hooks',    category: 'combat_mastery', xpReward: 500,  trackingStat: 'punch_4_count', threshold: 5000,   shape: 'shield',  postL100: true },
  { id: 'pl100_rhook_spec', name: 'Rear Hook Specialist',  description: '25,000 lifetime rear hooks',   category: 'combat_mastery', xpReward: 2000, trackingStat: 'punch_4_count', threshold: 25000,  shape: 'star',    postL100: true },
  { id: 'pl100_rhook_mast', name: 'Rear Hook Master',      description: '100,000 lifetime rear hooks',  category: 'combat_mastery', xpReward: 5000, trackingStat: 'punch_4_count', threshold: 100000, shape: 'diamond', postL100: true },
  // Lead Uppercut (punch 5)
  { id: 'pl100_lupper_app',  name: 'Lead Uppercut Apprentice',  description: '5,000 lifetime lead uppercuts',    category: 'combat_mastery', xpReward: 500,  trackingStat: 'punch_5_count', threshold: 5000,   shape: 'shield',  postL100: true },
  { id: 'pl100_lupper_spec', name: 'Lead Uppercut Specialist',  description: '25,000 lifetime lead uppercuts',   category: 'combat_mastery', xpReward: 2000, trackingStat: 'punch_5_count', threshold: 25000,  shape: 'star',    postL100: true },
  { id: 'pl100_lupper_mast', name: 'Lead Uppercut Master',      description: '100,000 lifetime lead uppercuts',  category: 'combat_mastery', xpReward: 5000, trackingStat: 'punch_5_count', threshold: 100000, shape: 'diamond', postL100: true },
  // Rear Uppercut (punch 6)
  { id: 'pl100_rupper_app',  name: 'Rear Uppercut Apprentice',  description: '5,000 lifetime rear uppercuts',    category: 'combat_mastery', xpReward: 500,  trackingStat: 'punch_6_count', threshold: 5000,   shape: 'shield',  postL100: true },
  { id: 'pl100_rupper_spec', name: 'Rear Uppercut Specialist',  description: '25,000 lifetime rear uppercuts',   category: 'combat_mastery', xpReward: 2000, trackingStat: 'punch_6_count', threshold: 25000,  shape: 'star',    postL100: true },
  { id: 'pl100_rupper_mast', name: 'Rear Uppercut Master',      description: '100,000 lifetime rear uppercuts',  category: 'combat_mastery', xpReward: 5000, trackingStat: 'punch_6_count', threshold: 100000, shape: 'diamond', postL100: true },
  // Lead Body (punch 7)
  { id: 'pl100_lbody_app',  name: 'Lead Body Apprentice',  description: '5,000 lifetime lead body shots',    category: 'combat_mastery', xpReward: 500,  trackingStat: 'punch_7_count', threshold: 5000,   shape: 'shield',  postL100: true },
  { id: 'pl100_lbody_spec', name: 'Lead Body Specialist',  description: '25,000 lifetime lead body shots',   category: 'combat_mastery', xpReward: 2000, trackingStat: 'punch_7_count', threshold: 25000,  shape: 'star',    postL100: true },
  { id: 'pl100_lbody_mast', name: 'Lead Body Master',      description: '100,000 lifetime lead body shots',  category: 'combat_mastery', xpReward: 5000, trackingStat: 'punch_7_count', threshold: 100000, shape: 'diamond', postL100: true },
  // Rear Body (punch 8)
  { id: 'pl100_rbody_app',  name: 'Rear Body Apprentice',  description: '5,000 lifetime rear body shots',    category: 'combat_mastery', xpReward: 500,  trackingStat: 'punch_8_count', threshold: 5000,   shape: 'shield',  postL100: true },
  { id: 'pl100_rbody_spec', name: 'Rear Body Specialist',  description: '25,000 lifetime rear body shots',   category: 'combat_mastery', xpReward: 2000, trackingStat: 'punch_8_count', threshold: 25000,  shape: 'star',    postL100: true },
  { id: 'pl100_rbody_mast', name: 'Rear Body Master',      description: '100,000 lifetime rear body shots',  category: 'combat_mastery', xpReward: 5000, trackingStat: 'punch_8_count', threshold: 100000, shape: 'diamond', postL100: true },
  // Slips
  { id: 'pl100_slip_student', name: 'Slip Student', description: '2,500 lifetime slips',  category: 'combat_mastery', xpReward: 500,  trackingStat: 'slips_count', threshold: 2500,  shape: 'shield',  postL100: true },
  { id: 'pl100_slip_expert',  name: 'Slip Expert',  description: '10,000 lifetime slips', category: 'combat_mastery', xpReward: 2000, trackingStat: 'slips_count', threshold: 10000, shape: 'star',    postL100: true },
  { id: 'pl100_slip_legend',  name: 'Slip Legend',  description: '50,000 lifetime slips', category: 'combat_mastery', xpReward: 5000, trackingStat: 'slips_count', threshold: 50000, shape: 'diamond', postL100: true },
  // Rolls
  { id: 'pl100_roll_student', name: 'Roll Student', description: '2,500 lifetime rolls',  category: 'combat_mastery', xpReward: 500,  trackingStat: 'rolls_count', threshold: 2500,  shape: 'shield',  postL100: true },
  { id: 'pl100_roll_expert',  name: 'Roll Expert',  description: '10,000 lifetime rolls', category: 'combat_mastery', xpReward: 2000, trackingStat: 'rolls_count', threshold: 10000, shape: 'star',    postL100: true },
  { id: 'pl100_roll_legend',  name: 'Roll Legend',  description: '50,000 lifetime rolls', category: 'combat_mastery', xpReward: 5000, trackingStat: 'rolls_count', threshold: 50000, shape: 'diamond', postL100: true },
  // Pullbacks
  { id: 'pl100_pull_student', name: 'Pullback Student', description: '2,500 lifetime pullbacks',  category: 'combat_mastery', xpReward: 500,  trackingStat: 'pullbacks_count', threshold: 2500,  shape: 'shield',  postL100: true },
  { id: 'pl100_pull_expert',  name: 'Pullback Expert',  description: '10,000 lifetime pullbacks', category: 'combat_mastery', xpReward: 2000, trackingStat: 'pullbacks_count', threshold: 10000, shape: 'star',    postL100: true },
  { id: 'pl100_pull_legend',  name: 'Pullback Legend',  description: '50,000 lifetime pullbacks', category: 'combat_mastery', xpReward: 5000, trackingStat: 'pullbacks_count', threshold: 50000, shape: 'diamond', postL100: true },
  // Circles
  { id: 'pl100_circle_student', name: 'Circle Student', description: '2,500 lifetime circles',  category: 'combat_mastery', xpReward: 500,  trackingStat: 'circles_count', threshold: 2500,  shape: 'shield',  postL100: true },
  { id: 'pl100_circle_expert',  name: 'Circle Expert',  description: '10,000 lifetime circles', category: 'combat_mastery', xpReward: 2000, trackingStat: 'circles_count', threshold: 10000, shape: 'star',    postL100: true },
  { id: 'pl100_circle_legend',  name: 'Circle Legend',  description: '50,000 lifetime circles', category: 'combat_mastery', xpReward: 5000, trackingStat: 'circles_count', threshold: 50000, shape: 'diamond', postL100: true },
];

// =====================================================
// All Post-L100 Badges Combined — 146 total
// =====================================================
export const ALL_POST_L100_BADGES: PostL100Badge[] = [
  ...MASTERY_BADGES,
  ...OVERFLOW_BADGES,
  ...LEGACY_BADGES,
  ...ULTRA_COMBO_BADGES,
  ...ULTRA_CONDITIONING_BADGES,
  ...ULTRA_TIME_BADGES,
  ...ULTRA_VOLUME_BADGES,
  ...ULTRA_CARDIO_BADGES,
  ...CONSISTENCY_BADGES,
  ...MILESTONES_BADGES,
  ...PERFORMANCE_BADGES,
  ...ULTRA_STREAK_BADGES,
  ...COMBAT_MASTERY_BADGES,
];

// Category arrays for iteration
export const POST_L100_BADGE_CATEGORIES: { category: PostL100Category; badges: PostL100Badge[] }[] = [
  { category: 'mastery',            badges: MASTERY_BADGES },
  { category: 'overflow',           badges: OVERFLOW_BADGES },
  { category: 'legacy',             badges: LEGACY_BADGES },
  { category: 'ultra_combo',        badges: ULTRA_COMBO_BADGES },
  { category: 'ultra_conditioning', badges: ULTRA_CONDITIONING_BADGES },
  { category: 'ultra_time',         badges: ULTRA_TIME_BADGES },
  { category: 'ultra_volume',       badges: ULTRA_VOLUME_BADGES },
  { category: 'ultra_cardio',       badges: ULTRA_CARDIO_BADGES },
  { category: 'consistency',        badges: CONSISTENCY_BADGES },
  { category: 'milestones',         badges: MILESTONES_BADGES },
  { category: 'performance',        badges: PERFORMANCE_BADGES },
  { category: 'ultra_streak',       badges: ULTRA_STREAK_BADGES },
  { category: 'combat_mastery',     badges: COMBAT_MASTERY_BADGES },
];

// Extended stats interface for post-L100 badge checking
export interface PostL100Stats {
  postL100Sessions: number;
  overflowXp: number;
  tiersCompleted: number;
  totalLevelsEarned: number;
  rookieSessionsToL100: number;
  beginnerSessionsToL100: number;
  intermediateSessionsToL100: number;
  advancedSessionsToL100: number;
  proSessionsToL100: number;
  doubleDays: number;
  morningWorkouts: number;
  nightWorkouts: number;
  weekendWorkouts: number;
  weekdayWorkouts: number;
  perfectMonths: number;
  comebackCount: number;
  mondayWorkouts: number;
  fridayWorkouts: number;
  sundayWorkouts: number;
  accountAgeDays: number;
  newYearsWorkout: number;
  birthdayWorkout: number;
  holidayWorkouts: number;
  singleSessionXp: number;
  totalBadges: number;
  streakRecoveries: number;
  avgXpPerSession: number;
  // Shared with base stats
  consecutiveDays: number;
  totalCombos: number;
  totalPushups: number;
  totalBurpees: number;
  totalCurlups: number;
  totalHours: number;
  totalSessions: number;
  totalJogRunMinutes: number;
  // Combat mastery
  punch1Count: number;
  punch2Count: number;
  punch3Count: number;
  punch4Count: number;
  punch5Count: number;
  punch6Count: number;
  punch7Count: number;
  punch8Count: number;
  slipsCount: number;
  rollsCount: number;
  pullbacksCount: number;
  circlesCount: number;
}

function getPostL100StatValue(stats: PostL100Stats, stat: PostL100TrackingStat): number {
  switch (stat) {
    case 'post_l100_sessions': return stats.postL100Sessions;
    case 'overflow_xp': return stats.overflowXp;
    case 'tiers_completed': return stats.tiersCompleted;
    case 'total_levels_earned': return stats.totalLevelsEarned;
    case 'rookie_sessions_to_l100': return stats.rookieSessionsToL100;
    case 'beginner_sessions_to_l100': return stats.beginnerSessionsToL100;
    case 'intermediate_sessions_to_l100': return stats.intermediateSessionsToL100;
    case 'advanced_sessions_to_l100': return stats.advancedSessionsToL100;
    case 'pro_sessions_to_l100': return stats.proSessionsToL100;
    case 'double_days': return stats.doubleDays;
    case 'morning_workouts': return stats.morningWorkouts;
    case 'night_workouts': return stats.nightWorkouts;
    case 'weekend_workouts': return stats.weekendWorkouts;
    case 'weekday_workouts': return stats.weekdayWorkouts;
    case 'perfect_months': return stats.perfectMonths;
    case 'comeback_count': return stats.comebackCount;
    case 'monday_workouts': return stats.mondayWorkouts;
    case 'friday_workouts': return stats.fridayWorkouts;
    case 'sunday_workouts': return stats.sundayWorkouts;
    case 'account_age_days': return stats.accountAgeDays;
    case 'new_years_workout': return stats.newYearsWorkout;
    case 'birthday_workout': return stats.birthdayWorkout;
    case 'holiday_workouts': return stats.holidayWorkouts;
    case 'single_session_xp': return stats.singleSessionXp;
    case 'total_badges': return stats.totalBadges;
    case 'streak_recoveries': return stats.streakRecoveries;
    case 'avg_xp_per_session': return stats.avgXpPerSession;
    case 'consecutive_days': return stats.consecutiveDays;
    case 'total_combos': return stats.totalCombos;
    case 'total_pushups': return stats.totalPushups;
    case 'total_burpees': return stats.totalBurpees;
    case 'total_curlups': return stats.totalCurlups;
    case 'total_hours': return stats.totalHours;
    case 'total_sessions': return stats.totalSessions;
    case 'total_jog_run_minutes': return stats.totalJogRunMinutes;
    case 'punch_1_count': return stats.punch1Count;
    case 'punch_2_count': return stats.punch2Count;
    case 'punch_3_count': return stats.punch3Count;
    case 'punch_4_count': return stats.punch4Count;
    case 'punch_5_count': return stats.punch5Count;
    case 'punch_6_count': return stats.punch6Count;
    case 'punch_7_count': return stats.punch7Count;
    case 'punch_8_count': return stats.punch8Count;
    case 'slips_count': return stats.slipsCount;
    case 'rolls_count': return stats.rollsCount;
    case 'pullbacks_count': return stats.pullbacksCount;
    case 'circles_count': return stats.circlesCount;
    default: return 0;
  }
}

/**
 * Check post-L100 badges against stats, returning newly earned badges.
 */
export function checkPostL100Badges(stats: PostL100Stats, earnedBadgeIds: string[]): PostL100Badge[] {
  const newBadges: PostL100Badge[] = [];
  for (const badge of ALL_POST_L100_BADGES) {
    if (earnedBadgeIds.includes(badge.id)) continue;
    const value = getPostL100StatValue(stats, badge.trackingStat);
    if (value >= badge.threshold) {
      newBadges.push(badge);
    }
  }
  return newBadges;
}

/**
 * Get progress toward a post-L100 badge (0 to 1).
 */
export function getPostL100BadgeProgress(badge: PostL100Badge, stats: PostL100Stats): number {
  const value = getPostL100StatValue(stats, badge.trackingStat);
  return Math.min(1, value / badge.threshold);
}
