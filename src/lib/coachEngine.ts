// =====================================================
// KOI Coach Agent — Deterministic Recommendation Engine V1
// 12 Coach Rules for personalized workout recommendations
// =====================================================

import { WorkoutHistoryEntry } from '@/hooks/useWorkoutHistory';
import { analyzeWorkoutHistory, HistoryInsights } from './workoutHistoryAnalysis';

// =====================================================
// Types
// =====================================================

export type FocusArea =
  | 'power'
  | 'speed'
  | 'defense'
  | 'body_work'
  | 'footwork'
  | 'endurance'
  | 'technique'
  | 'variety'
  | 'conditioning'
  | 'recovery';

export interface CoachRecommendation {
  workoutType: 'boxing' | 'shadowboxing' | 'conditioning' | 'recovery' | 'mixed';
  suggestedDifficulty: 'beginner' | 'intermediate' | 'advanced';
  suggestedRounds: number;
  suggestedRoundDuration: number; // seconds
  suggestedRestDuration: number;  // seconds
  includeWarmup: boolean;
  includeCooldown: boolean;
  targetDuration: number; // minutes

  focusAreas: FocusArea[];
  punchEmphasis: number[];
  defenseEmphasis: string[];
  equipmentToUse: string[];

  comboComplexity: 'simple' | 'moderate' | 'complex';
  comboLengthRange: [number, number];
  includeDefenseInCombos: boolean;
  suggestedComboExamples?: string[][];

  headline: string;
  reasoning: string;
  encouragement: string;

  confidence: 'high' | 'medium' | 'low';
  dataPointsUsed: number;
  generatedAt: string;
  isDefault?: boolean;
}

export interface ProfileData {
  prestige: string | null;
  current_level: number | null;
  current_streak: number;
  longest_streak: number;
  workouts_completed: number;
  total_training_seconds: number | null;
  experience_level: string | null;
  equipment: Record<string, boolean | string> | null;
  goals: string[] | null;
  last_workout_date: string | null;
  comeback_count: number;
  double_days: number;
  morning_workouts: number;
  night_workouts: number;
  weekend_workouts: number;
  weekday_workouts: number;
  punch_1_count: number;
  punch_2_count: number;
  punch_3_count: number;
  punch_4_count: number;
  punch_5_count: number;
  punch_6_count: number;
  punch_7_count: number;
  punch_8_count: number;
  slips_count: number;
  rolls_count: number;
  pullbacks_count: number;
  circles_count: number;
}

// =====================================================
// Constants
// =====================================================

const DIFFICULTY_TIERS = ['beginner', 'intermediate', 'advanced'] as const;

const TIER_PUNCH_LIMITS: Record<string, number> = {
  rookie: 4, beginner: 4, intermediate: 6, advanced: 8, pro: 8,
};

const TIER_ALLOWS_DEFENSE: Record<string, boolean> = {
  rookie: false, beginner: false, intermediate: true, advanced: true, pro: true,
};

// =====================================================
// Main Entry Point
// =====================================================

export function generateCoachRecommendation(
  history: WorkoutHistoryEntry[],
  profile: ProfileData,
  currentTime?: Date,
): CoachRecommendation {
  const now = currentTime || new Date();
  const insights = analyzeWorkoutHistory(history, 10);
  const tier = profile.prestige || profile.experience_level || 'beginner';

  // Start with base recommendation
  const rec: CoachRecommendation = {
    workoutType: 'boxing',
    suggestedDifficulty: mapTierToDifficulty(tier),
    suggestedRounds: 4,
    suggestedRoundDuration: 180,
    suggestedRestDuration: 60,
    includeWarmup: true,
    includeCooldown: true,
    targetDuration: 25,
    focusAreas: [],
    punchEmphasis: [],
    defenseEmphasis: [],
    equipmentToUse: [],
    comboComplexity: 'moderate',
    comboLengthRange: [3, 5],
    includeDefenseInCombos: false,
    headline: '',
    reasoning: '',
    encouragement: '',
    confidence: 'medium',
    dataPointsUsed: history.length,
    generatedAt: now.toISOString(),
  };

  // Zero history → default
  if (history.length === 0) {
    return applyZeroHistory(rec, profile);
  }

  // Apply Rules C1-C12
  applyC1DifficultyCalibration(rec, history, insights, tier);
  applyC2TrendDetection(rec, insights);
  applyC3RoundFeedback(rec, insights);
  applyC4PunchDistribution(rec, profile, tier);
  applyC5DefenseNeglect(rec, profile, tier);
  applyC6Recovery(rec, profile, now);
  applyC7TimeOfDay(rec, profile, now);
  applyC8StreakProtection(rec, profile);
  applyC9WorkoutVariety(rec, history);
  applyC10GoalAlignment(rec, profile);
  applyC11NotesParsing(rec, history);
  applyC12Confidence(rec, history, profile);

  // Set equipment
  applyEquipmentConstraints(rec, profile);

  // Set combo guidance based on difficulty
  applyComboGuidance(rec, tier);

  // Generate messaging
  generateMessaging(rec, history, profile, insights);

  // Validate ranges
  rec.suggestedRounds = clamp(rec.suggestedRounds, 3, 12);
  rec.suggestedRoundDuration = clamp(rec.suggestedRoundDuration, 60, 300);
  rec.suggestedRestDuration = clamp(rec.suggestedRestDuration, 15, 120);
  rec.targetDuration = clamp(rec.targetDuration, 10, 60);

  return rec;
}

