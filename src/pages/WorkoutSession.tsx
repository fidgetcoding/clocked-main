import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Home, Play, Pause, RotateCcw, SkipForward, SkipBack, ChevronRight, MoreVertical, CheckCircle, Zap, Flame } from 'lucide-react';
import { RoundFeedbackPanel } from '@/components/workout/RoundFeedbackPanel';
import { RoundFeedback } from '@/types';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { VerticalXPBar } from '@/components/ui/VerticalXPBar';

import { ComboXPPop } from '@/components/ui/ComboXPPop';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useWorkouts, DbWorkout } from '@/hooks/useWorkouts';
import { useWorkoutHistory } from '@/hooks/useWorkoutHistory';
import { useUserStore } from '@/stores/userStore';
import { useProfile } from '@/hooks/useProfile';
import { useUserRole } from '@/hooks/useUserRole';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useBadges } from '@/hooks/useBadges';
import { cn } from '@/lib/utils';
import { ACTIVITY_XP_RATES, ActivityType, getStreakMultiplier, getActivityTypeFromName, calculateComboXP, getLevelFromXP, PER_SESSION_ESTIMATES, TIER_COMBO_STATS, Prestige, isPrestigeEligible as checkPrestigeEligible, isMaxLevel as checkIsMaxLevel } from '@/lib/xpSystem';
import { computePostLogStats, computePostL100Increments } from '@/lib/workoutTracking';
import { checkBadges, sumBadgeXP, BadgeStats } from '@/data/badges';
import { checkPostL100Badges } from '@/data/postL100Badges';
import { LevelUpOverlay } from '@/components/ui/LevelUpOverlay';
import { PostWorkoutSummary, SessionXPBreakdown } from '@/components/workout/PostWorkoutSummary';
import { usePostWorkoutComplete } from '@/hooks/useCommunityPosts';

