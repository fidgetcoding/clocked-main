// =====================================================
// Get Clocked XP System - Core Calculation Utilities
// =====================================================

// Prestige Tiers (5 total)
export type Prestige = 'rookie' | 'beginner' | 'intermediate' | 'advanced' | 'pro';

// Rankings within each prestige (10 rankings, levels 1-100)
export type Ranking = 
  | 'prospect'   // Levels 1-10
  | 'scrapper'   // Levels 11-20
  | 'fighter'    // Levels 21-30
  | 'warrior'    // Levels 31-40
  | 'gladiator'  // Levels 41-50
  | 'veteran'    // Levels 51-60
  | 'phenom'     // Levels 61-70
  | 'icon'       // Levels 71-80
  | 'apex'       // Levels 81-90
  | 'champion';  // Levels 91-100

// Display names
export const PRESTIGE_NAMES: Record<Prestige, string> = {
  rookie: 'Rookie',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  pro: 'Pro',
};

export const RANKING_NAMES: Record<Ranking, string> = {
  prospect: 'Prospect',
  scrapper: 'Scrapper',
  fighter: 'Fighter',
  warrior: 'Warrior',
  gladiator: 'Gladiator',
  veteran: 'Veteran',
  phenom: 'Phenom',
  icon: 'Icon',
  apex: 'Apex',
  champion: 'Champion',
};

// Order for iteration
export const PRESTIGE_ORDER: Prestige[] = ['rookie', 'beginner', 'intermediate', 'advanced', 'pro'];
export const RANKING_ORDER: Ranking[] = [
  'prospect', 'scrapper', 'fighter', 'warrior', 'gladiator',
  'veteran', 'phenom', 'icon', 'apex', 'champion'
];

// =====================================================
// XP Per Level Formulas (per prestige tier)
// =====================================================

/**
 * Calculate XP required to reach a specific level within a prestige
 * Formula: base + (level * multiplier)
 */
export function getXPRequiredForLevel(prestige: Prestige, level: number): number {
  const formulas: Record<Prestige, { base: number; multiplier: number }> = {
    rookie: { base: 220, multiplier: 8.8 },
    beginner: { base: 1100, multiplier: 1.5 },
    intermediate: { base: 1260, multiplier: 2.5 },
    advanced: { base: 2517.5, multiplier: 5 },
    pro: { base: 4156.5, multiplier: 4 },
  };
  
  const { base, multiplier } = formulas[prestige];
  return Math.round(base + (level * multiplier));
}

/**
 * Calculate total XP needed to complete all levels in a prestige (1-100)
 */
export function getTotalXPForPrestige(prestige: Prestige): number {
  let total = 0;
  for (let level = 1; level <= 100; level++) {
    total += getXPRequiredForLevel(prestige, level);
  }
  return total;
}

/**
 * Get cumulative XP thresholds for each prestige tier
 */
export function getPrestigeThresholds(): Record<Prestige, number> {
  const thresholds: Record<Prestige, number> = {
    rookie: 0,
    beginner: getTotalXPForPrestige('rookie'),
    intermediate: 0,
    advanced: 0,
    pro: 0,
  };
  
  thresholds.intermediate = thresholds.beginner + getTotalXPForPrestige('beginner');
  thresholds.advanced = thresholds.intermediate + getTotalXPForPrestige('intermediate');
  thresholds.pro = thresholds.advanced + getTotalXPForPrestige('advanced');
  
  return thresholds;
}

// =====================================================
// Ranking Calculation (from level)
// =====================================================

/**
 * Get ranking from level (1-100)
 * Levels 1-10: Prospect, 11-20: Scrapper, etc.
 */
export function getRankingFromLevel(level: number): Ranking {
  const clampedLevel = Math.max(1, Math.min(100, level));
  const rankingIndex = Math.floor((clampedLevel - 1) / 10);
  return RANKING_ORDER[rankingIndex];
}

/**
 * Get level range for a ranking
 */
export function getLevelRangeForRanking(ranking: Ranking): { min: number; max: number } {
  const index = RANKING_ORDER.indexOf(ranking);
  return {
    min: index * 10 + 1,
    max: (index + 1) * 10,
  };
}

