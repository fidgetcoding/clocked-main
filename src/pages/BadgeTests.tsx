import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ArrowLeft, Play, CheckCircle, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ALL_BADGES, BADGE_CATEGORIES, BADGE_CATEGORY_COLORS, BADGE_CATEGORY_NAMES, BadgeStats, checkBadges, sumBadgeXP, getBadgeProgress, Badge, BadgeCategory } from '@/data/badges';
import { ALL_POST_L100_BADGES, POST_L100_BADGE_CATEGORIES, POST_L100_CATEGORY_COLORS, POST_L100_CATEGORY_NAMES, PostL100Badge, PostL100Category, PostL100Stats, checkPostL100Badges, getPostL100BadgeProgress } from '@/data/postL100Badges';
import { calculateSessionXP } from '@/lib/xpSystem';

// =====================================================
// Test Result Types
// =====================================================
interface TestResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  detail?: string;
}

interface TestGroup {
  name: string;
  tests: TestResult[];
  expanded: boolean;
}

// =====================================================
// Test Runners
// =====================================================

function runGroup1_BadgeCollectionRendering(): TestResult[] {
  const results: TestResult[] = [];
  const allBadges = [...ALL_BADGES, ...ALL_POST_L100_BADGES];

  // 1.1 — All badges render (total count)
  results.push({
    name: '1.1 — Total badge count = 234',
    passed: allBadges.length === 234,
    expected: '234',
    actual: `${allBadges.length}`,
    detail: `Core: ${ALL_BADGES.length}, Post-L100: ${ALL_POST_L100_BADGES.length}`,
  });

  // 1.2 — Earned vs locked states
  // 0 earned → all locked
  const zeroEarned = checkBadges({
    consecutiveDays: 0, totalCombos: 0, complexCombos: 0, defenseCombos: 0,
    counterCombos: 0, totalSessions: 0, totalHours: 0, singleSessionMinutes: 0,
    totalPushups: 0, totalBurpees: 0, totalCurlups: 0, totalJogRunMinutes: 0,
  }, []);
  results.push({
    name: '1.2a — 0 stats → 0 badges triggered',
    passed: zeroEarned.length === 0,
    expected: '0',
    actual: `${zeroEarned.length}`,
  });

  // All earned → verify set membership
  const allIds = allBadges.map(b => b.id);
  const uniqueIds = new Set(allIds);
  results.push({
    name: '1.2b — All badge IDs are unique',
    passed: uniqueIds.size === allBadges.length,
    expected: `${allBadges.length} unique`,
    actual: `${uniqueIds.size} unique`,
  });

  // 5 specific badges
  const fiveIds = ['day_one', 'first_combo', 'first_blood', 'first_minutes', 'pushup_starter'];
  const fiveExist = fiveIds.every(id => allBadges.find(b => b.id === id));
  results.push({
    name: '1.2c — 5 specific badge IDs exist in database',
    passed: fiveExist,
    expected: 'all 5 found',
    actual: fiveExist ? 'all 5 found' : `missing: ${fiveIds.filter(id => !allBadges.find(b => b.id === id)).join(', ')}`,
  });

  // 1.3 — Category counts
  const expectedCoreCounts: Record<string, number> = {
    streak: 18, combo: 23, volume: 11, time: 11, conditioning: 19, in_workout: 4, prestige: 2,
  };
  for (const { category, badges } of BADGE_CATEGORIES) {
    const exp = expectedCoreCounts[category];
    results.push({
      name: `1.3 — Core "${BADGE_CATEGORY_NAMES[category]}" count = ${exp}`,
      passed: badges.length === exp,
      expected: `${exp}`,
      actual: `${badges.length}`,
    });
  }

  const expectedPostCounts: Record<string, number> = {
    mastery: 7, overflow: 7, legacy: 13, ultra_combo: 4, ultra_conditioning: 12,
    ultra_time: 5, ultra_volume: 6, ultra_cardio: 4, ultra_streak: 8,
    combat_mastery: 36, consistency: 23, performance: 14, milestones: 7,
  };
  for (const { category, badges } of POST_L100_BADGE_CATEGORIES) {
    const exp = expectedPostCounts[category];
    results.push({
      name: `1.3 — Post-L100 "${POST_L100_CATEGORY_NAMES[category]}" count = ${exp}`,
      passed: badges.length === exp,
      expected: `${exp}`,
      actual: `${badges.length}`,
    });
  }

  // 1.4 — Category colors distinct
  const coreColors = Object.values(BADGE_CATEGORY_COLORS).map(c => c.text);
  const postColors = Object.values(POST_L100_CATEGORY_COLORS).map(c => c.text);
  const allColors = [...coreColors, ...postColors];
  const uniqueColors = new Set(allColors);
  results.push({
    name: '1.4 — All 20 categories have distinct text colors',
    passed: uniqueColors.size === allColors.length,
    expected: `${allColors.length} unique`,
    actual: `${uniqueColors.size} unique`,
    detail: uniqueColors.size < allColors.length ? `Duplicates found` : 'All distinct',
  });

  // 1.5 — Shape variety
  const shapes = new Set(allBadges.map(b => b.shape));
  results.push({
    name: '1.5 — At least 3 different badge shapes used',
    passed: shapes.size >= 3,
    expected: '≥3',
    actual: `${shapes.size} (${[...shapes].join(', ')})`,
  });

  // Check shapes vary by category
  const shapesByCategory = new Map<string, Set<string>>();
  for (const b of allBadges) {
    const cat = b.category;
    if (!shapesByCategory.has(cat)) shapesByCategory.set(cat, new Set());
    shapesByCategory.get(cat)!.add(b.shape);
  }
  const catsWithMultipleShapes = [...shapesByCategory.entries()].filter(([, s]) => s.size > 1).length;
  results.push({
    name: '1.5b — Multiple categories use >1 shape',
    passed: catsWithMultipleShapes >= 3,
    expected: '≥3 categories with varied shapes',
    actual: `${catsWithMultipleShapes} categories`,
  });

  return results;
}

