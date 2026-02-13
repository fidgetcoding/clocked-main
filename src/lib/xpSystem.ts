// =====================================================
// Get Clocked XP System v1.0 — Complete Architecture
// All values from XP System Architecture v1.0 document
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

export const PRESTIGE_ORDER: Prestige[] = ['rookie', 'beginner', 'intermediate', 'advanced', 'pro'];
export const RANKING_ORDER: Ranking[] = [
  'prospect', 'scrapper', 'fighter', 'warrior', 'gladiator',
  'veteran', 'phenom', 'icon', 'apex', 'champion'
];

// =====================================================
// Level System — V1 Power Curves (Document Section 7)
// Formula: cost(level) = A × level^B
// =====================================================

interface TierCurve {
  A: number;
  B: number;
  totalL100: number; // Total XP for L1-L100
}

const TIER_CURVES: Record<Prestige, TierCurve> = {
  rookie:       { A: 142.70, B: 0.2000, totalL100: 30_000 },
  beginner:     { A: 149.31, B: 0.4261, totalL100: 75_000 },
  intermediate: { A: 243.88, B: 0.5139, totalL100: 173_000 },
  advanced:     { A: 443.04, B: 0.5185, totalL100: 320_000 },
  pro:          { A: 651.85, B: 0.5337, totalL100: 500_000 },
};

/**
 * XP cost for a single level within a prestige tier.
 * Uses power curve: cost = A × level^B, rounded to nearest integer.
 */
export function getXPRequiredForLevel(prestige: Prestige, level: number): number {
  const { A, B } = TIER_CURVES[prestige];
  return Math.round(A * Math.pow(level, B));
}

/**
 * Total XP needed to complete all 100 levels in a tier.
 */
export function getTotalXPForPrestige(prestige: Prestige): number {
  return TIER_CURVES[prestige].totalL100;
}

/**
 * Cumulative XP cost from level 1 through endLevel.
 */
function cumulativeXP(prestige: Prestige, endLevel: number): number {
  let total = 0;
  for (let l = 1; l <= endLevel; l++) {
    total += getXPRequiredForLevel(prestige, l);
  }
  return total;
}

/**
 * Calculate current level from total XP within a prestige tier.
 * Level is capped at 100.
 */
export function getLevelFromXP(prestige: Prestige, totalXP: number): number {
  let cumulative = 0;
  for (let level = 1; level <= 100; level++) {
    cumulative += getXPRequiredForLevel(prestige, level);
    if (totalXP < cumulative) return level;
  }
  return 100;
}

/**
 * Get XP progress within the current level (for progress bars).
 */
export function getXPWithinCurrentLevel(prestige: Prestige, totalXP: number): { current: number; required: number } {
  let cumulative = 0;
  for (let level = 1; level <= 100; level++) {
    const cost = getXPRequiredForLevel(prestige, level);
    if (totalXP < cumulative + cost) {
      return { current: totalXP - cumulative, required: cost };
    }
    cumulative += cost;
  }
  const lastCost = getXPRequiredForLevel(prestige, 100);
  return { current: lastCost, required: lastCost };
}

/**
 * Progress percentage to next level (0-100).
 */
export function getLevelProgress(prestige: Prestige, level: number, totalXP: number): number {
  const { current, required } = getXPWithinCurrentLevel(prestige, totalXP);
  return Math.min(100, (current / required) * 100);
}

/**
 * Display string: "450 / 1,200 XP"
 */
export function getXPProgressString(prestige: Prestige, level: number, totalXP: number): string {
  const { current, required } = getXPWithinCurrentLevel(prestige, totalXP);
  return `${Math.floor(current).toLocaleString()} / ${required.toLocaleString()} XP`;
}

// =====================================================
// Ranking Calculation
// =====================================================

export function getRankingFromLevel(level: number): Ranking {
  const clamped = Math.max(1, Math.min(100, level));
  const idx = Math.floor((clamped - 1) / 10);
  return RANKING_ORDER[idx];
}

export function getLevelRangeForRanking(ranking: Ranking): { min: number; max: number } {
  const index = RANKING_ORDER.indexOf(ranking);
  return { min: index * 10 + 1, max: (index + 1) * 10 };
}

// =====================================================
// Prestige ↔ Experience Level Mapping
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
// Gamification Status
// =====================================================

export interface UserGamificationStatus {
  prestige: Prestige;
  ranking: Ranking;
  level: number;
  xpInCurrentLevel: number;
  xpRequiredForNextLevel: number;
  levelProgress: number;
  displayString: string;
}