interface FlatSegment {
  id: string;
  name: string;
  type: 'active' | 'rest';
  segmentType?: 'work' | 'rest' | 'shadowboxing' | 'combo' | 'speedbag' | 'doubleend';
  duration: number;
  phaseName: string;
  section: 'warmup' | 'grind' | 'cooldown';
  combo?: string[];
  nextCombo?: string[];
  intensity?: string;
  reps?: number;
  repeatIndex?: number;
  megasetIndex?: number;
  cumulativeRound?: number; // Track which round this segment belongs to (1-indexed)
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTimeCompact(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Helper to convert DB workout to local format for session
function dbWorkoutToLocal(dbWorkout: DbWorkout) {
  const rawPhases = dbWorkout.phases as any[];
  // Extract megaset metadata if present
  const metaEntry = rawPhases?.find((p: any) => p._meta);
  const megasetRepeats = metaEntry?.megasetRepeats || metaEntry?.supersetRepeats || 1;
  const phases = rawPhases?.filter((p: any) => !p._meta) || [];
  
  const sections = {
    warmup: phases.filter((p: any) => p.section === 'warmup').map(({ section, ...rest }: any) => rest),
    grind: phases.filter((p: any) => p.section === 'grind').map(({ section, ...rest }: any) => rest),
    cooldown: phases.filter((p: any) => p.section === 'cooldown').map(({ section, ...rest }: any) => rest),
  };
  
  // Use top-level combos from database (the new column), fallback to extracting from phases for legacy data
  let combos: string[][] = dbWorkout.combos || [];
  
  // Fallback: try to extract combos from phases if top-level is empty (legacy support)
  if (combos.length === 0) {
    phases?.forEach((phase: any) => {
      if (phase.combos) {
        combos.push(...phase.combos);
      }
    });
  }
  
  return {
    id: dbWorkout.id,
    name: dbWorkout.name,
    duration: dbWorkout.duration,
    difficulty: dbWorkout.difficulty,
    sections,
    combos: combos.length > 0 ? combos : undefined,
    is_preset: dbWorkout.is_preset,
    megasetRepeats,
  };
}

const WorkoutSession = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { workouts, updateWorkout } = useWorkouts();
  const { addHistoryEntry } = useWorkoutHistory();
  const postWorkoutComplete = usePostWorkoutComplete();
  const { profile, addXP: addProfileXP, updateProfile } = useProfile();
  const { isAdmin } = useUserRole();
  const user = useUserStore((state) => state.user);
  const addLocalXP = useUserStore((state) => state.addXP);
  const { initialize: initSpeech, speak, cancel: cancelSpeech } = useSpeechSynthesis();
  const { playWarningBeep } = useSoundEffects();

  // Get user preferences for voice settings
  const preferences = user?.preferences as {
    voiceAnnouncements?: boolean;
    voiceCountdown?: boolean;
    voiceComboCallouts?: boolean;
  } | undefined;

  // Support one-off loadouts passed via navigation state (e.g. tier presets)
  const oneOffLoadout = (location.state as any)?.oneOffLoadout;
  const oneOffName = (location.state as any)?.workoutName;

  const dbWorkout = workouts.find((w) => w.id === id);
  
  const workout = useMemo(() => {
    if (dbWorkout) return dbWorkoutToLocal(dbWorkout);
    if (oneOffLoadout) {
      // Convert GeneratedLoadout to session format
      const rawPhases = oneOffLoadout.phases || [];
      const metaEntry = rawPhases.find((p: any) => p._meta);
      const megasetRepeats = metaEntry?.megasetRepeats || metaEntry?.supersetRepeats || 1;
      const phases = rawPhases.filter((p: any) => !p._meta);
      const sections = {
        warmup: phases.filter((p: any) => p.section === 'warmup').map(({ section, ...rest }: any) => rest),
        grind: phases.filter((p: any) => p.section === 'grind').map(({ section, ...rest }: any) => rest),
        cooldown: phases.filter((p: any) => p.section === 'cooldown').map(({ section, ...rest }: any) => rest),
      };
      return {
        id: 'oneoff',
        name: oneOffName || oneOffLoadout.name || 'Preset Workout',
        duration: oneOffLoadout.duration || 0,
        difficulty: oneOffLoadout.difficulty || 'beginner',
        sections,
        combos: oneOffLoadout.combos || [],
        is_preset: true,
        megasetRepeats,
      };
    }
    return null;
  }, [dbWorkout, oneOffLoadout, oneOffName]);

  // Flatten workout into segments
  const flatSegments = useMemo(() => {
    if (!workout) return [];
    
    const segments: FlatSegment[] = [];
    const megasetCount = workout.megasetRepeats || 1;
    
    // Build section order: warmup → grind (×megasetRepeats) → cooldown
    const sectionOrder: { sectionName: 'warmup' | 'grind' | 'cooldown' }[] = [
      { sectionName: 'warmup' },
      ...Array.from({ length: megasetCount }, () => ({ sectionName: 'grind' as const })),
      { sectionName: 'cooldown' },
    ];
    
    // First pass: collect all segments to know what's next
    const tempSegments: { segment: any; sectionName: 'warmup' | 'grind' | 'cooldown'; phase: any; repeatIndex: number; megasetIndex?: number }[] = [];
    
    let grindIterationIndex = 0;
    sectionOrder.forEach(({ sectionName }) => {
      const currentMegasetIndex = sectionName === 'grind' ? grindIterationIndex : undefined;
      if (sectionName === 'grind') grindIterationIndex++;
      const phases = workout.sections[sectionName];
      phases.forEach((phase) => {
        for (let r = 0; r < phase.repeats; r++) {
          phase.segments.forEach((segment) => {
            tempSegments.push({ segment, sectionName, phase, repeatIndex: r, megasetIndex: currentMegasetIndex });
          });
        }
      });
    });
    
    // Two-pass combo assignment:
    // 1) Assign combos to combo segments first (in order or random per phase setting)
    // 2) Leftover combos overflow to shadowboxing segments
    // 3) When combos run out, remaining segments are freestyle (no combo)
    
    const comboSegmentIndices: number[] = [];
    const shadowboxIndices: number[] = [];
    
    tempSegments.forEach((item, idx) => {
      const { segment, phase } = item;
      const isSpeedbag = segment.segmentType === 'speedbag';
      const isDoubleend = segment.segmentType === 'doubleend';
      // Speedbag and double end bag segments are always freestyle — skip combo assignment
      if (isSpeedbag || isDoubleend) return;
      const isComboSegment = segment.segmentType === 'combo' || segment.comboIndex === 'cycle';
      const isShadowboxing = segment.segmentType === 'shadowboxing' || 
                             segment.name.toLowerCase().includes('shadow') || 
                             segment.name.toLowerCase().includes('technique');
      // Work segments in phases with combos but no combo-capable segments (conditioning/exercise phases)
      const phaseCombos = phase.combos as string[][] | undefined;
      const phaseHasCombos = phaseCombos && phaseCombos.length > 0;
      const phaseHasComboSegments = phase.segments?.some((s: any) => 
        ['combo', 'shadowboxing', 'speedbag', 'doubleend'].includes(s.segmentType || '')
      );
      const isExerciseSegment = segment.segmentType === 'exercise' || 
        (segment.type === 'active' && segment.segmentType === 'work' && phaseHasCombos && !phaseHasComboSegments);
      
      if (isComboSegment || isExerciseSegment) comboSegmentIndices.push(idx);
      else if (isShadowboxing) shadowboxIndices.push(idx);
    });
    
    const totalCombos = workout.combos?.length || 0;
    const comboAssignments: Map<number, string[]> = new Map();
    let assigned = 0;
    
    // Helper: get combo list (possibly shuffled) for a phase — phase.combos takes priority
    const getComboListForPhase = (phase: any): string[][] => {
      // Phase-level combos take priority
      const phaseCombos = phase.combos as string[][] | undefined;
      if (phaseCombos && phaseCombos.length > 0) {
        if (phase.comboOrder === 'random') {
          const shuffled = [...phaseCombos];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          return shuffled;
        }
        return phaseCombos;
      }
      // Fallback to workout-level combos for backward compatibility
      if (!workout.combos || workout.combos.length === 0) return [];
      if (phase.comboOrder === 'random') {
        const shuffled = [...workout.combos];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
      }
      return workout.combos;
    };
    
    // Group combo segments by phase and assign combos respecting phase order setting
    // We need per-phase combo pools for random mode
    const phaseComboLists: Map<string, { list: string[][]; cursor: number }> = new Map();
    
    const getPhaseCombo = (phase: any, phaseKey: string): string[] | undefined => {
      if (totalCombos === 0 && !(phase.combos && phase.combos.length > 0)) return undefined;
      if (!phaseComboLists.has(phaseKey)) {
        phaseComboLists.set(phaseKey, { list: getComboListForPhase(phase), cursor: 0 });
      }
      const entry = phaseComboLists.get(phaseKey)!;
      if (entry.cursor >= entry.list.length) return undefined; // ran out
      return entry.list[entry.cursor++];
    };
    
    // Round-aware combo assignment: all boxing segments (combo + shadow) in the
    // same round (phase + repeatIndex) share ONE combo so shadow → bag continuity holds.
    const allBoxingIndices = [...comboSegmentIndices, ...shadowboxIndices].sort((a, b) => a - b);
    const roundComboCache: Map<string, string[]> = new Map();
    
    for (const idx of allBoxingIndices) {
      const { phase, repeatIndex } = tempSegments[idx];
      const roundKey = `${phase.id}-${repeatIndex}`;
      
      if (roundComboCache.has(roundKey)) {
        // Reuse the combo already picked for this round
        comboAssignments.set(idx, roundComboCache.get(roundKey)!);
      } else {
        // First boxing segment of this round — pick a new combo
        const phaseKey = `${phase.id}`;
        const combo = getPhaseCombo(phase, phaseKey);
        if (combo) {
          roundComboCache.set(roundKey, combo);
          comboAssignments.set(idx, combo);
        }
      }
    }
    
    // Second pass: build flat segments with proper next-segment awareness
    // Also track cumulative round number across grind phases
    let cumulativeRound = 0;
    let lastPhaseId = '';
    let lastRepeatIndex = -1;
    
    tempSegments.forEach((item, idx) => {
      const { segment, sectionName, phase, repeatIndex, megasetIndex } = item;
      
      // Track cumulative round: each new repeat of a grind phase = new round
      if (sectionName === 'grind') {
        const phaseRepeatKey = `${phase.id}-${repeatIndex}`;
        if (phaseRepeatKey !== `${lastPhaseId}-${lastRepeatIndex}`) {
          cumulativeRound++;
          lastPhaseId = phase.id;
          lastRepeatIndex = repeatIndex;
        }
      }
      
      const combo = comboAssignments.get(idx);
      
      const isShadowboxing = segment.segmentType === 'shadowboxing' || 
                             segment.name.toLowerCase().includes('shadow') || 
                             segment.name.toLowerCase().includes('technique');
      let nextCombo: string[] | undefined;
      if (isShadowboxing && !combo) {
        const nextItem = tempSegments[idx + 1];
        if (nextItem) {
          const nextAssigned = comboAssignments.get(idx + 1);
          if (nextAssigned) nextCombo = nextAssigned;
        }
      }
      
      segments.push({
        id: `${segment.id}-${repeatIndex}-${idx}`,
        name: segment.name,
        type: segment.type,
        segmentType: segment.segmentType,
        duration: segment.duration,
        phaseName: phase.name,
        section: sectionName,
        combo,
        nextCombo,
        intensity: segment.intensity,
        reps: segment.reps,
        repeatIndex: phase.repeats > 1 ? repeatIndex + 1 : undefined,
        megasetIndex,
        cumulativeRound: sectionName === 'grind' ? cumulativeRound : undefined,
      });
    });
    
    return segments;
  }, [workout]);

  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(10); // Start with 10s countdown
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [isPreparation, setIsPreparation] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [notes, setNotes] = useState('');
  const [logged, setLogged] = useState(false);
  const [difficultyRating, setDifficultyRating] = useState<'too_easy' | 'just_right' | 'too_hard' | null>(null);
  const [feedbackMode, setFeedbackMode] = useState<'basic' | 'advanced'>('basic');
  const [roundFeedback, setRoundFeedback] = useState<RoundFeedback[]>([]);
  const [xpBubble, setXpBubble] = useState<{ amount: number; id: number } | null>(null);
  const [hasStartedOnce, setHasStartedOnce] = useState(false);
  const [hasAwardedXP, setHasAwardedXP] = useState(false);
  const [accumulatedXP, setAccumulatedXP] = useState(0);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [comboXPPop, setComboXPPop] = useState<{ amount: number; id: number; isChampionship?: boolean } | null>(null);
  const [levelUpLevel, setLevelUpLevel] = useState<number | null>(null);
  const [sessionResult, setSessionResult] = useState<SessionXPBreakdown | null>(null);
  
  // Badge system
  const { earnedBadgeIds, awardBadges, currentStats } = useBadges();
  
  // Calculate round count from grind phases
  const roundCount = useMemo(() => {
    if (!workout) return 0;
    let count = 0;
    for (const phase of workout.sections.grind) {
      count += phase.repeats;
    }
    return count;
  }, [workout]);
  
  // Handler for round ratings
  const handleRoundRating = useCallback((roundNum: number, rating: number) => {
    setRoundFeedback(prev => {
      const existing = prev.find(r => r.roundNumber === roundNum);
      if (existing) {
        return prev.map(r => r.roundNumber === roundNum ? { ...r, rating } : r);
      }
      return [...prev, { roundNumber: roundNum, rating }];
    });
  }, []);

  const currentSegment = flatSegments[currentSegmentIndex];
  const nextSegment = flatSegments[currentSegmentIndex + 1];
  const totalSegments = flatSegments.length;
  const progressPercent = totalSegments > 0 ? (currentSegmentIndex / totalSegments) * 100 : 0;
  // Championship visual: only segments within the "Championship Rounds" phase
  const isChampionship = !isPreparation && !!currentSegment && 
    currentSegment.phaseName.toLowerCase().includes('championship');
  const isCooldown = !isPreparation && (
    currentSegment?.section === 'cooldown' || 
    currentSegment?.phaseName?.toLowerCase() === 'cooldown'
  );
  
  // Accent color helper — championship gold > cooldown blue > volt green
  // Use full class names so Tailwind can detect them at build time
  const accentText = isChampionship ? 'text-championship-gold' : isCooldown ? 'text-cooldown-blue' : 'text-volt';
  const accentText60 = isChampionship ? 'text-championship-gold/60' : isCooldown ? 'text-cooldown-blue/60' : 'text-volt/60';
  const accentHsl = isChampionship ? 'hsl(var(--championship-gold))' : isCooldown ? 'hsl(var(--cooldown-blue))' : 'hsl(var(--electric-volt))';

  // Get streak multiplier from profile
  const streakMultiplier = getStreakMultiplier(profile?.current_streak || 0);
  
  // Map segment type to activity type for XP calculation using the comprehensive helper
  const getActivityTypeFromSegment = (segment: FlatSegment | undefined): ActivityType => {
    if (!segment) return 'active';
    return getActivityTypeFromName(segment.name, segment.type === 'rest' ? 'rest' : segment.segmentType);
  };
  
  // Use accumulated XP for display
  const currentXP = accumulatedXP;

  // Wall-clock ref for background-safe timing
  const lastTickTimeRef = useRef<number>(Date.now());
  const prevLevelRef = useRef<number | null>(null);

  const { playLevelUpSound } = useSoundEffects();

  // Compute live level from accumulated XP - use profile (database) as source of truth
  const liveLevel = getLevelFromXP(
    (profile?.prestige || 'beginner') as any,
    (profile?.total_xp || 0) + accumulatedXP
  );

  // Detect level-up during session
  useEffect(() => {
    if (prevLevelRef.current === null) {
      // First time we have a valid level — just store it, don't animate
      prevLevelRef.current = liveLevel;
      return;
    }
    if (liveLevel > prevLevelRef.current) {
      setLevelUpLevel(liveLevel);
      playLevelUpSound();
    }
    prevLevelRef.current = liveLevel;
  }, [liveLevel, playLevelUpSound]);

  // Helper: check if a segment is a boxing segment eligible for 2x XP
  const isBoxingSegment = useCallback((segment: FlatSegment) => {
    const st = segment.segmentType;
    return st === 'shadowboxing' || st === 'combo' || st === 'doubleend';
  }, []);

  // Helper: compute XP per second for a given segment (includes 2x championship multiplier)
  const getXPPerSecond = useCallback((segment: FlatSegment) => {
    const activityType = getActivityTypeFromSegment(segment);
    let xpPerSecond = ACTIVITY_XP_RATES[activityType];
    
    if (activityType === 'combo' && segment.combo && segment.combo.length > 0) {
      const totalComboXP = calculateComboXP(segment.combo, segment.duration);
      xpPerSecond = totalComboXP / segment.duration;
    }
    
    // 2x XP for boxing segments in Championship Rounds phase
    if (segment.phaseName.toLowerCase().includes('championship') && isBoxingSegment(segment)) {
      xpPerSecond *= 2;
    }
    
    return xpPerSecond;
  }, [profile?.prestige, isBoxingSegment]);

  // Compute session result when workout completes
  useEffect(() => {
    if (!isComplete || sessionResult || !profile) return;
    
    const streakMult = getStreakMultiplier(profile.current_streak || 0);
    const effectiveBase = Math.round(accumulatedXP);
    const rawBase = streakMult > 1 ? Math.round(effectiveBase / streakMult) : effectiveBase;
    const streakBonus = effectiveBase - rawBase;
    
    // Compute streak for badge checking
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const lastDate = profile.last_workout_date;
    let newStreak: number;
    let streakBroken = false;
    if (lastDate === todayStr) {
      newStreak = profile.current_streak || 1;
    } else if (lastDate === yesterdayStr) {
      newStreak = (profile.current_streak || 0) + 1;
    } else {
      newStreak = 1;
      streakBroken = (profile.current_streak || 0) > 1;
    }
    
    const tier = (profile.prestige || 'beginner') as Prestige;
    const tierStats = TIER_COMBO_STATS[tier];
    
    const updatedStats: BadgeStats = {
      consecutiveDays: newStreak,
      totalCombos: (profile.combos_landed || 0) + PER_SESSION_ESTIMATES.combosLanded,
      complexCombos: (profile.complex_combos || 0) + tierStats.complex,
      defenseCombos: (profile.defense_combos || 0) + tierStats.defense,
      counterCombos: (profile.counter_combos || 0) + tierStats.counter,
      totalSessions: (profile.workouts_completed || 0) + 1,
      totalHours: ((profile.total_training_seconds || 0) + totalElapsed) / 3600,
      singleSessionMinutes: totalElapsed / 60,
      totalPushups: (profile.total_pushups || 0) + PER_SESSION_ESTIMATES.pushups,
      totalBurpees: (profile.total_burpees || 0) + PER_SESSION_ESTIMATES.burpees,
      totalCurlups: (profile.total_curlups || 0) + PER_SESSION_ESTIMATES.curlups,
      totalJogRunMinutes: (profile.total_jog_run_minutes || 0) + PER_SESSION_ESTIMATES.jogRunMinutes,
    };
    
    // Check core badges
    const newCoreBadges = checkBadges(updatedStats, earnedBadgeIds);
    
    // Check post-L100 badges ONLY if user is at L100
    const currentLevel = profile.current_level || 1;
    let newPostL100Badges: any[] = [];
    if (currentLevel >= 100) {
      const postL100StatsForCheck = {
        ...updatedStats,
        postL100Sessions: ((profile as any)?.post_l100_sessions || 0) + 1,
        overflowXp: (profile as any)?.overflow_xp || 0,
        tiersCompleted: (profile as any)?.tiers_completed || 0,
        totalLevelsEarned: (profile as any)?.total_levels_earned || 0,
        rookieSessionsToL100: (profile as any)?.rookie_sessions_to_l100 || 0,
        beginnerSessionsToL100: (profile as any)?.beginner_sessions_to_l100 || 0,
        intermediateSessionsToL100: (profile as any)?.intermediate_sessions_to_l100 || 0,
        advancedSessionsToL100: (profile as any)?.advanced_sessions_to_l100 || 0,
        proSessionsToL100: (profile as any)?.pro_sessions_to_l100 || 0,
        doubleDays: (profile as any)?.double_days || 0,
        morningWorkouts: (profile as any)?.morning_workouts || 0,
        nightWorkouts: (profile as any)?.night_workouts || 0,
        weekendWorkouts: (profile as any)?.weekend_workouts || 0,
        weekdayWorkouts: (profile as any)?.weekday_workouts || 0,
        perfectMonths: (profile as any)?.perfect_months || 0,
        comebackCount: (profile as any)?.comeback_count || 0,
        mondayWorkouts: (profile as any)?.monday_workouts || 0,
        fridayWorkouts: (profile as any)?.friday_workouts || 0,
        sundayWorkouts: (profile as any)?.sunday_workouts || 0,
        accountAgeDays: profile?.created_at ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000) : 0,
        newYearsWorkout: (profile as any)?.new_years_workout ? 1 : 0,
        birthdayWorkout: (profile as any)?.birthday_workout ? 1 : 0,
        holidayWorkouts: (profile as any)?.holiday_workouts || 0,
        singleSessionXp: Math.max((profile as any)?.best_session_xp || 0, effectiveBase),
        totalBadges: earnedBadgeIds.length + newCoreBadges.length,
        streakRecoveries: (profile as any)?.streak_recoveries || 0,
        avgXpPerSession: profile?.workouts_completed ? Math.round(((profile?.total_xp || 0) + effectiveBase) / ((profile.workouts_completed || 0) + 1)) : effectiveBase,
        punch1Count: (profile as any)?.punch_1_count || 0,
        punch2Count: (profile as any)?.punch_2_count || 0,
        punch3Count: (profile as any)?.punch_3_count || 0,
        punch4Count: (profile as any)?.punch_4_count || 0,
        punch5Count: (profile as any)?.punch_5_count || 0,
        punch6Count: (profile as any)?.punch_6_count || 0,
        punch7Count: (profile as any)?.punch_7_count || 0,
        punch8Count: (profile as any)?.punch_8_count || 0,
        slipsCount: (profile as any)?.slips_count || 0,
        rollsCount: (profile as any)?.rolls_count || 0,
        pullbacksCount: (profile as any)?.pullbacks_count || 0,
        circlesCount: (profile as any)?.circles_count || 0,
      };
      newPostL100Badges = checkPostL100Badges(postL100StatsForCheck, [...earnedBadgeIds, ...newCoreBadges.map(b => b.id)]);
    }
    
    const allNewBadges = [...newCoreBadges, ...newPostL100Badges];
    const badgeXP = allNewBadges.reduce((sum, b) => sum + b.xpReward, 0);
    const sessionTotal = effectiveBase + badgeXP;
    const totalXPAfter = (profile.total_xp || 0) + sessionTotal;
    const levelBefore = profile.current_level || 1;
    const levelAfter = getLevelFromXP(tier, totalXPAfter);
    
    setSessionResult({
      baseXP: rawBase,
      streakMultiplier: streakMult,
      streakBonus,
      effectiveBase,
      badgeXP,
      sessionTotal,
      newBadges: allNewBadges,
      levelBefore,
      levelAfter,
      streakBefore: profile.current_streak || 0,
      streakAfter: newStreak,
      streakBroken,
      didLevelUp: levelAfter > levelBefore,
      prestige: tier,
      totalXPAfter,
      prestigeEligible: checkPrestigeEligible(tier, totalXPAfter),
      isMaxLevel: checkIsMaxLevel(tier, totalXPAfter),
    });
  }, [isComplete, sessionResult, profile, accumulatedXP, totalElapsed, earnedBadgeIds]);

