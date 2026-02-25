import { describe, it, expect } from 'vitest';
import {
  generateCoachRecommendation,
  CoachRecommendation,
  ProfileData,
} from '@/lib/coachEngine';
import { WorkoutHistoryEntry } from '@/hooks/useWorkoutHistory';

// =====================================================
// Helpers
// =====================================================

function makeProfile(overrides: Partial<ProfileData> = {}): ProfileData {
  return {
    prestige: 'intermediate',
    current_level: 50,
    current_streak: 3,
    longest_streak: 10,
    workouts_completed: 15,
    total_training_seconds: 30000,
    experience_level: 'intermediate',
    equipment: { gloves: true, wraps: true, heavyBag: true, doubleEndBag: false, speedBag: false, jumpRope: true, treadmill: false },
    goals: [],
    last_workout_date: new Date(Date.now() - 86400000).toISOString().split('T')[0], // yesterday
    comeback_count: 0,
    double_days: 0,
    morning_workouts: 5,
    night_workouts: 10,
    weekend_workouts: 4,
    weekday_workouts: 11,
    punch_1_count: 1000,
    punch_2_count: 1000,
    punch_3_count: 800,
    punch_4_count: 700,
    punch_5_count: 500,
    punch_6_count: 400,
    punch_7_count: 0,
    punch_8_count: 0,
    slips_count: 100,
    rolls_count: 80,
    pullbacks_count: 30,
    circles_count: 20,
    ...overrides,
  };
}

function makeHistory(
  count: number,
  overrides: Partial<WorkoutHistoryEntry> = {},
  daysBetween: number = 1,
): WorkoutHistoryEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `hist-${i}`,
    user_id: 'user-1',
    workout_id: null,
    workout_name: `Workout ${i}`,
    completed_at: new Date(Date.now() - i * daysBetween * 86400000).toISOString(),
    duration: 1200,
    xp_earned: 200,
    difficulty: 'just_right' as string | null,
    notes: null,
    is_manual_entry: false,
    round_feedback: [],
    created_at: new Date().toISOString(),
    ...overrides,
  }));
}

const NOW = new Date('2026-02-25T14:00:00Z'); // 2pm

// =====================================================
// CATEGORY A: DIFFICULTY CALIBRATION (Rule C1)
// =====================================================

describe('Category A: Difficulty Calibration (C1)', () => {
  it('A.1 — Too Easy Majority → Bump Up', () => {
    const history = makeHistory(10, { difficulty: 'too_easy' });
    // Set 3 to just_right
    history[7].difficulty = 'just_right';
    history[8].difficulty = 'just_right';
    history[9].difficulty = 'just_right';
    const profile = makeProfile({ prestige: 'intermediate' });
    const rec = generateCoachRecommendation(history, profile, NOW);
    expect(rec.suggestedDifficulty).toBe('advanced');
    expect(rec.suggestedRestDuration).toBeLessThanOrEqual(60);
  });

  it('A.2 — Too Hard Majority → Bump Down', () => {
    const history = makeHistory(10, { difficulty: 'too_hard' });
    history[6].difficulty = 'just_right';
    history[7].difficulty = 'just_right';
    history[8].difficulty = null;
    history[9].difficulty = null;
    const profile = makeProfile({ prestige: 'intermediate' });
    const rec = generateCoachRecommendation(history, profile, NOW);
    expect(rec.suggestedDifficulty).toBe('beginner');
  });

  it('A.3 — Just Right → Maintain', () => {
    const history = makeHistory(10, { difficulty: 'just_right' });
    const profile = makeProfile({ prestige: 'intermediate' });
    const rec = generateCoachRecommendation(history, profile, NOW);
    expect(rec.suggestedDifficulty).toBe('intermediate');
  });

  it('A.4 — No Difficulty Data → Use Profile', () => {
    const history = makeHistory(10, { difficulty: null });
    const profile = makeProfile({ prestige: 'advanced' });
    const rec = generateCoachRecommendation(history, profile, NOW);
    expect(rec.suggestedDifficulty).toBe('advanced');
    expect(rec.confidence).toBe('low');
  });

  it('A.5 — Tier Boundary Respect', () => {
    const history = makeHistory(10, { difficulty: 'too_easy' });
    // 8 too_easy, 2 just_right
    history[8].difficulty = 'just_right';
    history[9].difficulty = 'just_right';
    const profile = makeProfile({ prestige: 'advanced' });
    const rec = generateCoachRecommendation(history, profile, NOW);
    // Already at advanced max, should stay advanced but adjust rounds/rest
    expect(rec.suggestedDifficulty).toBe('advanced');
    expect(rec.suggestedRounds).toBeGreaterThanOrEqual(5);
  });
});