export function getGamificationStatus(
  prestige: Prestige, 
  level: number, 
  totalXP: number
): UserGamificationStatus {
  const clamped = Math.max(1, Math.min(100, level));
  const ranking = getRankingFromLevel(clamped);
  const { current, required } = getXPWithinCurrentLevel(prestige, totalXP);
  
  return {
    prestige,
    ranking,
    level: clamped,
    xpInCurrentLevel: current,
    xpRequiredForNextLevel: required,
    levelProgress: Math.min(100, (current / required) * 100),
    displayString: `${PRESTIGE_NAMES[prestige]} - ${RANKING_NAMES[ranking]} - Level ${clamped}`,
  };
}

// =====================================================
// Punch XP Values (Document Section 2.1) — 8 punches
// =====================================================

export const PUNCH_XP_VALUES: Record<string, number> = {
  '1': 5.5,   // Jab
  '2': 6.5,   // Cross
  '3': 7.5,   // Lead Hook
  '4': 8.0,   // Rear Hook
  '5': 8.5,   // Lead Uppercut
  '6': 9.5,   // Rear Uppercut
  '7': 11.0,  // Lead Body Hook
  '8': 11.0,  // Rear Body Hook
};

// =====================================================
// Defense XP Values (Document Section 2.2)
// =====================================================

export const DEFENSE_XP_VALUES: Record<string, number> = {
  'slip left': 4.5,
  'slip right': 4.5,
  'roll': 5.5,
  'pullback': 5.0,
  'circle left': 4.0,
  'circle right': 4.0,
};

// Lookup helpers for partial matching
const DEFENSE_KEYS = Object.keys(DEFENSE_XP_VALUES);

// =====================================================
// Exercise / Activity XP Rates (Document Section 2.3)
// =====================================================

export type ActivityType = 
  | 'pushups' | 'burpees' | 'curlups'
  | 'jump_rope' | 'treadmill'
  | 'jog_in_place' | 'jog'
  | 'rest' | 'freestyle' | 'bag_freestyle' | 'bag_combo_bonus'
  | 'shadowboxing' | 'combo'
  | 'active';

export const ACTIVITY_XP_RATES: Record<ActivityType, number> = {
  pushups:         0.22,
  burpees:         0.28,
  curlups:         0.18,
  jump_rope:       0.25,
  treadmill:       0.20,
  jog_in_place:    0.15,
  jog:             0.15,
  rest:            0.00,
  freestyle:       0.35,
  bag_freestyle:   0.40,
  bag_combo_bonus: 0.20,
  shadowboxing:    0.35, // Same as freestyle for shadow segments
  combo:           0.00, // Combos use the combo formula, not per-second
  active:          0.25, // Generic fallback
};

// =====================================================
// Combo XP Formula (Document Section 2.4)
// XP = (Sum of move base XP) × Length Bonus × Defense Bonus × (Duration / 30)
// =====================================================

/**
 * Length Bonus multiplier table.
 */
export function getComboLengthMultiplier(moveCount: number): number {
  if (moveCount >= 6) return 1.35;
  if (moveCount >= 5) return 1.20;
  if (moveCount >= 4) return 1.10;
  return 1.0;
}

/**
 * Defense Bonus multiplier table.
 */
export function getDefenseBonusMultiplier(defenseCount: number): number {
  if (defenseCount >= 3) return 1.45;
  if (defenseCount >= 2) return 1.30;
  if (defenseCount >= 1) return 1.15;
  return 1.0;
}

/**
 * Classify a move string and return its base XP + whether it's a defense move.
 */
function classifyMove(move: string): { xp: number; isDefense: boolean } {
  const lower = move.toLowerCase().trim();
  
  // Check punch numbers first
  if (PUNCH_XP_VALUES[lower]) {
    return { xp: PUNCH_XP_VALUES[lower], isDefense: false };
  }
  
  // Check exact defense matches
  for (const key of DEFENSE_KEYS) {
    if (lower === key || lower.includes(key)) {
      return { xp: DEFENSE_XP_VALUES[key], isDefense: true };
    }
  }
  
  // Partial defense matches (e.g., "slip l" → "slip left")
  if (lower.startsWith('slip')) return { xp: 4.5, isDefense: true };
  if (lower.startsWith('roll')) return { xp: 5.5, isDefense: true };
  if (lower.startsWith('pull')) return { xp: 5.0, isDefense: true };
  if (lower.startsWith('circle')) return { xp: 4.0, isDefense: true };
  
  return { xp: 0, isDefense: false };
}

/**
 * Calculate XP from a single combo execution.
 */