// =====================================================
// Current Status Calculation
// =====================================================

export interface UserGamificationStatus {
  prestige: Prestige;
  ranking: Ranking;
  level: number;
  xpInCurrentLevel: number;
  xpRequiredForNextLevel: number;
  levelProgress: number; // 0-100%
  displayString: string; // "Beginner - Prospect - Level 1"
}

/**
 * Calculate full gamification status from prestige, level, and XP
 */
export function getGamificationStatus(
  prestige: Prestige, 
  level: number, 
  totalXP: number
): UserGamificationStatus {
  const clampedLevel = Math.max(1, Math.min(100, level));
  const ranking = getRankingFromLevel(clampedLevel);
  
  // Calculate XP progress within current level
  const xpForCurrentLevel = getXPRequiredForLevel(prestige, clampedLevel);
  const xpForPreviousLevels = calculateXPForLevels(prestige, 1, clampedLevel - 1);
  
  // XP within this prestige tier
  const xpInPrestige = totalXP; // totalXP is tracked per-prestige in our system
  const xpSpentOnPreviousLevels = xpForPreviousLevels;
  const xpInCurrentLevel = Math.max(0, xpInPrestige - xpSpentOnPreviousLevels);
  
  const levelProgress = Math.min(100, (xpInCurrentLevel / xpForCurrentLevel) * 100);
  
  return {
    prestige,
    ranking,
    level: clampedLevel,
    xpInCurrentLevel,
    xpRequiredForNextLevel: xpForCurrentLevel,
    levelProgress,
    displayString: `${PRESTIGE_NAMES[prestige]} - ${RANKING_NAMES[ranking]} - Level ${clampedLevel}`,
  };
}

/**
 * Calculate total XP needed to reach a specific level from level 1
 */
function calculateXPForLevels(prestige: Prestige, startLevel: number, endLevel: number): number {
  let total = 0;
  for (let level = startLevel; level <= endLevel; level++) {
    total += getXPRequiredForLevel(prestige, level);
  }
  return total;
}

// =====================================================
// Experience Level to Prestige Mapping (Onboarding)
// =====================================================

export function experienceLevelToPrestige(experienceLevel: string): Prestige {
  const mapping: Record<string, Prestige> = {
    'complete_beginner': 'rookie',
    'beginner': 'beginner',
    'intermediate': 'intermediate',
    'advanced': 'advanced',
    'pro': 'pro',
  };
  return mapping[experienceLevel] || 'rookie';
}

// =====================================================
// Activity XP Rates (per second)
// =====================================================

export type ActivityType = 'shadowboxing' | 'combo' | 'jump_rope' | 'running' | 'rest' | 'active';

export const ACTIVITY_XP_RATES: Record<ActivityType, number> = {
  shadowboxing: 0.33,
  combo: 0.33, // Base rate, combos have additional formula
  jump_rope: 0.20,
  running: 0.25,
  rest: 0.01,
  active: 0.25, // Default active rate
};

/**
 * Calculate XP for an activity segment
 */
export function calculateActivityXP(
  activityType: ActivityType,
  durationSeconds: number,
  combosLanded?: number
): number {
  let baseXP = ACTIVITY_XP_RATES[activityType] * durationSeconds;
  
  // Bonus XP for combos landed
  if (combosLanded && combosLanded > 0) {
    // Formula from doc: 0.5 XP per combo landed
    baseXP += combosLanded * 0.5;
  }
  
  return Math.round(baseXP);
}

// =====================================================
// Streak Multipliers
// =====================================================

export function getStreakMultiplier(streakDays: number): number {
  if (streakDays >= 100) return Math.min(3.0, 1.8 + (streakDays - 60) * 0.003); // Scales up to 3.0x cap
  if (streakDays >= 60) return 1.8;
  if (streakDays >= 30) return 1.6;
  if (streakDays >= 14) return 1.4;
  if (streakDays >= 7) return 1.25;
  if (streakDays >= 3) return 1.1;
  return 1.0;
}