// =====================================================
// CATEGORY B: TREND DETECTION (Rule C2)
// =====================================================

describe('Category B: Trend Detection (C2)', () => {
  it('B.1 — Getting Easier Trend', () => {
    // First 5 harder, last 5 easier (chronologically first = older = higher index)
    const history = makeHistory(10, { difficulty: 'just_right' });
    // Oldest (higher index) = hard, newest (lower index) = easy
    for (let i = 5; i < 10; i++) history[i].difficulty = 'too_hard';
    for (let i = 0; i < 5; i++) history[i].difficulty = 'too_easy';
    const profile = makeProfile({ prestige: 'intermediate' });
    const rec = generateCoachRecommendation(history, profile, NOW);
    // Should push harder
    expect(rec.suggestedDifficulty).toBe('advanced');
  });

  it('B.2 — Getting Harder Trend', () => {
    const history = makeHistory(10, { difficulty: 'too_hard' });
    // Oldest sessions were easy, newest are hard → getting harder, majority too_hard
    for (let i = 7; i < 10; i++) history[i].difficulty = 'too_easy';
    // 7 too_hard (0-6), 3 too_easy (7-9) → C1 bumps down, C2 also detects trend
    const profile = makeProfile({ prestige: 'intermediate' });
    const rec = generateCoachRecommendation(history, profile, NOW);
    expect(rec.suggestedDifficulty).toBe('beginner');
  });

  it('B.3 — Insufficient Data for Trend', () => {
    const history = makeHistory(2, { difficulty: 'just_right' });
    const profile = makeProfile();
    const rec = generateCoachRecommendation(history, profile, NOW);
    // Should not crash, confidence low
    expect(rec.confidence).toBe('low');
  });
});

// =====================================================
// CATEGORY C: ROUND FEEDBACK (Rule C3)
// =====================================================

describe('Category C: Round Feedback (C3)', () => {
  it('C.1 — Weak Late Rounds', () => {
    const history = makeHistory(5, {
      difficulty: 'just_right',
      round_feedback: [
        { roundNumber: 1, rating: 5 },
        { roundNumber: 2, rating: 4 },
        { roundNumber: 3, rating: 4 },
        { roundNumber: 4, rating: 2 },
        { roundNumber: 5, rating: 1 },
      ],
    });
    const profile = makeProfile();
    const rec = generateCoachRecommendation(history, profile, NOW);
    // Should suggest shorter rounds or more rest
    expect(rec.suggestedRestDuration).toBeGreaterThanOrEqual(60);
  });

  it('C.2 — Strong Throughout', () => {
    const history = makeHistory(5, {
      difficulty: 'just_right',
      round_feedback: [
        { roundNumber: 1, rating: 5 },
        { roundNumber: 2, rating: 5 },
        { roundNumber: 3, rating: 4 },
      ],
    });
    const profile = makeProfile();
    const rec = generateCoachRecommendation(history, profile, NOW);
    expect(rec.suggestedRounds).toBeGreaterThanOrEqual(4);
  });
});

// =====================================================
// CATEGORY D: PUNCH DISTRIBUTION (Rule C4)
// =====================================================