  // Background-safe timer using wall-clock deltas
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isRunning && !isPaused) {
      lastTickTimeRef.current = Date.now();
      
      interval = setInterval(() => {
        const now = Date.now();
        const delta = Math.floor((now - lastTickTimeRef.current) / 1000);
        if (delta < 1) return;
        lastTickTimeRef.current = now;

        // Advance elapsed time
        setTotalElapsed(prev => prev + delta);
        // Decrement countdown
        setTimeRemaining(prev => prev - delta);
        
        // Accumulate XP for `delta` seconds (not during preparation)
        if (!isPreparation && currentSegment) {
          const xpPerSecond = getXPPerSecond(currentSegment);
          const xpGained = xpPerSecond * streakMultiplier * delta;
          setAccumulatedXP(prev => prev + xpGained);
        }
      }, 250); // Check 4x/sec for smoother catch-up
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, isPaused, isPreparation, currentSegment, streakMultiplier, getXPPerSecond]);

  // Instant catch-up when tab becomes visible again
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isRunning && !isPaused) {
        // Force the interval logic to fire immediately by updating lastTickTimeRef
        // The next interval tick (every 250ms) will compute the large delta
        // No need to duplicate logic — just ensure ref is not reset
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isRunning, isPaused]);

  // Track previous segment to detect transitions
  const prevSegmentIndexRef = useRef<number>(-1);
  // Track if XP has already been awarded
  const xpAwardedRef = useRef(false);
  // Track previous segment for combo XP pops
  const prevComboSegRef = useRef<number>(-1);

  // Voice countdown at 3 seconds - respects voiceCountdown preference
  useEffect(() => {
    if (timeRemaining === 3 && isRunning && !isPaused) {
      if (preferences?.voiceCountdown !== false && preferences?.voiceAnnouncements !== false) {
        speak('3, 2, 1', { rate: 0.8 });
      }
    }
  }, [timeRemaining, isRunning, isPaused, preferences, speak]);

  // 10-second warning voice and beep
  useEffect(() => {
    if (timeRemaining === 10 && isRunning && !isPaused && !isPreparation) {
      if (preferences?.voiceCountdown !== false && preferences?.voiceAnnouncements !== false) {
        speak('10 seconds', { rate: 0.9 });
      }
      playWarningBeep();
    }
  }, [timeRemaining, isRunning, isPaused, isPreparation, preferences, speak, playWarningBeep]);

  // Phase/segment announcement voice
  useEffect(() => {
    if (prevSegmentIndexRef.current === currentSegmentIndex) return;
    prevSegmentIndexRef.current = currentSegmentIndex;

    // DEBUG: Log XP/sec for every segment transition
    if (currentSegment) {
      const baseRate = getXPPerSecond(currentSegment);
      const effectiveRate = baseRate * streakMultiplier;
      const isChamp = currentSegment.phaseName.toLowerCase().includes('championship');
      const isBoxing = isBoxingSegment(currentSegment);
      console.log(`[XP DEBUG] Segment: "${currentSegment.name}" | type: ${currentSegment.segmentType} | phase: "${currentSegment.phaseName}" | championship: ${isChamp} | boxing: ${isBoxing} | base XP/sec: ${baseRate.toFixed(4)} | streak: ${streakMultiplier}x | effective XP/sec: ${effectiveRate.toFixed(4)}`);
    }

    if (!isPreparation && currentSegment && isRunning && !isPaused) {
      if (preferences?.voiceAnnouncements !== false) {
        let announcement = '';
        if (currentSegment.type === 'rest') {
          announcement = 'Rest';
        } else if (currentSegment.segmentType === 'shadowboxing' || currentSegment.name.toLowerCase().includes('shadow')) {
          announcement = 'Shadowboxing';
        } else if (currentSegment.segmentType === 'speedbag') {
          // Use the segment name which includes the drill (e.g., "Speed Bag Doubles")
          announcement = currentSegment.name.includes('Freestyle') ? 'Speed Bag Freestyle' : currentSegment.name;
        } else if (currentSegment.segmentType === 'doubleend') {
          announcement = currentSegment.name.includes('Freestyle') ? 'Double End Bag Freestyle' : 'Double End Bag';
        } else if (currentSegment.segmentType === 'combo') {
          announcement = currentSegment.name.includes('Freestyle') ? 'Heavy Bag Freestyle' : 'Heavy Bag';
        } else {
          announcement = currentSegment.name;
        }
        speak(announcement, { rate: 0.9 });

        const combo = currentSegment.combo;
        if (combo && combo.length > 0 && preferences?.voiceComboCallouts !== false) {
          setTimeout(() => {
            const speakableCombo = combo.map(move => {
              const m = move.toUpperCase();
              if (m === 'SLIP L') return 'slip left';
              if (m === 'SLIP R') return 'slip right';
              if (m === 'ROLL L') return 'roll left';
              if (m === 'ROLL R') return 'roll right';
              if (m === 'CIRCLE L') return 'circle left';
              if (m === 'CIRCLE R') return 'circle right';
              if (m === 'STEP IN') return 'step in';
              if (m === 'STEP OUT') return 'step out';
              return move;
            }).join(', ');
            speak(speakableCombo, { rate: 0.85 });
          }, 1200);
        }
      }
    }
  }, [currentSegmentIndex, isPreparation, currentSegment, isRunning, isPaused, preferences, speak]);

  // Handle segment transitions when time hits 0
  useEffect(() => {
    if (timeRemaining <= 0 && isRunning) {
      if (isPreparation) {
        setIsPreparation(false);
        const firstDuration = flatSegments[0]?.duration || 60;
        setTimeRemaining(firstDuration + timeRemaining);
      } else if (currentSegmentIndex < flatSegments.length - 1) {
        // Fire combo XP pop for the segment that just ended
        const endingSegment = flatSegments[currentSegmentIndex];
        const isComboPopSegment = endingSegment?.segmentType === 'combo' || endingSegment?.segmentType === 'shadowboxing' || endingSegment?.segmentType === 'speedbag' || endingSegment?.segmentType === 'doubleend';
        if (isComboPopSegment && endingSegment.combo && endingSegment.combo.length > 0 && prevComboSegRef.current !== currentSegmentIndex) {
          prevComboSegRef.current = currentSegmentIndex;
          const comboXP = calculateComboXP(endingSegment.combo, endingSegment.duration);
          const isChamp = endingSegment.phaseName.toLowerCase().includes('championship') && isBoxingSegment(endingSegment);
          const finalXP = isChamp ? comboXP * 2 : comboXP;
          if (finalXP > 0) {
            const popId = Date.now();
            setComboXPPop({ amount: finalXP * streakMultiplier, id: popId, isChampionship: isChamp });
            setTimeout(() => setComboXPPop(prev => prev?.id === popId ? null : prev), 1200);
          }
        }
        
        const nextIdx = currentSegmentIndex + 1;
        const nextDuration = flatSegments[nextIdx]?.duration || 60;
        setCurrentSegmentIndex(nextIdx);
        setTimeRemaining(nextDuration + timeRemaining);
      } else if (!isComplete && !xpAwardedRef.current) {
        xpAwardedRef.current = true;
        cancelSpeech();
        setIsComplete(true);
        setIsRunning(false);
        
        if (dbWorkout) {
          updateWorkout.mutate({
            id: dbWorkout.id,
            times_completed: (dbWorkout.times_completed || 0) + 1,
            last_used_at: new Date().toISOString(),
          });
        }
      }
    }
  }, [timeRemaining, isRunning, isPreparation, currentSegmentIndex, flatSegments, dbWorkout, updateWorkout, cancelSpeech, isComplete, accumulatedXP, streakMultiplier, isBoxingSegment]);


  const showXpBubble = (amount: number) => {
    const id = Date.now();
    setXpBubble({ amount, id });
    setTimeout(() => {
      setXpBubble((current) => (current?.id === id ? null : current));
    }, 2000);
  };

  const handleStart = () => {
    // Initialize speech synthesis on user interaction (required by browsers)
    initSpeech();
    
    setIsRunning(true);
    setIsPaused(false);
    if (!hasStartedOnce) {
      // Track start XP locally only — will be persisted on log
      setAccumulatedXP(prev => prev + 10);
      showXpBubble(10);
      setHasStartedOnce(true);
    }
  };

  const handlePauseResume = () => {
    setIsPaused((prev) => !prev);
  };

  const handleReset = () => {
    setCurrentSegmentIndex(0);
    setTimeRemaining(10);
    setTotalElapsed(0);
    setAccumulatedXP(0);
    setIsRunning(false);
    setIsPaused(true);
    setIsPreparation(true);
    setIsComplete(false);
    setHasAwardedXP(false);
    xpAwardedRef.current = false;
  };

  // Confirmation handlers for exit and restart
  const handleConfirmExit = (saveXP: boolean = false) => {
    // XP is only persisted when the workout is logged via handleLog
    // Exiting always discards accumulated XP
    cancelSpeech();
    setShowExitConfirm(false);
    navigate('/');
  };

  const handleConfirmRestart = () => {
    // Discard accumulated XP on restart
    cancelSpeech();
    setShowRestartConfirm(false);
    setCurrentSegmentIndex(0);
    setTimeRemaining(10);
    setTotalElapsed(0);
    setAccumulatedXP(0);
    setIsRunning(false);
    setIsPaused(true);
    setIsPreparation(true);
    setIsComplete(false);
    setHasAwardedXP(false);
    xpAwardedRef.current = false;
  };

  const handleBack = () => {
    if (isPreparation) {
      // Can't go back from preparation
      return;
    }
    if (currentSegmentIndex > 0) {
      const prevSegment = flatSegments[currentSegmentIndex - 1];
      setCurrentSegmentIndex((prev) => prev - 1);
      setTimeRemaining(prevSegment.duration);
    } else {
      // At the first segment, go back to preparation
      setIsPreparation(true);
      setTimeRemaining(10);
    }
  };

  const handleSkip = () => {
    if (isPreparation) {
      setIsPreparation(false);
      setTimeRemaining(flatSegments[0]?.duration || 60);
    } else if (currentSegmentIndex < flatSegments.length - 1) {
      setCurrentSegmentIndex((prev) => prev + 1);
      setTimeRemaining(flatSegments[currentSegmentIndex + 1].duration);
    }
  };

  const handleCompleteEarly = () => {
    // Cancel any ongoing speech
    cancelSpeech();
    // Mark workout as complete — XP will only persist when user logs
    setIsComplete(true);
    setIsRunning(false);
    xpAwardedRef.current = true;
    setHasAwardedXP(true);
    
    // Mark workout as used
    if (dbWorkout) {
      updateWorkout.mutate({
        id: dbWorkout.id,
        times_completed: (dbWorkout.times_completed || 0) + 1,
        last_used_at: new Date().toISOString(),
      });
    }
  };

  const adjustTime = (delta: number) => {
    setTimeRemaining((prev) => Math.max(0, prev + delta));
  };

  // 50% halves the time, 2X doubles it
  const halveTime = () => {
    setTimeRemaining((prev) => Math.max(1, Math.floor(prev / 2)));
  };

  const doubleTime = () => {
    setTimeRemaining((prev) => prev * 2);
  };

  if (!workout) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Workout not found</p>
            <Button onClick={() => navigate('/')}>Go Home</Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const handlePrestige = async () => {
    if (!profile || !sessionResult) return;
    const nextPrestige = (() => {
      const order: Prestige[] = ['rookie', 'beginner', 'intermediate', 'advanced', 'pro'];
      const idx = order.indexOf(sessionResult.prestige);
      return idx < order.length - 1 ? order[idx + 1] : null;
    })();
    if (!nextPrestige) return;
    
    try {
      updateProfile.mutate({
        prestige: nextPrestige,
        current_level: 1,
        total_xp: 0,
        experience_level: nextPrestige,
      } as any);
    } catch (e) {
      console.error('Prestige failed:', e);
    }
  };

  const handleLog = async () => {
    if (!sessionResult) return;
    
    const tier = (profile?.prestige || 'beginner') as Prestige;
    const tierStats = TIER_COMBO_STATS[tier];
    
    // Award badges
    if (sessionResult.newBadges.length > 0) {
      try {
        await awardBadges.mutateAsync(sessionResult.newBadges);
      } catch (e) { console.error('Badge award failed:', e); }
    }
    
    // Update local XP store for immediate UI feedback
    if (sessionResult.sessionTotal > 0) {
      try { addLocalXP(sessionResult.sessionTotal, true); } catch {}
    }
    
    addHistoryEntry.mutate({
      workout_id: workout?.id || null,
      workout_name: workout?.name || 'Workout',
      completed_at: new Date().toISOString(),
      duration: totalElapsed,
      xp_earned: sessionResult.sessionTotal,
      difficulty: difficultyRating || null,
      notes: notes || null,
      is_manual_entry: false,
      round_feedback: feedbackMode === 'advanced' ? roundFeedback : [],
    }, {
      onSuccess: async () => {
        setLogged(true);
        postWorkoutComplete.mutate({
          workoutName: workout?.name || 'Workout',
          xpEarned: sessionResult.sessionTotal,
          duration: totalElapsed,
        });
        if (user?.id && profile) {
          const postLogStats = await computePostLogStats(user.id, profile);
          if (postLogStats) {
            // Compute post-L100 increments from actual workout segments
            const postL100Increments = computePostL100Increments(
              profile as any,
              sessionResult.sessionTotal,
              flatSegments,
            );
            
            updateProfile.mutate({
              ...postLogStats,
              ...postL100Increments,
              total_xp: (profile.total_xp || 0) + sessionResult.sessionTotal,
              combos_landed: (profile.combos_landed || 0) + PER_SESSION_ESTIMATES.combosLanded,
              total_pushups: (profile.total_pushups || 0) + PER_SESSION_ESTIMATES.pushups,
              total_burpees: (profile.total_burpees || 0) + PER_SESSION_ESTIMATES.burpees,
              total_curlups: (profile.total_curlups || 0) + PER_SESSION_ESTIMATES.curlups,
              total_jog_run_minutes: (profile.total_jog_run_minutes || 0) + PER_SESSION_ESTIMATES.jogRunMinutes,
              complex_combos: (profile.complex_combos || 0) + tierStats.complex,
              defense_combos: (profile.defense_combos || 0) + tierStats.defense,
              counter_combos: (profile.counter_combos || 0) + tierStats.counter,
            } as any);
          }
        }
      },
      onError: (error) => console.error('Failed to log workout:', error),
    });
  };

  // Workout complete screen
  if (isComplete) {
    if (!sessionResult) {
      return (
        <AppLayout hideNav>
          <div className="min-h-screen flex items-center justify-center">
            <p className="text-muted-foreground">Calculating results...</p>
          </div>
        </AppLayout>
      );
    }
    
    return (
      <AppLayout hideNav>
        <PostWorkoutSummary
          result={sessionResult}
          workoutName={workout.name}
          totalElapsed={totalElapsed}
          notes={notes}
          setNotes={setNotes}
          difficultyRating={difficultyRating}
          setDifficultyRating={setDifficultyRating}
          feedbackMode={feedbackMode}
          setFeedbackMode={setFeedbackMode}
          roundFeedback={roundFeedback}
          roundCount={roundCount}
          onRoundRating={handleRoundRating}
          onLog={handleLog}
          logged={logged}
          onNavigateHome={() => navigate('/')}
          onPrestige={handlePrestige}
        />
      </AppLayout>
    );
  }

  // Check if current segment is shadowboxing (show NEXT combo that's coming)
  const isShadowboxing = currentSegment?.segmentType === 'shadowboxing' || 
                         currentSegment?.name.toLowerCase().includes('shadow') || 
                         currentSegment?.name.toLowerCase().includes('technique');
  const isSpeedbag = currentSegment?.segmentType === 'speedbag';
  const isDoubleend = currentSegment?.segmentType === 'doubleend';
  // For shadowboxing, show the nextCombo (the upcoming combo to practice)
  // For combo segments, show the current combo
  // Treat ['FREESTYLE'] as no combo — it means freestyle round
  // Speedbag and double end bag are always freestyle (no combo display)
  const rawCombo = (isSpeedbag || isDoubleend) ? undefined : (isShadowboxing ? (currentSegment?.combo || currentSegment?.nextCombo) : currentSegment?.combo);
  const isFreestyleCombo = rawCombo?.length === 1 && rawCombo[0] === 'FREESTYLE';
  const displayCombo = isFreestyleCombo ? undefined : rawCombo;

  // Check if current segment is rest (for rest screen preview)
  const isRestSegment = currentSegment?.type === 'rest' && !isPreparation;
  // Only show combo preview for segments that actually use combos (shadowboxing, combo, bag types)
  const nextSegmentUsesCombos = nextSegment?.type === 'active' && 
    (nextSegment?.segmentType === 'combo' || nextSegment?.segmentType === 'shadowboxing' || 
     nextSegment?.segmentType === 'speedbag' || nextSegment?.segmentType === 'doubleend');
  const nextSegmentIsShadowboxing = nextSegment?.segmentType === 'shadowboxing';
  const rawRestCombo = nextSegmentUsesCombos 
    ? (nextSegmentIsShadowboxing ? (nextSegment?.combo || nextSegment?.nextCombo) : nextSegment?.combo) 
    : undefined;
  const restComboPreview = rawRestCombo && rawRestCombo.length > 0 && 
    !(rawRestCombo.length === 1 && rawRestCombo[0] === 'FREESTYLE') 
    ? rawRestCombo : undefined;

  // Helper function to convert move names to display format
  const getDisplayMove = (move: string): { display: string; type: 'punch' | 'defense' | 'movement' } => {
    const m = move.toUpperCase();
    // Punch conversions
    if (m === 'JAB') return { display: '1', type: 'punch' };
    if (m === 'CROSS' || m === 'STRAIGHT') return { display: '2', type: 'punch' };
    if (m === 'LEAD HOOK' || m === 'LEFT HOOK') return { display: '3', type: 'punch' };
    if (m === 'REAR HOOK' || m === 'RIGHT HOOK') return { display: '4', type: 'punch' };
    if (m === 'LEAD UPPERCUT' || m === 'LEFT UPPERCUT') return { display: '5', type: 'punch' };
    if (m === 'REAR UPPERCUT' || m === 'RIGHT UPPERCUT') return { display: '6', type: 'punch' };
    if (m === 'LEAD BODY HOOK' || m === 'LEFT BODY') return { display: '7', type: 'punch' };
    if (m === 'REAR BODY HOOK' || m === 'RIGHT BODY') return { display: '8', type: 'punch' };
    // Defense conversions
    if (m.includes('SLIP L')) return { display: 'SL', type: 'defense' };
    if (m.includes('SLIP R')) return { display: 'SR', type: 'defense' };
    if (m.includes('ROLL L')) return { display: 'RL', type: 'defense' };
    if (m.includes('ROLL R')) return { display: 'RR', type: 'defense' };
    if (m === 'PULL') return { display: 'PL', type: 'defense' };
    if (m === 'BLOCK') return { display: 'BK', type: 'defense' };
    // Movement conversions
    if (m.includes('CIRCLE L')) return { display: '↺', type: 'movement' };
    if (m.includes('CIRCLE R')) return { display: '↻', type: 'movement' };
    if (m.includes('STEP IN')) return { display: '→', type: 'movement' };
    if (m.includes('STEP OUT')) return { display: '←', type: 'movement' };
    // If it's already a number or short code, determine type
    if (['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].includes(m)) return { display: m, type: 'punch' };
    if (['SL', 'SR', 'RL', 'RR', 'PL', 'BK'].includes(m)) return { display: m, type: 'defense' };
    if (['↺', '↻', '→', '←'].includes(m)) return { display: m, type: 'movement' };
    return { display: move, type: 'punch' };
  };

  // Active workout screen
  return (
    <AppLayout hideNav>
      <div className="min-h-screen flex flex-col bg-background">
        {/* Top Bar */}
        <header className="flex items-start justify-between px-4 py-3 safe-top">
          {/* Left side - home and restart buttons */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowExitConfirm(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-full bg-surface-1 border border-surface-3"
            >
              <ArrowLeft className="w-4 h-4" />
              <Home className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowRestartConfirm(true)}
              className="px-3 py-2 rounded-full bg-surface-1 border border-surface-3 text-muted-foreground hover:text-foreground transition-colors"
              title="Restart from beginning"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={handleCompleteEarly}
              className={cn("px-3 py-2 rounded-full bg-surface-1 border border-surface-3 transition-colors", isChampionship ? "text-championship-gold" : isCooldown ? "text-cooldown-blue" : "text-volt")}
              title="Complete workout early"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          </div>
          
          {/* Elapsed time + streak */}
          <div className="flex flex-col items-end gap-1 relative">
            {/* XP Bubble */}
            {xpBubble && (
              <div 
                key={xpBubble.id}
                className={cn("absolute right-full mr-2 top-1/2 -translate-y-1/2 font-bold text-sm whitespace-nowrap animate-xp-bubble", accentText)}
              >
                +{xpBubble.amount} XP
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className={cn("timer-display text-2xl font-black", accentText60)}>
                {formatTimeCompact(totalElapsed)}
              </span>
            </div>
            {/* Streak indicator */}
            {(profile?.current_streak || 0) > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20">
                <Flame className="w-3 h-3 text-orange-400" />
                <span className="text-[10px] font-bold text-orange-400">
                  {profile?.current_streak}d — {streakMultiplier}x
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Level Up Overlay */}
        {levelUpLevel !== null && (
          <LevelUpOverlay
            level={levelUpLevel}
            variant={isChampionship ? 'championship' : isCooldown ? 'cooldown' : 'volt'}
            onComplete={() => setLevelUpLevel(null)}
          />
        )}

        {/* Main Timer — middle area between top bar and bottom bar */}
        <div className="flex-1 relative px-4">
          {/* Layer 1: Fixed, vertically centered — phase name, timer, segment, time buttons */}
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4" style={{ marginTop: '-18%' }}>
                {/* Phase Name — context of where you are */}
                {isPreparation ? (
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">GET READY</p>
                ) : isChampionship ? (
                  <p className="text-xs font-black text-championship-gold uppercase tracking-widest mb-2 flex items-center gap-1.5 animate-[pulse_3s_ease-in-out_infinite]">
                    <Zap className="w-3 h-3 text-championship-gold" />
                    {currentSegment?.phaseName || 'CHAMPIONSHIP'}
                    <Zap className="w-3 h-3 text-championship-gold" />
                  </p>
                ) : (
                  <p className={cn(
                    "text-xs uppercase tracking-widest mb-2",
                    isCooldown ? "text-cooldown-blue/70" : "text-muted-foreground"
                  )}>
                    {currentSegment?.phaseName || 'WARMUP'}
                  </p>
                )}

                {/* Timer with 270° arc ring */}
                <div className="relative w-full flex items-center justify-center">
                  <div className="relative flex items-center justify-center" style={{ width: 280, height: 280 }}>
                    {/* SVG Arc Ring — 270° open at bottom */}
                    <svg className="absolute inset-0" viewBox="0 0 280 280">
                      {(() => {
                        const r = 128;
                        const circumference = 2 * Math.PI * r;
                        const arcFrac = 0.75; // 270°
                        const arcLen = circumference * arcFrac;
                        const gapLen = circumference - arcLen;
                        const startAngle = 135;
                        const segDuration = isPreparation ? 10 : (currentSegment?.duration || 1);
                        const progress = Math.min(1, Math.max(0, timeRemaining / segDuration));
                        const filledLen = arcLen * progress;
                        return (
                          <>
                            <circle cx="140" cy="140" r={r} fill="none" stroke="hsl(var(--surface-3))" strokeWidth="5" strokeDasharray={`${arcLen} ${gapLen}`} strokeDashoffset={-circumference * (startAngle / 360)} strokeLinecap="round" />
                            <circle cx="140" cy="140" r={r} fill="none" stroke={accentHsl} strokeWidth="10" strokeDasharray={`${filledLen} ${circumference - filledLen}`} strokeDashoffset={-circumference * (startAngle / 360)} strokeLinecap="round" filter="blur(4px)" className="animate-arc-glow-pulse" style={{ transition: 'stroke-dasharray 0.3s linear' }} />
                            <circle cx="140" cy="140" r={r} fill="none" stroke={accentHsl} strokeWidth="5" strokeDasharray={`${filledLen} ${circumference - filledLen}`} strokeDashoffset={-circumference * (startAngle / 360)} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.3s linear' }} />
                          </>
                        );
                      })()}
                    </svg>
                    <span className={cn(
                      "timer-display font-black",
                      "timer-display text-7xl font-black",
                      isChampionship 
                        ? "text-championship-gold animate-gold-shimmer" 
                        : isCooldown ? "text-cooldown-blue" : "text-volt text-glow-volt"
                    )}>
                      {formatTime(timeRemaining)}
                    </span>
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                      <ComboXPPop pop={comboXPPop} />
                    </div>
                  </div>
                  {/* Vertical XP Bar — pinned to right wall */}
                  <div className="absolute right-0 top-0 bottom-4 flex items-stretch">
                    <VerticalXPBar prestige={profile?.prestige || 'beginner'} level={liveLevel} totalXP={(profile?.total_xp || 0) + currentXP} badgeStats={currentStats} earnedBadgeIds={earnedBadgeIds} isChampionship={isChampionship} isCooldown={isCooldown} />
                  </div>
                </div>

          {/* Segment Name — what you're doing right now */}
          <div className="flex items-center gap-3 mb-4 whitespace-nowrap w-full">
            <div className={cn("h-px flex-1 min-w-4", isChampionship ? "bg-championship-gold/40" : isCooldown ? "bg-cooldown-blue/40" : "bg-muted-foreground/30")} />
            <h2 className={cn(
              "text-xl font-black uppercase tracking-wider text-center shrink-0",
              isChampionship ? "text-championship-gold" : isCooldown ? "text-cooldown-blue" : "text-foreground"
            )}>
              {isPreparation ? 'PREPARATION' : (
                <>
                  {currentSegment?.name || 'WORK'}
                  {isChampionship && <span className="text-championship-gold"> / 2XP</span>}
                </>
              )}
            </h2>
            <div className={cn("h-px flex-1 min-w-4", isChampionship ? "bg-championship-gold/40" : isCooldown ? "bg-cooldown-blue/40" : "bg-muted-foreground/30")} />
          </div>


          <div className="flex gap-2">
            {['-30', '-15', '+15', '+30'].map((val) => (
              <button
                key={val}
                onClick={() => adjustTime(parseInt(val))}
                className="px-3 py-1.5 rounded-full border border-surface-3 text-muted-foreground text-xs font-medium hover:bg-surface-1 transition-colors"
              >
                {val}s
              </button>
            ))}
          </div>
          </div>
          {/* END Layer 1 — timer group is now self-contained */}

          {/* Layer 2: absolute, lower portion only — combo/UP NEXT cards */}
          <div className="absolute left-4 right-4 bottom-0 flex flex-col items-center justify-end pointer-events-none pb-2">
            <div className="pointer-events-auto w-full flex flex-col items-center">
          {/* Rest Screen - Clean Next Preview */}
          {isRestSegment && (
            <div className={cn("w-full max-w-xs rounded-xl p-3 border", isChampionship ? "bg-championship-gold/5 border-championship-gold/30" : isCooldown ? "bg-cooldown-blue/5 border-cooldown-blue/30" : "bg-surface-1 border-surface-3")}>
              <p className={cn("text-[10px] uppercase tracking-wider mb-1 text-center", isChampionship ? "text-championship-gold/60" : isCooldown ? "text-cooldown-blue/60" : "text-muted-foreground")}>UP NEXT</p>
              <p className={cn("text-lg font-black text-center uppercase", isChampionship ? "text-championship-gold" : isCooldown ? "text-cooldown-blue" : "text-foreground")}>
                {nextSegment?.name || 'FINISH'}
              </p>
            </div>
          )}

          {/* Combo Display - for shadowboxing: show incoming combo OR freestyle */}
          {isShadowboxing && !isPreparation && (
            <div className="w-full max-w-xs bg-surface-1 rounded-xl p-3 border border-surface-3">
              {displayCombo && displayCombo.length > 0 ? (
                <>
                  {/* Incoming combo label for shadowboxing */}
                  <p className={cn("text-xs font-bold mb-3 text-center animate-pulse", accentText)}>INCOMING COMBO</p>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {displayCombo.map((move, idx) => {
                      const displayMove = (() => {
                        const m = move.toUpperCase();
                        if (m === 'JAB') return '1';
                        if (m === 'CROSS' || m === 'STRAIGHT') return '2';
                        if (m === 'LEAD HOOK' || m === 'LEFT HOOK') return '3';
                        if (m === 'REAR HOOK' || m === 'RIGHT HOOK') return '4';
                        if (m === 'LEAD UPPERCUT' || m === 'LEFT UPPERCUT') return '5';
                        if (m === 'REAR UPPERCUT' || m === 'RIGHT UPPERCUT') return '6';
                        if (m === 'LEAD BODY HOOK' || m === 'LEFT BODY') return '7';
                        if (m === 'REAR BODY HOOK' || m === 'RIGHT BODY') return '8';
                        if (m.includes('SLIP L')) return 'SL';
                        if (m.includes('SLIP R')) return 'SR';
                        if (m.includes('ROLL L')) return 'RL';
                        if (m.includes('ROLL R')) return 'RR';
                        if (m === 'PULL') return 'PL';
                        if (m === 'BLOCK') return 'BK';
                        if (m.includes('CIRCLE L')) return '↺';
                        if (m.includes('CIRCLE R')) return '↻';
                        if (m.includes('STEP IN')) return '→';
                        if (m.includes('STEP OUT')) return '←';
                        return move;
                      })();
                      
                      return (
                        <div key={idx} className="flex items-center gap-1">
                          <span className={cn('text-2xl font-black', accentText)}>
                            {displayMove}
                          </span>
                          {idx < displayCombo.length - 1 && (
                            <ChevronRight className="w-3 h-3 text-muted-foreground" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className={cn("text-2xl font-black text-center", accentText)}>FREESTYLE</p>
              )}
            </div>
          )}
          
          {/* Combo Display for combo segments */}
          {!isShadowboxing && displayCombo && displayCombo.length > 0 && !isPreparation && (currentSegment?.segmentType === 'combo' || currentSegment?.segmentType === 'speedbag' || currentSegment?.segmentType === 'doubleend') && (
            <div className="w-full max-w-xs bg-surface-1 rounded-xl p-3 border border-surface-3">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {displayCombo.map((move, idx) => {
                  const displayMove = (() => {
                    const m = move.toUpperCase();
                    if (m === 'JAB') return '1';
                    if (m === 'CROSS' || m === 'STRAIGHT') return '2';
                    if (m === 'LEAD HOOK' || m === 'LEFT HOOK') return '3';
                    if (m === 'REAR HOOK' || m === 'RIGHT HOOK') return '4';
                    if (m === 'LEAD UPPERCUT' || m === 'LEFT UPPERCUT') return '5';
                    if (m === 'REAR UPPERCUT' || m === 'RIGHT UPPERCUT') return '6';
                    if (m === 'LEAD BODY HOOK' || m === 'LEFT BODY') return '7';
                    if (m === 'REAR BODY HOOK' || m === 'RIGHT BODY') return '8';
                    if (m.includes('SLIP L')) return 'SL';
                    if (m.includes('SLIP R')) return 'SR';
                    if (m.includes('ROLL L')) return 'RL';
                    if (m.includes('ROLL R')) return 'RR';
                    if (m === 'PULL') return 'PL';
                    if (m === 'BLOCK') return 'BK';
                    if (m.includes('CIRCLE L')) return '↺';
                    if (m.includes('CIRCLE R')) return '↻';
                    if (m.includes('STEP IN')) return '→';
                    if (m.includes('STEP OUT')) return '←';
                    return move;
                  })();
                  
                  return (
                    <div key={idx} className="flex items-center gap-1">
                          <span className={cn('text-2xl font-black', accentText)}>
                        {displayMove}
                      </span>
                      {idx < displayCombo.length - 1 && (
                        <ChevronRight className="w-3 h-3 text-muted-foreground" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Freestyle Display */}
          {!isShadowboxing && !isPreparation && currentSegment?.type === 'active' && 
           (currentSegment?.segmentType === 'combo' || currentSegment?.segmentType === 'speedbag' || currentSegment?.segmentType === 'doubleend') &&
           (!displayCombo || displayCombo.length === 0) && (
            <div className="w-full max-w-xs bg-surface-1 rounded-xl p-3 border border-surface-3">
              <p className={cn("text-2xl font-black text-center", accentText)}>FREESTYLE</p>
            </div>
          )}
            </div>
          </div>
          {/* END Layer 2 */}
        </div>

        {/* Bottom Section */}
        <div className="px-4 pb-6 safe-bottom">
          {/* Compact Phase + Progress */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            <span className="font-bold text-foreground text-xs">
              {isPreparation ? 'PREP' : currentSegment?.phaseName || 'WARMUP'}
            </span>
            <div className="flex items-center gap-1.5">
              <span className={cn("w-1.5 h-1.5 rounded-full", isChampionship ? "bg-championship-gold" : isCooldown ? "bg-cooldown-blue" : "bg-volt")} />
              <span className="text-xs">{isPreparation ? flatSegments[0]?.name : nextSegment?.name || 'FINISH'}</span>
            </div>
          </div>
          <div className="h-1 bg-surface-2 rounded-full overflow-hidden mb-1">
            <div 
              className={cn("h-full transition-all duration-300", isChampionship ? "bg-championship-gold" : isCooldown ? "bg-cooldown-blue" : "bg-volt")}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mb-2">
            <span>{isPreparation ? 'PREP' : currentSegment?.section?.toUpperCase()}</span>
            <span className={cn("font-bold", isChampionship ? "text-championship-gold" : isCooldown ? "text-cooldown-blue" : "text-volt")}>
              {isPreparation ? '0' : currentSegmentIndex + 1}/{totalSegments}
            </span>
          </div>



          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            {/* Back Button */}
            <button
              onClick={handleBack}
              disabled={isPreparation}
              className="w-12 h-12 rounded-full bg-surface-1 border border-surface-3 flex items-center justify-center disabled:opacity-30"
            >
              <SkipBack className="w-5 h-5 text-foreground" />
            </button>

            {/* Play/Pause */}
            <button
              onClick={isPaused ? handleStart : handlePauseResume}
              className={cn("w-20 h-20 rounded-full flex items-center justify-center", isChampionship ? "bg-championship-gold glow-gold" : isCooldown ? "bg-cooldown-blue" : "bg-volt glow-volt")}
            >
              {isPaused ? (
                <Play className="w-8 h-8 text-primary-foreground ml-1" fill="currentColor" />
              ) : (
                <Pause className="w-8 h-8 text-primary-foreground" />
              )}
            </button>

            {/* Skip Forward */}
            <button
              onClick={handleSkip}
              className="w-12 h-12 rounded-full bg-surface-1 border border-surface-3 flex items-center justify-center"
            >
              <SkipForward className="w-5 h-5 text-foreground" />
            </button>
          </div>
        </div>
        {/* Exit Confirmation Dialog */}
        <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
          <AlertDialogContent className="bg-surface-1 border-surface-3">
            <AlertDialogHeader>
              <AlertDialogTitle>Leave Workout?</AlertDialogTitle>
              <AlertDialogDescription>
                {accumulatedXP > 0 
                  ? `You have +${Math.round(accumulatedXP)} XP accumulated. Leaving without logging will discard your XP.`
                  : "Are you sure you want to leave this workout?"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel className="bg-surface-2 border-surface-3 hover:bg-surface-3">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => handleConfirmExit()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Leave
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Restart Confirmation Dialog */}
        <AlertDialog open={showRestartConfirm} onOpenChange={setShowRestartConfirm}>
          <AlertDialogContent className="bg-surface-1 border-surface-3">
            <AlertDialogHeader>
              <AlertDialogTitle>Restart Workout?</AlertDialogTitle>
              <AlertDialogDescription>
                {accumulatedXP > 0 
                  ? `Your current progress (+${Math.round(accumulatedXP)} XP) will be saved before restarting.`
                  : "This will reset the workout to the beginning."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-surface-2 border-surface-3 hover:bg-surface-3">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmRestart} className="bg-volt text-primary-foreground hover:bg-volt/90">
                Restart
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default WorkoutSession;