// =====================================================
// Rule Implementations
// =====================================================

/** C1: Difficulty Calibration */
function applyC1DifficultyCalibration(
  rec: CoachRecommendation,
  history: WorkoutHistoryEntry[],
  insights: HistoryInsights,
  tier: string,
) {
  const recent = history.slice(0, 10);
  const withDifficulty = recent.filter(w => w.difficulty);

  if (withDifficulty.length === 0) {
    // No data — use profile tier as-is
    return;
  }

  const tooEasy = withDifficulty.filter(w => w.difficulty === 'too_easy').length;
  const tooHard = withDifficulty.filter(w => w.difficulty === 'too_hard').length;
  const total = withDifficulty.length;

  if (tooEasy / total >= 0.5) {
    rec.suggestedDifficulty = bumpDifficulty(rec.suggestedDifficulty, 1);
    rec.suggestedRestDuration = Math.round(rec.suggestedRestDuration * 0.9);
  } else if (tooHard / total >= 0.5) {
    rec.suggestedDifficulty = bumpDifficulty(rec.suggestedDifficulty, -1);
    rec.suggestedRestDuration = Math.round(rec.suggestedRestDuration * 1.2);
  }

  // Tier boundary: if already at max and still too easy, adjust rounds/rest instead
  const maxDiff = mapTierToDifficulty(tier);
  if (rec.suggestedDifficulty === maxDiff && tooEasy / total >= 0.5) {
    if (maxDiff === 'advanced') {
      rec.suggestedRounds = Math.min(rec.suggestedRounds + 1, 12);
      rec.suggestedRestDuration = Math.round(rec.suggestedRestDuration * 0.85);
    }
  }
}

/** C2: Trend Detection */
function applyC2TrendDetection(rec: CoachRecommendation, insights: HistoryInsights) {
  if (!insights.recentTrend) return;

  if (insights.recentTrend === 'getting_easier') {
    rec.suggestedDifficulty = bumpDifficulty(rec.suggestedDifficulty, 1);
  } else if (insights.recentTrend === 'getting_harder') {
    rec.suggestedDifficulty = bumpDifficulty(rec.suggestedDifficulty, -1);
    if (!rec.focusAreas.includes('recovery')) {
      rec.focusAreas.push('recovery');
    }
  }
}

/** C3: Round Feedback Analysis */
function applyC3RoundFeedback(rec: CoachRecommendation, insights: HistoryInsights) {
  if (insights.weakRounds.length === 0 && insights.strongRounds.length === 0) return;

  // Late weak rounds → shorter rounds or more rest
  const maxWeak = insights.weakRounds.length > 0 ? Math.max(...insights.weakRounds) : 0;
  if (maxWeak >= 4) {
    rec.suggestedRoundDuration = Math.max(120, rec.suggestedRoundDuration - 30);
    rec.suggestedRestDuration = Math.min(120, rec.suggestedRestDuration + 15);
  }

  // Early weak rounds → longer warmup
  const minWeak = insights.weakRounds.length > 0 ? Math.min(...insights.weakRounds) : Infinity;
  if (minWeak <= 2 && insights.weakRounds.length > 0) {
    rec.includeWarmup = true;
  }

  // All strong → push harder
  if (insights.strongRounds.length >= 3 && insights.weakRounds.length === 0) {
    rec.suggestedRounds = Math.min(12, rec.suggestedRounds + 1);
  }
}