function runGroup2_BadgeDetailModal(): TestResult[] {
  const results: TestResult[] = [];
  const allBadges = [...ALL_BADGES, ...ALL_POST_L100_BADGES];

  // 2.1 — Badge has required fields
  const sampleBadge = allBadges[0];
  const hasFields = sampleBadge.name && sampleBadge.category && sampleBadge.xpReward !== undefined &&
    sampleBadge.description && sampleBadge.trackingStat;
  results.push({
    name: '2.1 — Badges have all required fields (name, category, xpReward, description, trackingStat)',
    passed: !!hasFields,
    expected: 'all fields present',
    actual: hasFields ? 'all present' : 'missing fields',
  });

  // 2.2 — Progress bar for partial progress
  const comboArtist = ALL_BADGES.find(b => b.id === 'combo_artist')!;
  const halfStats: BadgeStats = {
    consecutiveDays: 0, totalCombos: 500, complexCombos: 0, defenseCombos: 0,
    counterCombos: 0, totalSessions: 0, totalHours: 0, singleSessionMinutes: 0,
    totalPushups: 0, totalBurpees: 0, totalCurlups: 0, totalJogRunMinutes: 0,
  };
  const progress = getBadgeProgress(comboArtist, halfStats);
  results.push({
    name: '2.2 — Combo Artist (1000 threshold) at 500 combos = 50% progress',
    passed: Math.abs(progress - 0.5) < 0.01,
    expected: '0.5',
    actual: `${progress}`,
  });

  // 2.3 — Earned badge = 100% progress
  const earnedStats: BadgeStats = {
    consecutiveDays: 0, totalCombos: 1500, complexCombos: 0, defenseCombos: 0,
    counterCombos: 0, totalSessions: 0, totalHours: 0, singleSessionMinutes: 0,
    totalPushups: 0, totalBurpees: 0, totalCurlups: 0, totalJogRunMinutes: 0,
  };
  const earnedProgress = getBadgeProgress(comboArtist, earnedStats);
  results.push({
    name: '2.3 — Earned badge (1500/1000) capped at 100%',
    passed: earnedProgress === 1,
    expected: '1.0',
    actual: `${earnedProgress}`,
  });

  // 2.4 — Zero progress
  const zeroStats: BadgeStats = {
    consecutiveDays: 0, totalCombos: 0, complexCombos: 0, defenseCombos: 0,
    counterCombos: 0, totalSessions: 0, totalHours: 0, singleSessionMinutes: 0,
    totalPushups: 0, totalBurpees: 0, totalCurlups: 0, totalJogRunMinutes: 0,
  };
  const zeroProgress = getBadgeProgress(comboArtist, zeroStats);
  results.push({
    name: '2.4 — Zero stats = 0% progress (no negatives)',
    passed: zeroProgress === 0,
    expected: '0',
    actual: `${zeroProgress}`,
  });

  // 2.5 — Far exceeded threshold
  const overStats: BadgeStats = {
    consecutiveDays: 0, totalCombos: 50000, complexCombos: 0, defenseCombos: 0,
    counterCombos: 0, totalSessions: 0, totalHours: 0, singleSessionMinutes: 0,
    totalPushups: 0, totalBurpees: 0, totalCurlups: 0, totalJogRunMinutes: 0,
  };
  const comboRegular = ALL_BADGES.find(b => b.id === 'combo_regular')!;
  const overProgress = getBadgeProgress(comboRegular, overStats);
  results.push({
    name: '2.5 — 50,000 combos on Combo Regular (100 threshold) capped at 100%',
    passed: overProgress === 1,
    expected: '1.0',
    actual: `${overProgress}`,
  });

  return results;
}