// =====================================================
// Streak Milestone Bonuses
// =====================================================

export const STREAK_MILESTONES: Record<number, number> = {
  5: 500,
  10: 1500,
  15: 3000,
  20: 5000,
  30: 10000,
  45: 20000,
  60: 35000,
  90: 60000,
  120: 100000,
  180: 175000,
  365: 500000,
};

export function getStreakMilestoneBonus(streakDays: number): number {
  return STREAK_MILESTONES[streakDays] || 0;
}

// =====================================================
// Workout Completion Bonus
// =====================================================

/**
 * Calculate completion bonus (+10% for full workout with no skips)
 */
export function getCompletionBonus(baseXP: number, completedFully: boolean): number {
  return completedFully ? Math.round(baseXP * 0.1) : 0;
}

// =====================================================
// Level Up Check
// =====================================================

export interface LevelUpResult {
  didLevelUp: boolean;
  newLevel: number;
  newRanking: Ranking;
  didRankUp: boolean;
  prestigeComplete: boolean;
}

/**
 * Check if user leveled up based on XP gained
 */
export function checkLevelUp(
  prestige: Prestige,
  currentLevel: number,
  currentXP: number,
  xpGained: number
): LevelUpResult {
  const totalXP = currentXP + xpGained;
  let level = currentLevel;
  let xpRemaining = totalXP;
  
  // Calculate XP needed to reach next level from current
  while (level < 100) {
    const xpForLevel = getXPRequiredForLevel(prestige, level);
    const xpToNextLevel = calculateXPForLevels(prestige, 1, level);
    
    if (xpRemaining >= xpToNextLevel) {
      level++;
    } else {
      break;
    }
  }
  
  const newRanking = getRankingFromLevel(level);
  const oldRanking = getRankingFromLevel(currentLevel);
  
  return {
    didLevelUp: level > currentLevel,
    newLevel: level,
    newRanking,
    didRankUp: newRanking !== oldRanking,
    prestigeComplete: level >= 100,
  };
}

// =====================================================
// Calculate Level from Total XP
// =====================================================

/**
 * Calculate current level based on total XP earned within a prestige tier.
 * This is the inverse of the XP calculation - given XP, find the level.
 */
export function getLevelFromXP(prestige: Prestige, totalXP: number): number {
  let cumulativeXP = 0;
  
  for (let level = 1; level <= 100; level++) {
    cumulativeXP += getXPRequiredForLevel(prestige, level);
    if (totalXP < cumulativeXP) {
      return level;
    }
  }
  
  return 100; // Max level if XP exceeds all level requirements
}

/**
 * Get the XP earned within the current level (for progress bar calculations)
 */
export function getXPWithinCurrentLevel(prestige: Prestige, totalXP: number): { current: number; required: number } {
  let cumulativeXP = 0;
  
  for (let level = 1; level <= 100; level++) {
    const xpForThisLevel = getXPRequiredForLevel(prestige, level);
    if (totalXP < cumulativeXP + xpForThisLevel) {
      return {
        current: totalXP - cumulativeXP,
        required: xpForThisLevel,
      };
    }
    cumulativeXP += xpForThisLevel;
  }
  
  // At max level
  const xpForLevel100 = getXPRequiredForLevel(prestige, 100);
  return { current: xpForLevel100, required: xpForLevel100 };
}

// =====================================================
// Simple Level/XP Display Helpers
// =====================================================

/**
 * Get progress to next level as percentage (0-100)
 * Uses total XP to calculate position within current level
 */
export function getLevelProgress(prestige: Prestige, level: number, totalXP: number): number {
  const { current, required } = getXPWithinCurrentLevel(prestige, totalXP);
  return Math.min(100, (current / required) * 100);
}

/**
 * Get XP progress display string (e.g., "45 / 120 XP")
 */
export function getXPProgressString(prestige: Prestige, level: number, totalXP: number): string {
  const { current, required } = getXPWithinCurrentLevel(prestige, totalXP);
  return `${Math.floor(current).toLocaleString()} / ${required.toLocaleString()} XP`;
}
