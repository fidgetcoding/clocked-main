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
// Activity XP Rates (per second) - From Document
// =====================================================

export type ActivityType = 
  | 'shadowboxing' 
  | 'combo' 
  | 'jump_rope' 
  | 'running' 
  | 'rest' 
  | 'active'
  | 'pushups'
  | 'curlups'
  | 'situps'
  | 'burpees'
  | 'squats'
  | 'pullups'
  | 'planks'
  | 'walking'
  | 'cycling'
  | 'jogging'
  | 'sparring'
  | 'stretching'
  | 'mitt_work';

// XP per second for each activity type (from documentation)
export const ACTIVITY_XP_RATES: Record<ActivityType, number> = {
  // Boxing-specific activities
  shadowboxing: 0.33,
  combo: 0.33,
  mitt_work: 0.30,
  sparring: 2.5, // Base rate - can go up to 5.0 for higher prestiges
  
  // Cardio activities
  jump_rope: 0.20,
  running: 0.25,
  jogging: 0.18,
  walking: 0.12,
  cycling: 0.20,
  
  // Strength/conditioning activities
  pushups: 0.22,
  curlups: 0.18,
  situps: 0.18,
  burpees: 0.22,
  squats: 0.22,
  pullups: 0.30,
  planks: 0.15,
  
  // Recovery
  rest: 0.01,
  stretching: 0.05, // 5 XP flat per stretch = ~0.05/sec for 100s
  
  // Default active rate
  active: 0.25,
};

/**
 * Get sparring XP rate adjusted by prestige tier
 * Sparring earns more XP at higher prestige levels
 */
export function getSparringXPRate(prestige: Prestige): number {
  const sparringRates: Record<Prestige, number> = {
    rookie: 2.5,
    beginner: 3.0,
    intermediate: 3.5,
    advanced: 4.0,
    pro: 5.0,
  };
  return sparringRates[prestige];
}

// =====================================================
// Combo XP Calculation (From Document)
// =====================================================

// Punch XP values
export const PUNCH_XP_VALUES: Record<string, number> = {
  '1': 5,      // Jab
  '2': 6.5,    // Cross
  '3': 8,      // Lead Hook
  '4': 8,      // Rear Hook
  '5': 9,      // Lead Uppercut
  '6': 9,      // Rear Uppercut
  '7': 10,     // Lead Body Hook
  '8': 10,     // Rear Body Hook
  '9': 11,     // Lead Body Uppercut
  '10': 11,    // Rear Body Uppercut
};

// Defense move XP values
export const DEFENSE_XP_VALUES: Record<string, number> = {
  'SLIP L': 7.25,
  'SLIP R': 7.25,
  'SLIP': 7.25,
  'DUCK': 8.5,
  'ROLL L': 9.5,
  'ROLL R': 9.5,
  'ROLL': 9.5,
  'PULL': 6.5,
  'BLOCK': 5.5,
  'PARRY': 7,
};

// Movement XP values
export const MOVEMENT_XP_VALUES: Record<string, number> = {
  'STEP IN': 4,
  'STEP OUT': 4,
  'CIRCLE L': 5,
  'CIRCLE R': 5,
  'PIVOT': 6,
};

/**
 * Get length multiplier based on combo length
 */
export function getComboLengthMultiplier(length: number): number {
  if (length >= 6) return 1.35;
  if (length >= 5) return 1.2;
  if (length >= 4) return 1.1;
  return 1.0;
}

/**
 * Get defense bonus multiplier based on number of defense moves in combo
 */
export function getDefenseBonusMultiplier(defenseCount: number): number {
  if (defenseCount >= 3) return 1.45;
  if (defenseCount >= 2) return 1.3;
  if (defenseCount >= 1) return 1.15;
  return 1.0;
}

/**
 * Check if a move is a defense move
 */
export function isDefenseMove(move: string): boolean {
  const upperMove = move.toUpperCase();
  return Object.keys(DEFENSE_XP_VALUES).some(defense => 
    upperMove.includes(defense.split(' ')[0]) // Match base defense name
  );
}

/**
 * Calculate XP earned from completing a combo
 * Formula: XP = (Base Move Sum) × (Length Bonus) × (Defense Bonus) × (Duration ÷ 30)
 */