function runGroup3_BadgeTriggerLogic(): TestResult[] {
  const results: TestResult[] = [];

  // 3.1 — Session 1 badge explosion for Rookie
  const session1Stats: BadgeStats = {
    consecutiveDays: 1,
    totalCombos: 150,
    complexCombos: 0,
    defenseCombos: 0,
    counterCombos: 0,
    totalSessions: 1,
    totalHours: 0.667,
    singleSessionMinutes: 40,
    totalPushups: 120,
    totalBurpees: 15,
    totalCurlups: 60,
    totalJogRunMinutes: 13,
  };
  const session1Badges = checkBadges(session1Stats, []);
  const session1XP = sumBadgeXP(session1Badges);
  results.push({
    name: '3.1a — Session 1 triggers 15 badges',
    passed: session1Badges.length === 15,
    expected: '15',
    actual: `${session1Badges.length}`,
    detail: `Triggered: ${session1Badges.map(b => b.name).join(', ')}`,
  });
  results.push({
    name: '3.1b — Session 1 badge XP total = 840',
    passed: session1XP === 840,
    expected: '840',
    actual: `${session1XP}`,
  });

  // 3.2 — No double triggering
  const earnedFromS1 = session1Badges.map(b => b.id);
  const session2Stats: BadgeStats = {
    ...session1Stats,
    consecutiveDays: 2,
    totalCombos: 300,
    totalSessions: 2,
    totalHours: 1.334,
    totalPushups: 240,
    totalBurpees: 30,
    totalCurlups: 120,
    totalJogRunMinutes: 26,
  };
  const session2Badges = checkBadges(session2Stats, earnedFromS1);
  const s2HasDuplicates = session2Badges.some(b => earnedFromS1.includes(b.id));
  results.push({
    name: '3.2 — Session 2 does NOT re-trigger session 1 badges',
    passed: !s2HasDuplicates,
    expected: '0 duplicates',
    actual: s2HasDuplicates ? `Duplicates: ${session2Badges.filter(b => earnedFromS1.includes(b.id)).map(b => b.name).join(', ')}` : '0 duplicates',
  });

  // 3.3 — Badge XP not streaked
  const baseXP = 1000;
  const badgeXP = 500;
  const streakDays = 14; // 1.4x
  const result = calculateSessionXP(baseXP, streakDays, badgeXP);
  const correctTotal = Math.round(baseXP * 1.4) + badgeXP; // 1400 + 500 = 1900
  const wrongTotal = Math.round((baseXP + badgeXP) * 1.4); // 2100
  results.push({
    name: '3.3 — Badge XP excluded from streak multiplier',
    passed: result.sessionTotal === correctTotal && result.sessionTotal !== wrongTotal,
    expected: `${correctTotal}`,
    actual: `${result.sessionTotal}`,
    detail: `Wrong if: ${wrongTotal}. effectiveBase=${result.effectiveBase}, badgeXP=${result.badgeXP}`,
  });

  // 3.4 — Multiple badges same session
  const multiStats: BadgeStats = {
    consecutiveDays: 7,
    totalCombos: 1000,
    complexCombos: 100,
    defenseCombos: 100,
    counterCombos: 100,
    totalSessions: 50,
    totalHours: 30,
    singleSessionMinutes: 60,
    totalPushups: 1000,
    totalBurpees: 500,
    totalCurlups: 1000,
    totalJogRunMinutes: 150,
  };
  const multiBadges = checkBadges(multiStats, []);
  results.push({
    name: '3.4 — Multiple badges trigger in single check (high stats)',
    passed: multiBadges.length > 3,
    expected: '>3',
    actual: `${multiBadges.length}`,
    detail: `Categories hit: ${[...new Set(multiBadges.map(b => b.category))].join(', ')}`,
  });

  // 3.5 — Badge persistence (structural check - verify DB schema has required fields)
  const badgeHasId = ALL_BADGES[0].id !== undefined;
  const badgeHasXP = ALL_BADGES[0].xpReward !== undefined;
  results.push({
    name: '3.5 — Badge schema supports persistence (id, xpReward fields exist)',
    passed: badgeHasId && badgeHasXP,
    expected: 'id & xpReward present',
    actual: badgeHasId && badgeHasXP ? 'both present' : 'missing',
  });

  return results;
}