/** C4: Punch Distribution Balancing */
export function applyC4PunchDistribution(
  rec: CoachRecommendation,
  profile: ProfileData,
  tier: string,
) {
  const punchCounts = [
    profile.punch_1_count, profile.punch_2_count,
    profile.punch_3_count, profile.punch_4_count,
    profile.punch_5_count, profile.punch_6_count,
    profile.punch_7_count, profile.punch_8_count,
  ];

  const maxPunch = TIER_PUNCH_LIMITS[tier] || 4;
  const tierPunches = punchCounts.slice(0, maxPunch);
  const total = tierPunches.reduce((a, b) => a + b, 0);

  if (total === 0) return;

  const emphasis: number[] = [];
  for (let i = 0; i < maxPunch; i++) {
    const pct = tierPunches[i] / total;
    if (pct < 0.05) {
      emphasis.push(i + 1);
    }
  }

  // Check over-reliance (>35%)
  const overUsed = tierPunches.some(p => p / total > 0.35);
  if (overUsed || emphasis.length > 0) {
    if (!rec.focusAreas.includes('variety')) {
      rec.focusAreas.push('variety');
    }
  }

  rec.punchEmphasis = emphasis;
}

/** C5: Defense Neglect Detection */
export function applyC5DefenseNeglect(
  rec: CoachRecommendation,
  profile: ProfileData,
  tier: string,
) {
  if (!TIER_ALLOWS_DEFENSE[tier]) return; // Beginners don't get defense

  const totalDefense = profile.slips_count + profile.rolls_count + profile.pullbacks_count + profile.circles_count;
  const totalPunches = profile.punch_1_count + profile.punch_2_count + profile.punch_3_count +
    profile.punch_4_count + profile.punch_5_count + profile.punch_6_count +
    profile.punch_7_count + profile.punch_8_count;
  const totalMoves = totalPunches + totalDefense;

  if (profile.workouts_completed >= 10 && totalDefense === 0) {
    rec.focusAreas.push('defense');
    rec.includeDefenseInCombos = true;
    rec.defenseEmphasis = ['SLIP L', 'ROLL R'];
  } else if (totalMoves > 0 && totalDefense / totalMoves < 0.1) {
    rec.focusAreas.push('defense');
    rec.includeDefenseInCombos = true;
    rec.defenseEmphasis = ['SLIP L', 'ROLL R'];
  }

  // Advanced gets everything
  if (tier === 'advanced' || tier === 'pro') {
    if (rec.defenseEmphasis.length > 0) {
      rec.defenseEmphasis = ['SLIP L', 'SLIP R', 'ROLL L', 'ROLL R', 'PULL'];
    }
  }
}

/** C6: Recovery & Fatigue Awareness */
export function applyC6Recovery(
  rec: CoachRecommendation,
  profile: ProfileData,
  now: Date,
) {
  if (!profile.last_workout_date) return;

  const lastDate = new Date(profile.last_workout_date);
  const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSince === 0) {
    // Same day — light session
    rec.workoutType = 'shadowboxing';
    rec.suggestedDifficulty = bumpDifficulty(rec.suggestedDifficulty, -1);
    rec.suggestedRounds = Math.max(3, rec.suggestedRounds - 1);
    if (!rec.focusAreas.includes('recovery')) rec.focusAreas.push('recovery');
  } else if (daysSince >= 7) {
    // Comeback
    rec.suggestedDifficulty = bumpDifficulty(rec.suggestedDifficulty, -1);
    rec.includeWarmup = true;
    rec.includeCooldown = true;
    rec.confidence = 'medium';
  } else if (daysSince >= 4) {
    // Returning from break
    rec.includeWarmup = true;
  }
}

/** C7: Time-of-Day Awareness */
export function applyC7TimeOfDay(
  rec: CoachRecommendation,
  profile: ProfileData,
  now: Date,
) {
  const hour = now.getHours();

  if (hour >= 5 && hour < 10) {
    // Morning — shorter, higher intensity
    rec.targetDuration = Math.min(rec.targetDuration, 20);
    rec.suggestedRounds = Math.min(rec.suggestedRounds, 5);
    if (!rec.focusAreas.includes('speed')) rec.focusAreas.push('speed');
  } else if (hour >= 21) {
    // Late night — lighter
    rec.suggestedDifficulty = bumpDifficulty(rec.suggestedDifficulty, -1);
    if (!rec.focusAreas.includes('recovery')) rec.focusAreas.push('recovery');
  }
  // Evening (17-21) allows longer sessions — no cap
}