export function calculateComboXP(combo: string[], durationSeconds: number = 30): number {
  if (!combo || combo.length === 0) return 0;
  
  // Calculate base move sum
  let baseMoveSum = 0;
  let defenseCount = 0;
  
  combo.forEach(move => {
    const upperMove = move.toUpperCase().trim();
    
    // Check punches first (1-8)
    if (PUNCH_XP_VALUES[upperMove]) {
      baseMoveSum += PUNCH_XP_VALUES[upperMove];
    }
    // Check defense moves
    else if (DEFENSE_XP_VALUES[upperMove]) {
      baseMoveSum += DEFENSE_XP_VALUES[upperMove];
      defenseCount++;
    }
    // Check movement
    else if (MOVEMENT_XP_VALUES[upperMove]) {
      baseMoveSum += MOVEMENT_XP_VALUES[upperMove];
    }
    // Partial match for defense (e.g., "SLIP L" matches "SLIP")
    else {
      for (const [defense, value] of Object.entries(DEFENSE_XP_VALUES)) {
        if (upperMove.includes(defense.split(' ')[0])) {
          baseMoveSum += value;
          defenseCount++;
          break;
        }
      }
      for (const [movement, value] of Object.entries(MOVEMENT_XP_VALUES)) {
        if (upperMove.includes(movement.split(' ')[0])) {
          baseMoveSum += value;
          break;
        }
      }
    }
  });
  
  // Apply multipliers
  const lengthMultiplier = getComboLengthMultiplier(combo.length);
  const defenseMultiplier = getDefenseBonusMultiplier(defenseCount);
  const durationMultiplier = durationSeconds / 30;
  
  const totalXP = baseMoveSum * lengthMultiplier * defenseMultiplier * durationMultiplier;
  
  return Math.round(totalXP);
}

/**
 * Calculate XP for an activity segment
 */
export function calculateActivityXP(
  activityType: ActivityType,
  durationSeconds: number,
  combosLanded?: number,
  combo?: string[]
): number {
  let baseXP = ACTIVITY_XP_RATES[activityType] * durationSeconds;
  
  // If it's a combo segment and we have combo data, use the combo formula
  if (activityType === 'combo' && combo && combo.length > 0) {
    baseXP = calculateComboXP(combo, durationSeconds);
  }
  
  // Bonus XP for combos landed (legacy support)
  if (combosLanded && combosLanded > 0) {
    baseXP += combosLanded * 0.5;
  }
  
  return Math.round(baseXP);
}

// =====================================================
// Streak Multipliers (From Document - Exact Values)
// =====================================================

export function getStreakMultiplier(streakDays: number): number {
  // Exact values from documentation
  if (streakDays >= 365) return 3.0;
  if (streakDays >= 300) return 2.75;
  if (streakDays >= 200) return 2.5;
  if (streakDays >= 150) return 2.25;
  if (streakDays >= 100) return 2.0;
  if (streakDays >= 60) return 1.8;
  if (streakDays >= 30) return 1.6;
  if (streakDays >= 14) return 1.4;
  if (streakDays >= 7) return 1.25;
  if (streakDays >= 3) return 1.1;
  return 1.0;
}

// =====================================================
// Streak Milestone Bonuses (From Document - Exact Values)
// =====================================================

export const STREAK_MILESTONES: Record<number, number> = {
  5: 500,
  10: 1500,
  15: 3000,
  20: 4000,      // Fixed: was 5000
  25: 6000,      // Added
  30: 10000,
  45: 20000,
  50: 25000,     // Added
  60: 35000,
  75: 50000,     // Added
  90: 60000,
  100: 35000,    // Fixed: was 100000 - doc says 35000
  120: 100000,
  150: 150000,   // Added
  180: 175000,
  200: 250000,   // Added
  250: 400000,   // Added
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

// =====================================================
// Activity Name to Type Mapping Helper
// =====================================================

/**
 * Map segment/activity name to ActivityType for XP calculation
 */
export function getActivityTypeFromName(name: string, segmentType?: string): ActivityType {
  const lowerName = name.toLowerCase();
  
  // Check segment type first
  if (segmentType === 'rest') return 'rest';
  if (segmentType === 'shadowboxing') return 'shadowboxing';
  if (segmentType === 'combo') return 'combo';
  
  // Boxing activities
  if (lowerName.includes('shadow')) return 'shadowboxing';
  if (lowerName.includes('combo')) return 'combo';
  if (lowerName.includes('mitt') || lowerName.includes('pad')) return 'mitt_work';
  if (lowerName.includes('spar')) return 'sparring';
  
  // Cardio
  if (lowerName.includes('jump rope') || lowerName.includes('skipping')) return 'jump_rope';
  if (lowerName.includes('running') || lowerName.includes('treadmill') || lowerName.includes('run')) return 'running';
  if (lowerName.includes('jog')) return 'jogging';
  if (lowerName.includes('walk')) return 'walking';
  if (lowerName.includes('cycl') || lowerName.includes('bike')) return 'cycling';
  
  // Strength/conditioning
  if (lowerName.includes('pushup') || lowerName.includes('push-up') || lowerName.includes('push up')) return 'pushups';
  if (lowerName.includes('curlup') || lowerName.includes('curl-up') || lowerName.includes('curl up')) return 'curlups';
  if (lowerName.includes('situp') || lowerName.includes('sit-up') || lowerName.includes('sit up')) return 'situps';
  if (lowerName.includes('burpee')) return 'burpees';
  if (lowerName.includes('squat')) return 'squats';
  if (lowerName.includes('pullup') || lowerName.includes('pull-up') || lowerName.includes('pull up') || lowerName.includes('chin')) return 'pullups';
  if (lowerName.includes('plank')) return 'planks';
  
  // Recovery
  if (lowerName.includes('rest')) return 'rest';
  if (lowerName.includes('stretch')) return 'stretching';
  
  // Default
  return 'active';
}