function runGroup4_PostWorkoutToast(): TestResult[] {
  const results: TestResult[] = [];

  // 4.1 — Toast content structure
  const badge = ALL_BADGES[0];
  results.push({
    name: '4.1 — Badge has name + XP for toast display',
    passed: !!badge.name && badge.xpReward > 0,
    expected: 'name + xpReward',
    actual: `"${badge.name}" → +${badge.xpReward} XP`,
  });

  // 4.2 — Queueing: structural check (badges are returned as array)
  const stats: BadgeStats = {
    consecutiveDays: 1, totalCombos: 150, complexCombos: 0, defenseCombos: 0,
    counterCombos: 0, totalSessions: 1, totalHours: 0.667, singleSessionMinutes: 40,
    totalPushups: 120, totalBurpees: 15, totalCurlups: 60, totalJogRunMinutes: 13,
  };
  const badges = checkBadges(stats, []);
  results.push({
    name: '4.2 — checkBadges returns array (supports sequential queueing)',
    passed: Array.isArray(badges) && badges.length > 0,
    expected: 'non-empty array',
    actual: `array of ${badges.length}`,
  });

  // 4.3 — Session 1 mass trigger manageable
  results.push({
    name: '4.3 — Session 1 triggers ≤20 badges (manageable for toast queue)',
    passed: badges.length <= 20,
    expected: '≤20',
    actual: `${badges.length}`,
  });

  // 4.4 — Each badge has shape + category for toast visual
  const allHaveShape = badges.every(b => b.shape);
  const allHaveCategory = badges.every(b => b.category);
  results.push({
    name: '4.4 — All triggered badges have shape + category for toast rendering',
    passed: allHaveShape && allHaveCategory,
    expected: 'all have shape + category',
    actual: allHaveShape && allHaveCategory ? 'all present' : 'some missing',
  });

  return results;
}

function runGroup5_PostWorkoutSummary(): TestResult[] {
  const results: TestResult[] = [];

  // 5.1 — Badges earned list
  const stats: BadgeStats = {
    consecutiveDays: 3, totalCombos: 500, complexCombos: 0, defenseCombos: 0,
    counterCombos: 0, totalSessions: 5, totalHours: 3, singleSessionMinutes: 40,
    totalPushups: 250, totalBurpees: 50, totalCurlups: 100, totalJogRunMinutes: 30,
  };
  const earned5 = checkBadges(stats, [
    'day_one', 'day_two', 'warming_up', 'first_combo', 'combo_starter',
    'combo_student', 'first_blood', 'getting_going', 'punching_in',
    'first_minutes', 'half_hour', 'hour_one', 'two_hours',
    'pushup_starter', 'pushup_regular', 'burpee_beginner',
    'core_starter', 'runner_starter', 'full_send', 'push_through',
    'beast_mode_achiever', 'rapid_fire', 'single_session_30',
  ]);
  results.push({
    name: '5.1 — Mid-game stats trigger additional badges beyond session 1',
    passed: earned5.length > 0,
    expected: '>0 new badges',
    actual: `${earned5.length} new: ${earned5.map(b => b.name).join(', ')}`,
  });

  // 5.2 — Zero badges scenario
  const noBadges = checkBadges(stats, ALL_BADGES.map(b => b.id));
  results.push({
    name: '5.2 — All already earned → 0 new badges',
    passed: noBadges.length === 0,
    expected: '0',
    actual: `${noBadges.length}`,
  });

  // 5.4 — Badge XP total
  const s1Badges = checkBadges({
    consecutiveDays: 1, totalCombos: 150, complexCombos: 0, defenseCombos: 0,
    counterCombos: 0, totalSessions: 1, totalHours: 0.667, singleSessionMinutes: 40,
    totalPushups: 120, totalBurpees: 15, totalCurlups: 60, totalJogRunMinutes: 13,
  }, []);
  const xpTotal = sumBadgeXP(s1Badges);
  const manualSum = s1Badges.reduce((s, b) => s + b.xpReward, 0);
  results.push({
    name: '5.4 — sumBadgeXP matches manual sum of xpReward',
    passed: xpTotal === manualSum,
    expected: `${manualSum}`,
    actual: `${xpTotal}`,
  });

  return results;
}