/** C8: Streak Protection */
export function applyC8StreakProtection(
  rec: CoachRecommendation,
  profile: ProfileData,
) {
  if (profile.current_streak >= 14) {
    // Long streak — suggest lighter day occasionally
    if (!rec.focusAreas.includes('recovery')) rec.focusAreas.push('recovery');
    rec.suggestedRoundDuration = Math.min(rec.suggestedRoundDuration, 180);
  } else if (profile.current_streak >= 7) {
    // Protect momentum — favor 'just right'
    rec.suggestedRoundDuration = Math.min(rec.suggestedRoundDuration, 180);
  }

  if (profile.current_streak === 0 && profile.comeback_count > 0) {
    // Frequent streak-breaker — shorter achievable sessions
    rec.suggestedRounds = Math.min(rec.suggestedRounds, 4);
    rec.targetDuration = Math.min(rec.targetDuration, 20);
  }
}

/** C9: Workout Variety */
export function applyC9WorkoutVariety(
  rec: CoachRecommendation,
  history: WorkoutHistoryEntry[],
) {
  const last5 = history.slice(0, 5);
  if (last5.length < 3) return;

  // Check if same workout name repeated
  const names = last5.map(w => w.workout_name);
  const mostCommon = mode(names);
  const repeatCount = names.filter(n => n === mostCommon).length;

  if (repeatCount >= 3) {
    if (!rec.focusAreas.includes('variety')) rec.focusAreas.push('variety');
    // Suggest different type
    if (rec.workoutType === 'boxing') {
      rec.workoutType = 'mixed';
    }
  }
}

/** C10: Goal Alignment */
export function applyC10GoalAlignment(
  rec: CoachRecommendation,
  profile: ProfileData,
) {
  const goals = profile.goals || [];

  if (goals.includes('learn_boxing')) {
    if (!rec.focusAreas.includes('technique')) rec.focusAreas.push('technique');
    rec.includeWarmup = true;
    rec.includeCooldown = true;
  }

  if (goals.includes('get_fit')) {
    if (!rec.focusAreas.includes('conditioning')) rec.focusAreas.push('conditioning');
    rec.suggestedRestDuration = Math.max(15, rec.suggestedRestDuration - 15);
  }

  if (goals.includes('competition')) {
    rec.suggestedRoundDuration = 180;
    rec.suggestedRestDuration = 60;
    if (!rec.focusAreas.includes('defense')) rec.focusAreas.push('defense');
  }

  if (goals.includes('home_workout')) {
    // Respect equipment
    if (!profile.equipment?.heavyBag && !profile.equipment?.doubleEndBag) {
      rec.workoutType = 'shadowboxing';
    }
  }

  if (goals.includes('supplement_training')) {
    rec.targetDuration = Math.min(rec.targetDuration, 20);
    rec.suggestedRounds = Math.min(rec.suggestedRounds, 4);
  }
}

/** C11: Notes Parsing (keyword matching V1) */
export function applyC11NotesParsing(
  rec: CoachRecommendation,
  history: WorkoutHistoryEntry[],
) {
  const recentNotes = history.slice(0, 5)
    .map(w => w.notes)
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!recentNotes) return;

  // Fatigue keywords
  const fatigueWords = ['tired', 'sore', 'beat', 'exhausted', 'rough'];
  if (fatigueWords.some(w => recentNotes.includes(w))) {
    rec.suggestedDifficulty = bumpDifficulty(rec.suggestedDifficulty, -1);
    rec.suggestedRestDuration = Math.min(120, rec.suggestedRestDuration + 15);
  }

  // Injury keywords
  const injuryWords = ['shoulder', 'wrist', 'knee', 'back', 'hurt', 'pain'];
  if (injuryWords.some(w => recentNotes.includes(w))) {
    rec.workoutType = 'shadowboxing';
    rec.suggestedDifficulty = bumpDifficulty(rec.suggestedDifficulty, -1);
  }

  // Request keywords
  if (recentNotes.includes('more defense') || recentNotes.includes('defense')) {
    if (!rec.focusAreas.includes('defense')) rec.focusAreas.push('defense');
  }
  if (recentNotes.includes('body shots') || recentNotes.includes('body work')) {
    if (!rec.focusAreas.includes('body_work')) rec.focusAreas.push('body_work');
  }
  if (recentNotes.includes('footwork')) {
    if (!rec.focusAreas.includes('footwork')) rec.focusAreas.push('footwork');
  }

  // Positive keywords
  const positiveWords = ['great', 'easy', 'loved it', 'crushed it'];
  if (positiveWords.some(w => recentNotes.includes(w))) {
    rec.suggestedDifficulty = bumpDifficulty(rec.suggestedDifficulty, 1);
  }
}