export function calculateComboXP(combo: string[], durationSeconds: number = 30): number {
  if (!combo || combo.length === 0) return 0;
  
  let baseMoveSum = 0;
  let defenseCount = 0;
  
  for (const move of combo) {
    const { xp, isDefense } = classifyMove(move);
    baseMoveSum += xp;
    if (isDefense) defenseCount++;
  }
  
  const lengthBonus = getComboLengthMultiplier(combo.length);
  const defenseBonus = getDefenseBonusMultiplier(defenseCount);
  const durationFactor = durationSeconds / 30;
  
  return baseMoveSum * lengthBonus * defenseBonus * durationFactor;
}

/**
 * Classify combo properties for badge tracking.
 */
export function classifyCombo(combo: string[]): {
  isComplex: boolean;    // 6+ moves
  isDefense: boolean;    // 2+ defense moves
  isCounter: boolean;    // Starts with a defense move
} {
  if (!combo || combo.length === 0) return { isComplex: false, isDefense: false, isCounter: false };
  
  let defenseCount = 0;
  const firstIsDefense = classifyMove(combo[0]).isDefense;
  
  for (const move of combo) {
    if (classifyMove(move).isDefense) defenseCount++;
  }
  
  return {
    isComplex: combo.length >= 6,
    isDefense: defenseCount >= 2,
    isCounter: firstIsDefense,
  };
}

/**
 * Calculate XP for a timed activity segment.
 */
export function calculateActivityXP(activityType: ActivityType, durationSeconds: number): number {
  return ACTIVITY_XP_RATES[activityType] * durationSeconds;
}

// =====================================================
// Championship Multiplier (Document Section 2.5)
// Final 2 rounds get 2x on boxing segments only
// =====================================================

export const CHAMPIONSHIP_MULTIPLIER = 2;

/**
 * Check if a round is a championship round.
 * Championship = final 2 rounds of the workout.
 */
export function isChampionshipRound(roundNumber: number, totalRounds: number): boolean {
  return roundNumber > totalRounds - 2;
}

// =====================================================
// Streak Multiplier System (Document Section 6)
// Applies to base session XP only, NOT badge XP
// =====================================================

export function getStreakMultiplier(consecutiveDays: number): number {
  if (consecutiveDays >= 100) return 2.0;
  if (consecutiveDays >= 60)  return 1.8;
  if (consecutiveDays >= 30)  return 1.6;
  if (consecutiveDays >= 14)  return 1.4;
  if (consecutiveDays >= 7)   return 1.25;
  if (consecutiveDays >= 3)   return 1.1;
  return 1.0;
}

export const STREAK_TIERS = [
  { min: 0,   max: 2,   multiplier: 1.0,  label: 'No Bonus' },
  { min: 3,   max: 6,   multiplier: 1.1,  label: '1.1x' },
  { min: 7,   max: 13,  multiplier: 1.25, label: '1.25x' },
  { min: 14,  max: 29,  multiplier: 1.4,  label: '1.4x' },
  { min: 30,  max: 59,  multiplier: 1.6,  label: '1.6x' },
  { min: 60,  max: 99,  multiplier: 1.8,  label: '1.8x' },
  { min: 100, max: 999, multiplier: 2.0,  label: '2.0x' },
];

// =====================================================
// Session XP Calculation Pipeline (Document Section 11.1)
// =====================================================

export interface SessionXPResult {
  baseXP: number;          // Raw workout segment XP
  streakMultiplier: number;
  streakBonus: number;     // baseXP × (mult - 1)
  effectiveBase: number;   // baseXP × streakMultiplier
  badgeXP: number;         // Sum of triggered badge XP rewards
  sessionTotal: number;    // effectiveBase + badgeXP
}

/**
 * Calculate final session XP given raw base XP, streak, and badge XP.
 * Order per doc Section 11.1:
 * 1. Calculate raw base XP
 * 2. Apply streak multiplier: effective_base = base × streak_mult
 * 3-5. (Badge checking happens externally)
 * 6. session_total = effective_base + badge_xp
 */