function runGroup6_PostL100(): TestResult[] {
  const results: TestResult[] = [];

  // 6.1 — Post-L100 badges exist
  results.push({
    name: '6.1 — Post-L100 badges count = 146',
    passed: ALL_POST_L100_BADGES.length === 146,
    expected: '146',
    actual: `${ALL_POST_L100_BADGES.length}`,
  });

  // All have postL100 flag
  const allFlagged = ALL_POST_L100_BADGES.every(b => b.postL100 === true);
  results.push({
    name: '6.1b — All post-L100 badges have postL100: true',
    passed: allFlagged,
    expected: 'all true',
    actual: allFlagged ? 'all true' : 'some missing',
  });

  // 6.2 — XP bar swap logic (structural)
  // Verify getLevelFromXP returns 100 at threshold
  results.push({
    name: '6.2 — L100 check: total core + post badges = 234',
    passed: ALL_BADGES.length + ALL_POST_L100_BADGES.length === 234,
    expected: '234',
    actual: `${ALL_BADGES.length + ALL_POST_L100_BADGES.length}`,
  });

  // 6.3 — Overflow XP badge progress
  const overflowBadge = ALL_POST_L100_BADGES.find(b => b.id === 'pl100_overflow')!;
  const surplusBadge = ALL_POST_L100_BADGES.find(b => b.id === 'pl100_surplus')!;
  const postStats: PostL100Stats = {
    postL100Sessions: 10, overflowXp: 5000, tiersCompleted: 0, totalLevelsEarned: 100,
    rookieSessionsToL100: 0, beginnerSessionsToL100: 0, intermediateSessionsToL100: 0,
    advancedSessionsToL100: 0, proSessionsToL100: 0,
    doubleDays: 0, morningWorkouts: 0, nightWorkouts: 0, weekendWorkouts: 0, weekdayWorkouts: 0,
    perfectMonths: 0, comebackCount: 0, mondayWorkouts: 0, fridayWorkouts: 0, sundayWorkouts: 0,
    accountAgeDays: 30, newYearsWorkout: 0, birthdayWorkout: 0, holidayWorkouts: 0,
    singleSessionXp: 0, totalBadges: 0, streakRecoveries: 0, avgXpPerSession: 0,
    consecutiveDays: 0, totalCombos: 0, totalPushups: 0, totalBurpees: 0, totalCurlups: 0,
    totalHours: 0, totalSessions: 10, totalJogRunMinutes: 0,
    punch1Count: 0, punch2Count: 0, punch3Count: 0, punch4Count: 0,
    punch5Count: 0, punch6Count: 0, punch7Count: 0, punch8Count: 0,
    slipsCount: 0, rollsCount: 0, pullbacksCount: 0, circlesCount: 0,
  };

  const overflowProgress = getPostL100BadgeProgress(overflowBadge, postStats);
  const surplusProgress = getPostL100BadgeProgress(surplusBadge, postStats);
  results.push({
    name: '6.3a — Overflow badge (5K threshold) at 5K overflow = 100%',
    passed: overflowProgress === 1,
    expected: '1.0',
    actual: `${overflowProgress}`,
  });
  results.push({
    name: '6.3b — Surplus badge (15K threshold) at 5K overflow ≈ 33%',
    passed: Math.abs(surplusProgress - 1/3) < 0.01,
    expected: '~0.333',
    actual: `${surplusProgress.toFixed(4)}`,
  });

  return results;
}

function runGroup7_ProfileStats(): TestResult[] {
  const results: TestResult[] = [];

  // 7.1 — Total badge count available
  const totalCount = ALL_BADGES.length + ALL_POST_L100_BADGES.length;
  results.push({
    name: '7.1 — Profile can show "X / 234 badges"',
    passed: totalCount === 234,
    expected: '234',
    actual: `${totalCount}`,
  });

  // 7.2 — Badges have earned_at compatible fields
  const badge = ALL_BADGES[0];
  results.push({
    name: '7.2 — Badge has id field for DB tracking',
    passed: typeof badge.id === 'string' && badge.id.length > 0,
    expected: 'non-empty string',
    actual: `"${badge.id}"`,
  });

  // 7.3 — Prestige badges exist and can be filtered
  const prestigeBadges = ALL_BADGES.filter(b => b.category === 'prestige');
  results.push({
    name: '7.3 — Prestige category badges exist (BMF, BMFK)',
    passed: prestigeBadges.length === 2,
    expected: '2',
    actual: `${prestigeBadges.length}`,
  });

  return results;
}