describe('Category D: Punch Distribution (C4)', () => {
  it('D.1 — Jab-Cross Dominant', () => {
    const profile = makeProfile({
      prestige: 'intermediate',
      punch_1_count: 5000,
      punch_2_count: 4000,
      punch_3_count: 200,
      punch_4_count: 100,
      punch_5_count: 0,
      punch_6_count: 0,
    });
    const history = makeHistory(10, { difficulty: 'just_right' });
    const rec = generateCoachRecommendation(history, profile, NOW);
    expect(rec.punchEmphasis).toContain(5);
    expect(rec.punchEmphasis).toContain(6);
    expect(rec.focusAreas).toContain('variety');
  });

  it('D.2 — Balanced Distribution', () => {
    const profile = makeProfile({
      prestige: 'intermediate',
      punch_1_count: 1000,
      punch_2_count: 1000,
      punch_3_count: 900,
      punch_4_count: 800,
      punch_5_count: 700,
      punch_6_count: 600,
    });
    const history = makeHistory(10, { difficulty: 'just_right' });
    const rec = generateCoachRecommendation(history, profile, NOW);
    // Should not have many emphasized punches
    expect(rec.punchEmphasis.length).toBeLessThanOrEqual(1);
  });

  it('D.3 — Beginner With Limited Punches', () => {
    const profile = makeProfile({
      prestige: 'beginner',
      punch_1_count: 3000,
      punch_2_count: 2000,
      punch_3_count: 0,
      punch_4_count: 0,
      punch_5_count: 0,
      punch_6_count: 0,
    });
    const history = makeHistory(10, { difficulty: 'just_right' });
    const rec = generateCoachRecommendation(history, profile, NOW);
    // Should include 3, 4 (within beginner range 1-4)
    expect(rec.punchEmphasis).toContain(3);
    expect(rec.punchEmphasis).toContain(4);
    // Should NOT suggest 5-8
    expect(rec.punchEmphasis.every(p => p <= 4)).toBe(true);
  });
});

// =====================================================
// CATEGORY E: DEFENSE (Rule C5)
// =====================================================

describe('Category E: Defense (C5)', () => {
  it('E.1 — Zero Defense After 15 Workouts', () => {
    const profile = makeProfile({
      prestige: 'intermediate',
      workouts_completed: 15,
      slips_count: 0,
      rolls_count: 0,
      pullbacks_count: 0,
      circles_count: 0,
    });
    const history = makeHistory(15, { difficulty: 'just_right' });
    const rec = generateCoachRecommendation(history, profile, NOW);
    expect(rec.focusAreas).toContain('defense');
    expect(rec.includeDefenseInCombos).toBe(true);
    expect(rec.defenseEmphasis.length).toBeGreaterThan(0);
  });

  it('E.2 — Defense Exists But Low', () => {
    const profile = makeProfile({
      prestige: 'advanced',
      punch_1_count: 5000,
      punch_2_count: 5000,
      slips_count: 50,
      rolls_count: 30,
      pullbacks_count: 0,
      circles_count: 0,
    });
    const history = makeHistory(10, { difficulty: 'just_right' });
    const rec = generateCoachRecommendation(history, profile, NOW);
    // 80 defense vs 10000+ punches = < 1%
    expect(rec.focusAreas).toContain('defense');
  });

  it('E.3 — Beginner Tier → No Defense Push', () => {
    const profile = makeProfile({
      prestige: 'beginner',
      workouts_completed: 15,
      slips_count: 0,
      rolls_count: 0,
      pullbacks_count: 0,
      circles_count: 0,
    });
    const history = makeHistory(15, { difficulty: 'just_right' });
    const rec = generateCoachRecommendation(history, profile, NOW);
    expect(rec.focusAreas).not.toContain('defense');
    expect(rec.includeDefenseInCombos).toBe(false);
  });
});

// =====================================================
// CATEGORY F: RECOVERY (Rule C6)
// =====================================================

describe('Category F: Recovery (C6)', () => {
  it('F.1 — Same Day Double Session', () => {
    const today = NOW.toISOString().split('T')[0];
    const profile = makeProfile({ last_workout_date: today });
    const history = makeHistory(5, { difficulty: 'just_right' });
    const rec = generateCoachRecommendation(history, profile, NOW);
    expect(['shadowboxing', 'recovery']).toContain(rec.workoutType);
    expect(rec.focusAreas).toContain('recovery');
  });

  it('F.2 — 7+ Day Gap Comeback', () => {
    const tenDaysAgo = new Date(NOW.getTime() - 10 * 86400000).toISOString().split('T')[0];
    const profile = makeProfile({
      last_workout_date: tenDaysAgo,
      comeback_count: 2,
    });
    const history = makeHistory(5, { difficulty: 'just_right' });
    const rec = generateCoachRecommendation(history, profile, NOW);
    expect(rec.includeWarmup).toBe(true);
    // Difficulty should be lower than base
    expect(['beginner', 'intermediate']).toContain(rec.suggestedDifficulty);
  });

  it('F.3 — Normal Next Day', () => {
    const yesterday = new Date(NOW.getTime() - 86400000).toISOString().split('T')[0];
    const profile = makeProfile({ last_workout_date: yesterday });
    const history = makeHistory(5, { difficulty: 'just_right' });
    const rec = generateCoachRecommendation(history, profile, NOW);
    // No recovery adjustments
    expect(rec.focusAreas).not.toContain('recovery');
  });
});