export function calculateSessionXP(
  baseXP: number,
  streakDays: number,
  badgeXP: number = 0
): SessionXPResult {
  const mult = getStreakMultiplier(streakDays);
  const streakBonus = Math.round(baseXP * (mult - 1));
  const effectiveBase = Math.round(baseXP * mult);
  
  return {
    baseXP: Math.round(baseXP),
    streakMultiplier: mult,
    streakBonus,
    effectiveBase,
    badgeXP,
    sessionTotal: effectiveBase + badgeXP,
  };
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

export function checkLevelUp(
  prestige: Prestige,
  currentLevel: number,
  currentXP: number,
  xpGained: number
): LevelUpResult {
  const newTotalXP = currentXP + xpGained;
  const newLevel = getLevelFromXP(prestige, newTotalXP);
  const newRanking = getRankingFromLevel(newLevel);
  const oldRanking = getRankingFromLevel(currentLevel);
  
  return {
    didLevelUp: newLevel > currentLevel,
    newLevel,
    newRanking,
    didRankUp: newRanking !== oldRanking,
    prestigeComplete: newLevel >= 100,
  };
}

// =====================================================
// Activity Name → ActivityType Mapper
// =====================================================

export function getActivityTypeFromName(name: string, segmentType?: string): ActivityType {
  const lower = name.toLowerCase();
  
  if (segmentType === 'rest' || lower.includes('rest')) return 'rest';
  if (segmentType === 'combo' || lower.includes('combo')) return 'combo';
  if (segmentType === 'shadowboxing') return 'shadowboxing';
  
  if (lower.includes('shadow') || lower.includes('freestyle')) return 'freestyle';
  if (lower.includes('bag freestyle') || lower.includes('bag work')) return 'bag_freestyle';
  if (lower.includes('jump rope') || lower.includes('skipping')) return 'jump_rope';
  if (lower.includes('treadmill')) return 'treadmill';
  if (lower.includes('jog in place')) return 'jog_in_place';
  if (lower.includes('jog') || lower.includes('run')) return 'jog';
  if (lower.includes('pushup') || lower.includes('push-up') || lower.includes('push up')) return 'pushups';
  if (lower.includes('curlup') || lower.includes('curl-up') || lower.includes('curl up') || lower.includes('sit-up') || lower.includes('situp')) return 'curlups';
  if (lower.includes('burpee')) return 'burpees';
  
  return 'active';
}

// =====================================================
// Prestige Thresholds (for reference)
// =====================================================

export function getPrestigeThresholds(): Record<Prestige, number> {
  return {
    rookie: 30_000,
    beginner: 75_000,
    intermediate: 173_000,
    advanced: 320_000,
    pro: 500_000,
  };
}

// =====================================================
// Prestige Promotion System (Document Section 10)
// =====================================================

/**
 * Get the next prestige tier, or null if at Pro (max).
 */
export function getNextPrestige(current: Prestige): Prestige | null {
  const idx = PRESTIGE_ORDER.indexOf(current);
  if (idx < 0 || idx >= PRESTIGE_ORDER.length - 1) return null;
  return PRESTIGE_ORDER[idx + 1];
}

/**
 * Check if a user has reached Level 100 in their current tier.
 * This makes them eligible to prestige (promote to next tier).
 * Pro users at L100 are at max — they cannot prestige further.
 */
export function isPrestigeEligible(prestige: Prestige, totalXP: number): boolean {
  if (prestige === 'pro') return false; // Pro is final tier
  const level = getLevelFromXP(prestige, totalXP);
  return level >= 100;
}

/**
 * Check if a user is at Pro L100 (max level in the game).
 */
export function isMaxLevel(prestige: Prestige, totalXP: number): boolean {
  return prestige === 'pro' && getLevelFromXP(prestige, totalXP) >= 100;
}

/**
 * Get what changes on prestige for display purposes.
 */
export function getPrestigeChanges(currentPrestige: Prestige): {
  nextTier: Prestige;
  nextTierName: string;
  currentTierName: string;
  newLevelCurve: TierCurve;
} | null {
  const next = getNextPrestige(currentPrestige);
  if (!next) return null;
  return {
    nextTier: next,
    nextTierName: PRESTIGE_NAMES[next],
    currentTierName: PRESTIGE_NAMES[currentPrestige],
    newLevelCurve: TIER_CURVES[next],
  };
}

// =====================================================
// Per-Session Cumulative Stats (Document Section 3.4)
// Conservative estimates for badge progress tracking
// =====================================================

export const PER_SESSION_ESTIMATES = {
  combosLanded: 150,
  pushups: 120,
  burpees: 15,
  curlups: 60,
  jogRunMinutes: 13,
  workoutDurationHours: 0.667,
};

// Tier-specific combo complexity stats per session (Section 3.5)
export const TIER_COMBO_STATS: Record<Prestige, { complex: number; defense: number; counter: number }> = {
  rookie:       { complex: 0,   defense: 0,   counter: 0 },
  beginner:     { complex: 0,   defense: 75,  counter: 15 },
  intermediate: { complex: 30,  defense: 105, counter: 30 },
  advanced:     { complex: 120, defense: 120, counter: 45 },
  pro:          { complex: 150, defense: 150, counter: 75 },
};