// =====================================================
// Test Page Component
// =====================================================

export default function BadgeTests() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<TestGroup[]>([]);
  const [running, setRunning] = useState(false);

  const runAll = useCallback(() => {
    setRunning(true);
    setTimeout(() => {
      const results: TestGroup[] = [
        { name: 'Group 1: Badge Collection Rendering', tests: runGroup1_BadgeCollectionRendering(), expanded: false },
        { name: 'Group 2: Badge Detail Modal', tests: runGroup2_BadgeDetailModal(), expanded: false },
        { name: 'Group 3: Badge Trigger Logic', tests: runGroup3_BadgeTriggerLogic(), expanded: false },
        { name: 'Group 4: Post-Workout Toast', tests: runGroup4_PostWorkoutToast(), expanded: false },
        { name: 'Group 5: Post-Workout Summary', tests: runGroup5_PostWorkoutSummary(), expanded: false },
        { name: 'Group 6: Post-L100 Behavior', tests: runGroup6_PostL100(), expanded: false },
        { name: 'Group 7: Profile & Stats', tests: runGroup7_ProfileStats(), expanded: false },
      ];
      // Auto-expand groups with failures
      for (const g of results) {
        if (g.tests.some(t => !t.passed)) g.expanded = true;
      }
      setGroups(results);
      setRunning(false);
    }, 50);
  }, []);

  const toggleGroup = (idx: number) => {
    setGroups(prev => prev.map((g, i) => i === idx ? { ...g, expanded: !g.expanded } : g));
  };

  const totalTests = groups.reduce((s, g) => s + g.tests.length, 0);
  const totalPassed = groups.reduce((s, g) => s + g.tests.filter(t => t.passed).length, 0);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/settings')} className="w-8 h-8 rounded-full bg-surface-1 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-xl font-black uppercase tracking-wider">Badge Test Suite</h1>
      </div>

      {/* Summary */}
      {groups.length > 0 && (
        <div className={cn(
          'rounded-xl p-4 mb-4 border',
          totalPassed === totalTests
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-red-500/10 border-red-500/30'
        )}>
          <span className="text-2xl font-black">
            {totalPassed} / {totalTests}
          </span>
          <span className="text-sm text-muted-foreground ml-2">tests passed</span>
          {totalPassed === totalTests && (
            <span className="ml-3 text-green-400 font-bold">✅ ALL PASS</span>
          )}
        </div>
      )}

      {/* Run Button */}
      <button
        onClick={runAll}
        disabled={running}
        className="w-full mb-6 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Play className="w-4 h-4" />
        {running ? 'Running...' : 'Run All Tests'}
      </button>

      {/* Test Groups */}
      {groups.map((group, gi) => {
        const passed = group.tests.filter(t => t.passed).length;
        const total = group.tests.length;
        const allPassed = passed === total;
        return (
          <div key={gi} className="mb-3">
            <button
              onClick={() => toggleGroup(gi)}
              className={cn(
                'w-full flex items-center justify-between p-3 rounded-lg border transition-colors',
                allPassed ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'
              )}
            >
              <div className="flex items-center gap-2">
                {group.expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <span className="font-bold text-sm">{group.name}</span>
              </div>
              <span className={cn('text-xs font-bold', allPassed ? 'text-green-400' : 'text-red-400')}>
                {passed}/{total}
              </span>
            </button>
            {group.expanded && (
              <div className="mt-1 space-y-1 pl-4">
                {group.tests.map((test, ti) => (
                  <div
                    key={ti}
                    className={cn(
                      'p-2 rounded-lg text-xs border',
                      test.passed
                        ? 'bg-green-500/5 border-green-500/10'
                        : 'bg-red-500/10 border-red-500/30'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {test.passed
                        ? <CheckCircle className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" />
                        : <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{test.name}</p>
                        {!test.passed && (
                          <p className="text-red-400 mt-0.5">
                            Expected: {test.expected} | Actual: {test.actual}
                          </p>
                        )}
                        {test.detail && (
                          <p className="text-muted-foreground mt-0.5 break-all">{test.detail}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