/** C12: Confidence Scoring */
export function applyC12Confidence(
  rec: CoachRecommendation,
  history: WorkoutHistoryEntry[],
  profile: ProfileData,
) {
  const withDifficulty = history.filter(w => w.difficulty).length;

  if (!profile.last_workout_date) {
    rec.confidence = 'low';
    return;
  }

  const daysSinceLast = Math.floor(
    (new Date().getTime() - new Date(profile.last_workout_date).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (history.length >= 10 && withDifficulty >= 10 && daysSinceLast <= 7) {
    rec.confidence = 'high';
  } else if (history.length >= 3 && withDifficulty >= 1) {
    rec.confidence = 'medium';
  } else {
    rec.confidence = 'low';
  }
}

// =====================================================
// Equipment & Combo Guidance
// =====================================================

function applyEquipmentConstraints(rec: CoachRecommendation, profile: ProfileData) {
  const eq = profile.equipment || {};
  const available: string[] = [];

  if (eq.heavyBag) available.push('heavyBag');
  if (eq.doubleEndBag) available.push('doubleEndBag');
  if (eq.speedBag) available.push('speedBag');
  if (eq.jumpRope) available.push('jumpRope');

  // Always available
  available.push('shadowboxing');

  if (!eq.heavyBag && !eq.doubleEndBag) {
    rec.workoutType = 'shadowboxing';
  }

  rec.equipmentToUse = available;
}

function applyComboGuidance(rec: CoachRecommendation, tier: string) {
  switch (rec.suggestedDifficulty) {
    case 'beginner':
      rec.comboComplexity = 'simple';
      rec.comboLengthRange = [2, 3];
      break;
    case 'intermediate':
      rec.comboComplexity = 'moderate';
      rec.comboLengthRange = [3, 5];
      break;
    case 'advanced':
      rec.comboComplexity = 'complex';
      rec.comboLengthRange = [4, 7];
      break;
  }
}

// =====================================================
// Messaging
// =====================================================

function generateMessaging(
  rec: CoachRecommendation,
  history: WorkoutHistoryEntry[],
  profile: ProfileData,
  insights: HistoryInsights,
) {
  // Headline
  if (rec.focusAreas.includes('recovery')) {
    rec.headline = 'Welcome back — let\'s ease in';
  } else if (rec.focusAreas.includes('defense') && rec.focusAreas.includes('body_work')) {
    rec.headline = 'Time to level up — and work the body';
  } else if (rec.focusAreas.includes('defense')) {
    rec.headline = 'Let\'s sharpen your defense';
  } else if (rec.focusAreas.includes('body_work')) {
    rec.headline = 'Time to work the body';
  } else if (rec.focusAreas.includes('variety')) {
    rec.headline = 'Let\'s mix things up';
  } else if (rec.focusAreas.includes('speed')) {
    rec.headline = 'Quick morning burn';
  } else if (rec.focusAreas.includes('technique')) {
    rec.headline = 'Let\'s build your foundation';
  } else if (rec.suggestedDifficulty === 'advanced') {
    rec.headline = 'Time to push harder';
  } else {
    rec.headline = 'Your next session is ready';
  }

  // Reasoning — stored as array for bullet rendering
  const parts: string[] = [];
  if (insights.averageDifficulty === 'too_easy') {
    parts.push('Your recent sessions have been feeling too easy — time to push harder');
  } else if (insights.averageDifficulty === 'too_hard') {
    parts.push('Your last sessions were tough — dialing back for recovery');
  }
  if (rec.punchEmphasis.length > 0) {
    const punchNames: Record<number, string> = { 1: 'Jab', 2: 'Cross', 3: 'Lead Hook', 4: 'Rear Hook', 5: 'Lead Uppercut', 6: 'Rear Uppercut', 7: 'Lead Body', 8: 'Rear Body' };
    const names = rec.punchEmphasis.map(p => punchNames[p] || `Punch ${p}`).join(', ');
    parts.push(`You're underusing: ${names}`);
  }
  if (rec.focusAreas.includes('defense') && rec.includeDefenseInCombos) {
    parts.push('Adding defensive movement into your combos');
  }
  if (rec.focusAreas.includes('variety')) {
    parts.push('Mixing up your routine for well-rounded development');
  }
  if (rec.focusAreas.includes('recovery')) {
    parts.push('Keeping intensity manageable to protect your streak');
  }

  rec.reasoning = parts.length > 0
    ? parts.join('\n')
    : `Based on your last ${Math.min(history.length, 10)} sessions, this should be a good next step.`;

  // Encouragement
  if (profile.current_streak >= 7) {
    rec.encouragement = `You're on a ${profile.current_streak}-day streak — let's keep it going!`;
  } else if (profile.current_streak === 0 && profile.comeback_count > 0) {
    rec.encouragement = `You've come back ${profile.comeback_count} times before — that's what fighters do.`;
  } else if (history.length <= 2) {
    rec.encouragement = 'Complete a few more workouts and I\'ll have a much better sense of what works for you.';
  } else {
    rec.encouragement = 'Keep showing up — consistency beats intensity.';
  }
}

// =====================================================
// Zero-history default
// =====================================================

function applyZeroHistory(rec: CoachRecommendation, profile: ProfileData): CoachRecommendation {
  const tier = profile.experience_level || 'beginner';
  rec.suggestedDifficulty = mapTierToDifficulty(tier);
  rec.workoutType = 'shadowboxing';
  rec.suggestedRounds = 3;
  rec.suggestedRoundDuration = 120;
  rec.suggestedRestDuration = 60;
  rec.includeWarmup = true;
  rec.includeCooldown = true;
  rec.targetDuration = 15;
  rec.comboComplexity = 'simple';
  rec.comboLengthRange = [2, 3];
  rec.punchEmphasis = [1, 2];
  rec.focusAreas = ['technique'];
  rec.confidence = 'low';
  rec.isDefault = true;
  rec.headline = 'Let\'s build your foundation';
  rec.reasoning = 'You\'re just getting started — let\'s focus on technique with simple combos.';
  rec.encouragement = 'Complete 2 more workouts and I\'ll have a much better sense of what works for you.';

  applyEquipmentConstraints(rec, profile);
  return rec;
}

// =====================================================
// Prompt Conversion (for AI Builder integration)
// =====================================================

export function recommendationToPrompt(rec: CoachRecommendation): string {
  let prompt = `${rec.suggestedRounds} rounds`;

  if (rec.workoutType === 'boxing') prompt += ' heavy bag';
  else if (rec.workoutType === 'shadowboxing') prompt += ' shadowboxing';
  else if (rec.workoutType === 'conditioning') prompt += ' conditioning';
  else if (rec.workoutType === 'mixed') prompt += ' mixed';
  else if (rec.workoutType === 'recovery') prompt += ' light shadowboxing';

  prompt += `, ${rec.suggestedRoundDuration / 60} min rounds`;
  prompt += `, ${rec.suggestedRestDuration} sec rest`;
  prompt += `, ${rec.suggestedDifficulty} level`;

  if (rec.focusAreas.includes('body_work')) prompt += ', focus on body shots';
  if (rec.focusAreas.includes('defense')) prompt += ', include defensive movement';
  if (rec.focusAreas.includes('speed')) prompt += ', fast pace';
  if (rec.focusAreas.includes('conditioning')) prompt += ', include conditioning exercises';
  if (rec.focusAreas.includes('footwork')) prompt += ', emphasize footwork';
  if (rec.includeWarmup) prompt += ', include warmup';
  if (rec.includeCooldown) prompt += ', include cooldown';

  return prompt;
}

// =====================================================
// Utilities
// =====================================================

function mapTierToDifficulty(tier: string): 'beginner' | 'intermediate' | 'advanced' {
  if (tier === 'rookie' || tier === 'beginner' || tier === 'complete_beginner') return 'beginner';
  if (tier === 'intermediate') return 'intermediate';
  return 'advanced';
}

function bumpDifficulty(
  current: 'beginner' | 'intermediate' | 'advanced',
  delta: number,
): 'beginner' | 'intermediate' | 'advanced' {
  const idx = DIFFICULTY_TIERS.indexOf(current);
  const newIdx = clamp(idx + delta, 0, 2);
  return DIFFICULTY_TIERS[newIdx];
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function mode(arr: string[]): string {
  const freq: Record<string, number> = {};
  for (const item of arr) {
    freq[item] = (freq[item] || 0) + 1;
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}