// =====================================================
// CATEGORY G: TIME & CONTEXT (Rules C7, C8, C9)
// =====================================================

describe('Category G: Time & Context (C7, C8, C9)', () => {
  it('G.1 — Early Morning Session', () => {
    const morning = new Date('2026-02-25T06:30:00Z');
    const profile = makeProfile({ morning_workouts: 15 });
    const history = makeHistory(10, { difficulty: 'just_right' });
    const rec = generateCoachRecommendation(history, profile, morning);
    expect(rec.targetDuration).toBeLessThanOrEqual(20);
  });

  it('G.2 — Streak Protection at 14 Days', () => {
    const profile = makeProfile({ current_streak: 14 });
    const history = makeHistory(14, { difficulty: 'just_right' });
    const rec = generateCoachRecommendation(history, profile, NOW);
    expect(rec.focusAreas).toContain('recovery');
    expect(rec.suggestedRoundDuration).toBeLessThanOrEqual(180);
  });

  it('G.3 — Same Workout 4x In A Row', () => {
    const history = makeHistory(5, {
      difficulty: 'just_right',
      workout_name: 'Heavy Bag Blast',
    });
    const profile = makeProfile();
    const rec = generateCoachRecommendation(history, profile, NOW);
    expect(rec.focusAreas).toContain('variety');
  });
});

// =====================================================
// CATEGORY H: GOALS & NOTES (Rules C10, C11)
// =====================================================

describe('Category H: Goals & Notes (C10, C11)', () => {
  it('H.1 — Competition Goal', () => {
    const profile = makeProfile({
      prestige: 'advanced',
      goals: ['competition'],
    });
    const history = makeHistory(10, { difficulty: 'just_right' });
    const rec = generateCoachRecommendation(history, profile, NOW);
    expect(rec.suggestedRoundDuration).toBe(180);
    expect(rec.suggestedRestDuration).toBeLessThanOrEqual(60);
    expect(rec.focusAreas).toContain('defense');
  });

  it('H.2 — Notes Mention Soreness', () => {
    const history = makeHistory(5, { difficulty: 'just_right' });
    history[0].notes = 'right shoulder is sore';
    const profile = makeProfile();
    const rec = generateCoachRecommendation(history, profile, NOW);
    expect(rec.workoutType).toBe('shadowboxing');
  });

  it('H.3 — Home Workout Goal + No Equipment', () => {
    const profile = makeProfile({
      goals: ['home_workout'],
      equipment: { gloves: true, wraps: true, heavyBag: false, doubleEndBag: false, speedBag: false, jumpRope: false, treadmill: false },
    });
    const history = makeHistory(10, { difficulty: 'just_right' });
    const rec = generateCoachRecommendation(history, profile, NOW);
    expect(rec.workoutType).toBe('shadowboxing');
    expect(rec.equipmentToUse).toContain('shadowboxing');
    expect(rec.equipmentToUse).not.toContain('heavyBag');
  });
});

// =====================================================
// CATEGORY I: CONFIDENCE & EDGE CASES (Rule C12)
// =====================================================

describe('Category I: Confidence & Edge Cases (C12)', () => {
  it('I.1 — High Confidence', () => {
    const history = makeHistory(15, { difficulty: 'just_right' });
    const profile = makeProfile({
      last_workout_date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
    });
    const rec = generateCoachRecommendation(history, profile, NOW);
    expect(rec.confidence).toBe('high');
    expect(rec.dataPointsUsed).toBe(15);
  });

  it('I.2 — Low Confidence', () => {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];
    const history = makeHistory(1, { difficulty: null });
    const profile = makeProfile({
      last_workout_date: fourteenDaysAgo,
    });
    const rec = generateCoachRecommendation(history, profile, NOW);
    expect(rec.confidence).toBe('low');
  });

  it('I.3 — Zero History', () => {
    const profile = makeProfile({ experience_level: 'beginner' });
    const rec = generateCoachRecommendation([], profile, NOW);
    expect(rec.isDefault).toBe(true);
    expect(rec.confidence).toBe('low');
    expect(rec.suggestedDifficulty).toBe('beginner');
    expect(rec.encouragement).toBeTruthy();
  });
});
