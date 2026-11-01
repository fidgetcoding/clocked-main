import type { SegmentType, WorkoutPhase, WorkoutSegment } from '@/types';
import type { Badge } from '@/data/badges';
import type { PostL100Badge } from '@/data/postL100Badges';
import { splitStoredPhases } from '@/lib/storedPhases';
import { lazy, Suspense, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Home, Play, Pause, RotateCcw, SkipForward, SkipBack, ChevronRight, MoreVertical, CheckCircle, Zap, Flame, Trophy, Camera } from 'lucide-react';
import { RoundFeedbackPanel } from '@/components/workout/RoundFeedbackPanel';
import { RoundFeedback } from '@/types';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { VerticalXPBar } from '@/components/ui/VerticalXPBar';
import { ResumeSessionDialog } from '@/components/workout/ResumeSessionDialog';
import { clearSession, findResumableSession, saveSession, type SessionSnapshot } from '@/lib/sessionRecovery';

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
import { useRepeatingCheck } from '@/hooks/useRepeatingCheck';
import { cn } from '@/lib/utils';
import { ACTIVITY_XP_RATES, ActivityType, getStreakMultiplier, getActivityTypeFromName, calculateComboXP, getLevelFromXP, Prestige, isPrestigeEligible as checkPrestigeEligible, isMaxLevel as checkIsMaxLevel } from '@/lib/xpSystem';
import { computePostLogStats, computePostL100Increments } from '@/lib/workoutTracking';
import { buildSessionBadgeStats, FRESH_SESSION, getSessionCredit, getSessionEffort, noteTraining, qualifiesForRewards, SessionLog, toSessionFacts } from '@/lib/sessionEffort';
import { checkBadges, sumBadgeXP } from '@/data/badges';
import { checkPostL100Badges } from '@/data/postL100Badges';
import { LevelUpOverlay } from '@/components/ui/LevelUpOverlay';
import { PostWorkoutSummary, SessionXPBreakdown } from '@/components/workout/PostWorkoutSummary';
import { usePostWorkoutComplete } from '@/hooks/useCommunityPosts';
import { wholeSecondsSince } from '@/lib/sessionClock';
import { usePunchPrefsStore } from '@/stores/punchPrefsStore';
import type { PunchSessionReport } from '@/lib/punch/round';

// Lazy so the camera pipeline stays out of the main bundle
const PunchCameraPanel = lazy(() => import('@/components/punch/PunchCameraPanel'));

interface TempSegment {
  segment: WorkoutSegment;
  sectionName: 'warmup' | 'grind' | 'cooldown';
  phase: WorkoutPhase;
  repeatIndex: number;
  megasetIndex?: number;
}

interface FlatSegment {
  id: string;
  name: string;
  type: 'active' | 'rest';
  segmentType?: SegmentType;
  duration: number;
  phaseName: string;
  section: 'warmup' | 'grind' | 'cooldown';
  combo?: string[];
  drill?: string[];
  nextCombo?: string[];
  intensity?: string;
  reps?: number;
  repeatIndex?: number;
  megasetIndex?: number;
  cumulativeRound?: number;
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
const PREPARATION_SECONDS = 30;

// Speed bag drills are names; everything else in a combo list is punch or defense notation
const isDrillEntry = (entry: string[]) =>
  entry.some((token) => !/^\d/.test(token) && !/^(SLIP|ROLL|DUCK|PULL|BLOCK|PARRY|STEP|CIRCLE|PIVOT|FREESTYLE)/.test(token));

// A phase can share one list between a speed bag and punches, and each should only see its own
const mixesDrillsAndPunches = (phase: WorkoutPhase) => {
  const types = phase.segments.map((segment) => segment.segmentType);
  return types.includes('speedbag') && types.some((type) => type === 'combo' || type === 'shadowboxing' || type === 'doubleend');
};

function dbWorkoutToLocal(dbWorkout: DbWorkout) {
  const { sections, megasetRepeats } = splitStoredPhases(dbWorkout.phases);
  
  // Each phase carries its own combos now; this list only exists on older workouts
  const combos: string[][] = dbWorkout.combos || [];
  
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

  const preferences = user?.preferences as {
    voiceAnnouncements?: boolean;
    voiceCountdown?: boolean;
    voiceComboCallouts?: boolean;
  } | undefined;

  const oneOffLoadout = (location.state)?.oneOffLoadout;
  const oneOffName = (location.state)?.workoutName;

  const dbWorkout = workouts.find((w) => w.id === id);
  
  const workout = useMemo(() => {
    if (dbWorkout) return dbWorkoutToLocal(dbWorkout);
    if (oneOffLoadout) {
      const { sections, megasetRepeats } = splitStoredPhases(oneOffLoadout.phases);
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
    
    const sectionOrder: { sectionName: 'warmup' | 'grind' | 'cooldown' }[] = [
      { sectionName: 'warmup' },
      ...Array.from({ length: megasetCount }, () => ({ sectionName: 'grind' as const })),
      { sectionName: 'cooldown' },
    ];

    const hasWarmup = workout.sections.warmup.length > 0;
    const hasCooldown = workout.sections.cooldown.length > 0;
    const hasGrind = workout.sections.grind.length > 0;

    const makeTransitionRest = (name: string, sectionName: 'warmup' | 'grind' | 'cooldown'): TempSegment => ({
      segment: { id: `transition-${name}`, name, type: 'rest' as const, segmentType: 'rest', duration: 30 },
      sectionName,
      phase: { id: `transition-${name}`, name, repeats: 1, segments: [], comboOrder: 'sequential' },
      repeatIndex: 0,
      megasetIndex: undefined,
    });
    
    const tempSegments: TempSegment[] = [];
    
    let grindIterationIndex = 0;
    sectionOrder.forEach(({ sectionName }) => {
      const currentMegasetIndex = sectionName === 'grind' ? grindIterationIndex : undefined;
      const isFirstGrind = sectionName === 'grind' && grindIterationIndex === 0;
      if (sectionName === 'grind') grindIterationIndex++;
      const phases = workout.sections[sectionName];
      if (phases.length === 0) return;

      if (isFirstGrind && hasWarmup && hasGrind) {
        tempSegments.push(makeTransitionRest('Get Ready', 'grind'));
      }

      if (sectionName === 'cooldown' && hasGrind && hasCooldown) {
        tempSegments.push(makeTransitionRest('Recovery', 'cooldown'));
      }

      phases.forEach((phase) => {
        for (let r = 0; r < phase.repeats; r++) {
          phase.segments.forEach((segment) => {
            tempSegments.push({ segment, sectionName, phase, repeatIndex: r, megasetIndex: currentMegasetIndex });
          });
        }
      });
    });
    
    // Two-pass combo assignment
    const comboSegmentIndices: number[] = [];
    const shadowboxIndices: number[] = [];
    
    tempSegments.forEach((item, idx) => {
      const { segment, phase } = item;
      const isSpeedbag = segment.segmentType === 'speedbag';
      const isDoubleend = segment.segmentType === 'doubleend';
      if (isSpeedbag || isDoubleend) return;
      const isComboSegment = segment.segmentType === 'combo' || segment.comboIndex === 'cycle';
      const isShadowboxing = segment.segmentType === 'shadowboxing' || 
                             segment.name.toLowerCase().includes('shadow') || 
                             segment.name.toLowerCase().includes('technique');
      
      // BUG 2 FIX A: NEVER assign combos to explicit exercise segments
      const isExplicitExercise = segment.segmentType === 'exercise' || 
        ['pushups', 'pushup', 'push-ups', 'burpees', 'burpee', 'curlups', 'curlup', 'curl-ups', 'sit-ups', 'situps',
         'jump rope', 'jog', 'jog in place', 'treadmill', 'high knees', 'plank'].some(
          ex => segment.name.toLowerCase().includes(ex)
        );
      
      const phaseCombos = phase.combos as string[][] | undefined;
      const phaseHasCombos = phaseCombos && phaseCombos.length > 0;
      const phaseHasComboSegments = phase.segments?.some((s) => 
        ['combo', 'shadowboxing', 'speedbag', 'doubleend'].includes(s.segmentType || '')
      );
      const isExerciseSegment = !isExplicitExercise && (
        segment.type === 'active' && segment.segmentType === 'work' && phaseHasCombos && !phaseHasComboSegments
      );
      
      if (isComboSegment || isExerciseSegment) comboSegmentIndices.push(idx);
      else if (isShadowboxing) shadowboxIndices.push(idx);
    });
    
    const totalCombos = workout.combos?.length || 0;
    const comboAssignments: Map<number, string[]> = new Map();
    const assigned = 0;
    
    const getComboListForPhase = (phase: WorkoutPhase): string[][] => {
      const phaseCombos = (phase.combos as string[][] | undefined)?.filter(
        (entry) => !mixesDrillsAndPunches(phase) || !isDrillEntry(entry),
      );
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
    
    const phaseComboLists: Map<string, { list: string[][]; cursor: number }> = new Map();
    
    const getPhaseCombo = (phase: WorkoutPhase, phaseKey: string, sectionName: TempSegment['sectionName']): string[] | undefined => {
      const hasOwnCombos = !!phase.combos && phase.combos.length > 0;
      // A workout-wide combo list is for the rounds. A warmup or cooldown without combos stays freestyle.
      if (!hasOwnCombos && (totalCombos === 0 || sectionName !== 'grind')) return undefined;
      if (!phaseComboLists.has(phaseKey)) {
        phaseComboLists.set(phaseKey, { list: getComboListForPhase(phase), cursor: 0 });
      }
      const entry = phaseComboLists.get(phaseKey)!;
      if (entry.cursor >= entry.list.length) return undefined;
      return entry.list[entry.cursor++];
    };
    
    const allBoxingIndices = [...comboSegmentIndices, ...shadowboxIndices].sort((a, b) => a - b);
    const roundComboCache: Map<string, string[]> = new Map();
    
    for (const idx of allBoxingIndices) {
      const { phase, repeatIndex, sectionName } = tempSegments[idx];
      const roundKey = `${phase.id}-${repeatIndex}`;
      
      if (roundComboCache.has(roundKey)) {
        comboAssignments.set(idx, roundComboCache.get(roundKey)!);
      } else {
        const phaseKey = `${phase.id}`;
        const combo = getPhaseCombo(phase, phaseKey, sectionName);
        if (combo) {
          roundComboCache.set(roundKey, combo);
          comboAssignments.set(idx, combo);
        }
      }
    }
    
    // Speed bag and double-end segments show what was picked for them, from their own list when
    // a phase mixes drills and punches. Kept apart from combos, which also drive XP.
    const bagLists = new Map<string, string[][]>();
    const bagRounds = new Map<string, string[] | undefined>();
    const bagDrillFor = ({ segment, phase, repeatIndex }: TempSegment): string[] | undefined => {
      if (segment.segmentType !== 'speedbag' && segment.segmentType !== 'doubleend') return undefined;
      const roundKey = `${phase.id}-${repeatIndex}-${segment.segmentType}`;
      if (bagRounds.has(roundKey)) return bagRounds.get(roundKey);
      const listKey = `${phase.id}-${segment.segmentType}`;
      if (!bagLists.has(listKey)) {
        const list = ((phase.combos as string[][] | undefined) ?? []).filter(
          (entry) => !mixesDrillsAndPunches(phase) || isDrillEntry(entry) === (segment.segmentType === 'speedbag'),
        );
        if (phase.comboOrder === 'random') list.sort(() => Math.random() - 0.5);
        bagLists.set(listKey, list);
      }
      const drill = bagLists.get(listKey)!.shift();
      bagRounds.set(roundKey, drill);
      return drill;
    };

    let cumulativeRound = 0;
    let lastPhaseId = '';
    let lastRepeatIndex = -1;
    
    tempSegments.forEach((item, idx) => {
      const { segment, sectionName, phase, repeatIndex, megasetIndex } = item;
      
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
        drill: bagDrillFor(item),
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
  const [timeRemaining, setTimeRemaining] = useState(PREPARATION_SECONDS);
  // Time trained: the preparation countdown doesn't count
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [sessionLog, setSessionLog] = useState<SessionLog>(FRESH_SESSION);
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
  const [punchSummary, setPunchSummary] = useState<PunchSessionReport | null>(null);
  const [cameraSession, setCameraSession] = useState(0);
  const cameraOn = usePunchPrefsStore((state) => state.workoutCamera);
  const setCameraOn = usePunchPrefsStore((state) => state.setWorkoutCamera);
  const [sessionResult, setSessionResult] = useState<SessionXPBreakdown | null>(null);
  
  // Badge system
  const { earnedBadgeIds, awardBadges, currentStats } = useBadges();
  
  // BUG 3: Live badge tracking during workout
  const [liveBadgesEarned, setLiveBadgesEarned] = useState<Array<{ badge: Badge | PostL100Badge; earnedAt: number }>>([]);
  const liveBadgeIdsRef = useRef<Set<string>>(new Set());
  const [latestBadgePop, setLatestBadgePop] = useState<{ badge: Badge | PostL100Badge; id: number } | null>(null);
  
  // BUG 4 FIX: Only count grind phases that have at least one boxing segment
  const roundCount = useMemo(() => {
    if (!workout) return 0;
    let count = 0;
    for (const phase of workout.sections.grind) {
      const hasBoxingSegment = phase.segments?.some((s) => 
        ['shadowboxing', 'combo', 'doubleend', 'speedbag'].includes(s.segmentType || '')
      );
      if (hasBoxingSegment) {
        count += phase.repeats;
      }
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
  const isChampionship = !isPreparation && !!currentSegment && 
    currentSegment.phaseName.toLowerCase().includes('championship');
  const isCooldown = !isPreparation && (
    currentSegment?.section === 'cooldown' || 
    currentSegment?.phaseName?.toLowerCase() === 'cooldown'
  );
  
  const accentText = isChampionship ? 'text-championship-gold' : isCooldown ? 'text-cooldown-blue' : 'text-volt';
  const accentText60 = isChampionship ? 'text-championship-gold/60' : isCooldown ? 'text-cooldown-blue/60' : 'text-volt/60';
  const accentHsl = isChampionship ? 'hsl(var(--championship-gold))' : isCooldown ? 'hsl(var(--cooldown-blue))' : 'hsl(var(--electric-volt))';

  const streakMultiplier = getStreakMultiplier(profile?.current_streak || 0);
  
  const getActivityTypeFromSegment = (segment: FlatSegment | undefined): ActivityType => {
    if (!segment) return 'active';
    return getActivityTypeFromName(segment.name, segment.type === 'rest' ? 'rest' : segment.segmentType);
  };
  
  const currentXP = accumulatedXP;

  // Wall-clock ref for background-safe timing
  const lastTickTimeRef = useRef<number>(Date.now());
  const prevLevelRef = useRef<number | null>(null);
  // BUG 1 FIX: Track whether user has pressed play
  const sessionActiveRef = useRef(false);

  const { playLevelUpSound } = useSoundEffects();

  const liveLevel = getLevelFromXP(
    (profile?.prestige || 'beginner'),
    (profile?.total_xp || 0) + accumulatedXP
  );

  // BUG 1 FIX: Level-up detection — only fire after play + XP earned
  useEffect(() => {
    if (prevLevelRef.current === null) {
      prevLevelRef.current = liveLevel;
      return;
    }
    if (sessionActiveRef.current && accumulatedXP > 0 && liveLevel > prevLevelRef.current) {
      setLevelUpLevel(liveLevel);
      playLevelUpSound();
    }
    prevLevelRef.current = liveLevel;
  }, [liveLevel, playLevelUpSound, accumulatedXP]);

  const isBoxingSegment = useCallback((segment: FlatSegment) => {
    const st = segment.segmentType;
    return st === 'shadowboxing' || st === 'combo' || st === 'doubleend';
  }, []);

  const getXPPerSecond = useCallback((segment: FlatSegment) => {
    const activityType = getActivityTypeFromSegment(segment);
    let xpPerSecond = ACTIVITY_XP_RATES[activityType];
    
    if (activityType === 'combo' && segment.combo && segment.combo.length > 0) {
      const totalComboXP = calculateComboXP(segment.combo, segment.duration);
      xpPerSecond = totalComboXP / segment.duration;
    }
    
    if (segment.phaseName.toLowerCase().includes('championship') && isBoxingSegment(segment)) {
      xpPerSecond *= 2;
    }
    
    return xpPerSecond;
  }, [isBoxingSegment]);

  // BUG 3: Live badge checking — runs every ~5 seconds during workout
  useRepeatingCheck(() => {
    if (!profile || !qualifiesForRewards(totalElapsed)) return;

    const tier = (profile.prestige || 'beginner') as Prestige;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const lastDate = profile.last_workout_date;
    let newStreak: number;
    if (lastDate === todayStr) {
      newStreak = profile.current_streak || 1;
    } else if (lastDate === yesterdayStr) {
      newStreak = (profile.current_streak || 0) + 1;
    } else {
      newStreak = 1;
    }
    
    const liveStats = buildSessionBadgeStats(profile, tier, totalElapsed, newStreak, toSessionFacts(sessionLog, flatSegments));
    
    const alreadyEarned = [...earnedBadgeIds, ...Array.from(liveBadgeIdsRef.current)];
    const newBadges = checkBadges(liveStats, alreadyEarned);
    
    if (newBadges.length > 0) {
      for (const badge of newBadges) {
        if (!liveBadgeIdsRef.current.has(badge.id)) {
          liveBadgeIdsRef.current.add(badge.id);
          setLiveBadgesEarned(prev => [...prev, { badge, earnedAt: Date.now() }]);
          setAccumulatedXP(prev => prev + badge.xpReward);
          
          const popId = Date.now();
          setLatestBadgePop({ badge, id: popId });
          setTimeout(() => setLatestBadgePop(prev => prev?.id === popId ? null : prev), 3000);
        }
      }
    }
  }, 5000, !isComplete && isRunning && !isPaused && !!profile);

  // Compute session result when workout completes
  useEffect(() => {
    if (!isComplete || sessionResult || !profile) return;
    
    const streakMult = getStreakMultiplier(profile.current_streak || 0);
    const liveBadgeXP = liveBadgesEarned.reduce((s, lb) => s + lb.badge.xpReward, 0);
    const effectiveBase = Math.round(accumulatedXP);
    const timerOnlyBase = effectiveBase - liveBadgeXP;
    const rawBase = streakMult > 1 ? Math.round(timerOnlyBase / streakMult) : timerOnlyBase;
    const streakBonus = timerOnlyBase - rawBase;
    
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

    const earnedRewards = qualifiesForRewards(totalElapsed);
    if (!earnedRewards) {
      newStreak = profile.current_streak || 0;
      streakBroken = false;
    }
    
    const tier = (profile.prestige || 'beginner') as Prestige;
    
    const updatedStats = buildSessionBadgeStats(profile, tier, totalElapsed, newStreak, toSessionFacts(sessionLog, flatSegments));
    
    // BUG 3 FIX: Exclude live-earned badges from post-workout check to avoid double-counting
    const liveEarnedIds = Array.from(liveBadgeIdsRef.current);
    const newCoreBadges = earnedRewards ? checkBadges(updatedStats, [...earnedBadgeIds, ...liveEarnedIds]) : [];
    
    const currentLevel = profile.current_level || 1;
    let newPostL100Badges: PostL100Badge[] = [];
    if (earnedRewards && currentLevel >= 100) {
      const postL100StatsForCheck = {
        ...updatedStats,
        postL100Sessions: (profile?.post_l100_sessions || 0) + 1,
        overflowXp: profile?.overflow_xp || 0,
        tiersCompleted: profile?.tiers_completed || 0,
        totalLevelsEarned: profile?.total_levels_earned || 0,
        rookieSessionsToL100: profile?.rookie_sessions_to_l100 || 0,
        beginnerSessionsToL100: profile?.beginner_sessions_to_l100 || 0,
        intermediateSessionsToL100: profile?.intermediate_sessions_to_l100 || 0,
        advancedSessionsToL100: profile?.advanced_sessions_to_l100 || 0,
        proSessionsToL100: profile?.pro_sessions_to_l100 || 0,
        doubleDays: (profile)?.double_days || 0,
        morningWorkouts: (profile)?.morning_workouts || 0,
        nightWorkouts: (profile)?.night_workouts || 0,
        weekendWorkouts: (profile)?.weekend_workouts || 0,
        weekdayWorkouts: (profile)?.weekday_workouts || 0,
        perfectMonths: profile?.perfect_months || 0,
        comebackCount: (profile)?.comeback_count || 0,
        mondayWorkouts: profile?.monday_workouts || 0,
        fridayWorkouts: profile?.friday_workouts || 0,
        sundayWorkouts: profile?.sunday_workouts || 0,
        accountAgeDays: profile?.created_at ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000) : 0,
        newYearsWorkout: profile?.new_years_workout ? 1 : 0,
        birthdayWorkout: profile?.birthday_workout ? 1 : 0,
        holidayWorkouts: profile?.holiday_workouts || 0,
        singleSessionXp: Math.max(profile?.best_session_xp || 0, effectiveBase),
        totalBadges: earnedBadgeIds.length + liveEarnedIds.length + newCoreBadges.length,
        streakRecoveries: profile?.streak_recoveries || 0,
        avgXpPerSession: profile?.workouts_completed ? Math.round(((profile?.total_xp || 0) + effectiveBase) / ((profile.workouts_completed || 0) + 1)) : effectiveBase,
        punch1Count: (profile)?.punch_1_count || 0,
        punch2Count: (profile)?.punch_2_count || 0,
        punch3Count: (profile)?.punch_3_count || 0,
        punch4Count: (profile)?.punch_4_count || 0,
        punch5Count: (profile)?.punch_5_count || 0,
        punch6Count: (profile)?.punch_6_count || 0,
        punch7Count: (profile)?.punch_7_count || 0,
        punch8Count: (profile)?.punch_8_count || 0,
        slipsCount: (profile)?.slips_count || 0,
        rollsCount: (profile)?.rolls_count || 0,
        pullbacksCount: (profile)?.pullbacks_count || 0,
        circlesCount: (profile)?.circles_count || 0,
      };
      newPostL100Badges = checkPostL100Badges(postL100StatsForCheck, [...earnedBadgeIds, ...liveEarnedIds, ...newCoreBadges.map(b => b.id)]);
    }
    
    const liveBadges = liveBadgesEarned.map(lb => lb.badge);
    const allNewBadges = [...liveBadges, ...newCoreBadges, ...newPostL100Badges];
    const badgeXP = allNewBadges.reduce((sum, b) => sum + b.xpReward, 0);
    const sessionTotal = timerOnlyBase + badgeXP;
    const totalXPAfter = (profile.total_xp || 0) + sessionTotal;
    const levelBefore = profile.current_level || 1;
    const levelAfter = getLevelFromXP(tier, totalXPAfter);
    
    setSessionResult({
      baseXP: rawBase,
      streakMultiplier: streakMult,
      streakBonus,
      effectiveBase: timerOnlyBase,
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
      belowRewardMinimum: !earnedRewards,
    });
  }, [isComplete, sessionResult, profile, accumulatedXP, totalElapsed, earnedBadgeIds, liveBadgesEarned, sessionLog, flatSegments]);

  // Background-safe timer using wall-clock deltas
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isRunning && !isPaused) {
      lastTickTimeRef.current = Date.now();
      
      interval = setInterval(() => {
        const now = Date.now();
        const { seconds: delta, lastTick } = wholeSecondsSince(lastTickTimeRef.current, now);
        if (delta < 1) return;
        lastTickTimeRef.current = lastTick;

        setTimeRemaining(prev => prev - delta);
        
        if (!isPreparation && currentSegment) {
          setTotalElapsed(prev => prev + delta);
          setSessionLog(log => noteTraining(log, currentSegment));
          const xpPerSecond = getXPPerSecond(currentSegment);
          const xpGained = xpPerSecond * streakMultiplier * delta;
          setAccumulatedXP(prev => prev + xpGained);
        }
      }, 250);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, isPaused, isPreparation, currentSegment, streakMultiplier, getXPPerSecond]);

  // Instant catch-up when tab becomes visible again
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isRunning && !isPaused) {
        // The next interval tick (every 250ms) will compute the large delta
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isRunning, isPaused]);

  const prevSegmentIndexRef = useRef<number>(-1);
  const xpAwardedRef = useRef(false);
  const prevComboSegRef = useRef<number>(-1);

  // Voice countdown at 3 seconds
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

    if (!isPreparation && currentSegment && isRunning && !isPaused) {
      if (preferences?.voiceAnnouncements !== false) {
        let announcement = '';
        if (currentSegment.type === 'rest') {
          announcement = 'Rest';
        } else if (currentSegment.segmentType === 'shadowboxing' || currentSegment.name.toLowerCase().includes('shadow')) {
          announcement = 'Shadowboxing';
        } else if (currentSegment.segmentType === 'speedbag') {
          announcement = currentSegment.name.includes('Freestyle') ? 'Speed Bag Freestyle' : currentSegment.name;
        } else if (currentSegment.segmentType === 'doubleend') {
          announcement = currentSegment.name.includes('Freestyle') ? 'Double End Bag Freestyle' : 'Double End Bag';
        } else if (currentSegment.segmentType === 'combo') {
          announcement = currentSegment.name.includes('Freestyle') ? 'Heavy Bag Freestyle' : 'Heavy Bag';
        } else {
          announcement = currentSegment.name;
        }
        speak(announcement, { rate: 0.9 });

        // BUG 2 FIX B: Only call out combos for boxing-type segments
        const isBoxingTypeSegment = currentSegment.segmentType === 'shadowboxing' || 
                                    currentSegment.segmentType === 'combo' || 
                                    currentSegment.segmentType === 'doubleend' ||
                                    currentSegment.segmentType === 'speedbag';
        const combo = currentSegment.combo ?? currentSegment.drill;
        if (combo && combo.length > 0 && isBoxingTypeSegment && preferences?.voiceComboCallouts !== false) {
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
        setSessionLog(log => ({ ...log, ranToEnd: true }));
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

  // The bonus for showing up lands with the first second trained, so skipping to the end earns nothing
  const startBonusPaidRef = useRef(false);
  useEffect(() => {
    if (totalElapsed === 0 || startBonusPaidRef.current) return;
    startBonusPaidRef.current = true;
    setAccumulatedXP(prev => prev + 10);
    showXpBubble(10);
  }, [totalElapsed]);

  const handleStart = () => {
    initSpeech();
    sessionActiveRef.current = true; // BUG 1 FIX: Mark session as active
    setIsRunning(true);
    setIsPaused(false);
    setHasStartedOnce(true);
  };

  const handlePauseResume = () => {
    if (!isPaused && !isPreparation) setSessionLog(log => ({ ...log, paused: true }));
    setIsPaused((prev) => !prev);
  };

  const handleReset = () => {
    setCurrentSegmentIndex(0);
    setTimeRemaining(PREPARATION_SECONDS);
    setTotalElapsed(0);
    setSessionLog(FRESH_SESSION);
    setAccumulatedXP(0);
    setIsRunning(false);
    setIsPaused(true);
    setIsPreparation(true);
    setIsComplete(false);
    setHasAwardedXP(false);
    xpAwardedRef.current = false;
  };

  // Keep the run in this browser, so a reload or a killed tab can pick it back up
  const [resumable, setResumable] = useState<SessionSnapshot | null>(null);
  const resumeChecked = useRef(false);
  const sessionEnded = useRef(false);

  const endSession = () => {
    sessionEnded.current = true;
    clearSession();
  };

  useEffect(() => {
    // Until a second has been trained there's nothing worth coming back to
    if (totalElapsed === 0 || logged || sessionEnded.current || !workout || !user?.id) return;
    saveSession({
      userId: user.id,
      workoutId: workout.id,
      segmentCount: flatSegments.length,
      segmentIndex: currentSegmentIndex,
      timeRemaining,
      totalElapsed,
      isPreparation,
      timerXP: accumulatedXP - liveBadgesEarned.reduce((sum, earned) => sum + earned.badge.xpReward, 0),
      log: sessionLog,
      isComplete,
    });
  }, [logged, workout, user?.id, flatSegments.length, currentSegmentIndex, timeRemaining, totalElapsed, isPreparation, accumulatedXP, liveBadgesEarned, sessionLog, isComplete]);

  // Comes back paused with the clock where it was. Only trained runs get saved, so the start bonus is already in timerXP.
  const restoreSession = useCallback((saved: SessionSnapshot) => {
    prevSegmentIndexRef.current = saved.segmentIndex;
    setCurrentSegmentIndex(saved.segmentIndex);
    setTimeRemaining(saved.timeRemaining);
    setTotalElapsed(saved.totalElapsed);
    setIsPreparation(saved.isPreparation);
    setAccumulatedXP(saved.timerXP);
    setSessionLog(saved.log);
    startBonusPaidRef.current = true;
    setHasStartedOnce(true);
    setIsPaused(true);
    setIsRunning(!saved.isComplete);
    setIsComplete(saved.isComplete);
    xpAwardedRef.current = saved.isComplete;
    setHasAwardedXP(saved.isComplete);
    setResumable(null);
  }, []);

  useEffect(() => {
    if (resumeChecked.current || !workout || flatSegments.length === 0 || !user?.id) return;
    resumeChecked.current = true;
    const saved = findResumableSession(user.id, workout.id, flatSegments.length);
    if (!saved) return;
    if (location.state?.resume) restoreSession(saved);
    else setResumable(saved);
  }, [workout, flatSegments.length, user?.id, location.state, restoreSession]);

  // The browser's back button or a back swipe asks first, same as the home button
  useEffect(() => {
    if (!isRunning || isComplete) return;
    window.history.pushState(null, '');
    const askBeforeLeaving = () => {
      window.history.pushState(null, '');
      setShowExitConfirm(true);
    };
    window.addEventListener('popstate', askBeforeLeaving);
    return () => window.removeEventListener('popstate', askBeforeLeaving);
  }, [isRunning, isComplete]);

  const handleConfirmExit = (saveXP: boolean = false) => {
    endSession();
    cancelSpeech();
    setShowExitConfirm(false);
    navigate('/');
  };

  const handleConfirmRestart = () => {
    clearSession();
    cancelSpeech();
    setShowRestartConfirm(false);
    setCurrentSegmentIndex(0);
    setTimeRemaining(PREPARATION_SECONDS);
    setTotalElapsed(0);
    setSessionLog(FRESH_SESSION);
    setAccumulatedXP(0);
    setIsRunning(false);
    setIsPaused(true);
    setIsPreparation(true);
    setIsComplete(false);
    setHasAwardedXP(false);
    xpAwardedRef.current = false;
    setPunchSummary(null);
    setCameraSession((n) => n + 1);
  };

  const handleBack = () => {
    if (isPreparation) return;
    if (currentSegmentIndex > 0) {
      const prevSegment = flatSegments[currentSegmentIndex - 1];
      setCurrentSegmentIndex((prev) => prev - 1);
      setTimeRemaining(prevSegment.duration);
    } else {
      setIsPreparation(true);
      setTimeRemaining(PREPARATION_SECONDS);
    }
  };

  const handleSkip = () => {
    if (isPreparation) {
      setIsPreparation(false);
      setTimeRemaining(flatSegments[0]?.duration || 60);
    } else if (currentSegmentIndex < flatSegments.length - 1) {
      setSessionLog(log => ({ ...log, cutShort: true }));
      setCurrentSegmentIndex((prev) => prev + 1);
      setTimeRemaining(flatSegments[currentSegmentIndex + 1].duration);
    } else {
      handleCompleteEarly();
    }
  };

  const handleCompleteEarly = () => {
    cancelSpeech();
    setIsComplete(true);
    setIsRunning(false);
    xpAwardedRef.current = true;
    setHasAwardedXP(true);
    
    if (dbWorkout) {
      updateWorkout.mutate({
        id: dbWorkout.id,
        times_completed: (dbWorkout.times_completed || 0) + 1,
        last_used_at: new Date().toISOString(),
      });
    }
  };

  const noteCutShort = () => {
    if (!isPreparation) setSessionLog(log => ({ ...log, cutShort: true }));
  };

  const adjustTime = (delta: number) => {
    if (delta < 0) noteCutShort();
    setTimeRemaining((prev) => Math.max(0, prev + delta));
  };

  const halveTime = () => {
    noteCutShort();
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
      });
    } catch (e) {
      console.error('Prestige failed:', e);
    }
  };

  const handleLog = async () => {
    if (!sessionResult) return;
    // Gone before anything is awarded, so a reload in the middle of this can't log it twice
    endSession();
    
    const tier = (profile?.prestige || 'beginner') as Prestige;
    
    if (sessionResult.newBadges.length > 0) {
      try {
        await awardBadges.mutateAsync(sessionResult.newBadges);
      } catch (e) { console.error('Badge award failed:', e); }
    }
    
    if (sessionResult.sessionTotal > 0) {
      try { addLocalXP(sessionResult.sessionTotal, true); } catch (e) { console.error('Local XP update failed:', e); }
    }
    
    addHistoryEntry.mutate({
      workout_id: workout?.id || null,
      workout_name: workout?.name || 'Workout',
      completed_at: new Date().toISOString(),
      duration: totalElapsed,
      xp_earned: sessionResult.sessionTotal,
      difficulty: difficultyRating || null,
      notes: [notes, punchSummary?.total ? punchSummary.note : ''].filter(Boolean).join('\n') || null,
      punch_log: punchSummary?.log ?? null,
      is_manual_entry: false,
      round_feedback: feedbackMode === 'advanced' ? roundFeedback : [],
    }, {
      onSuccess: async () => {
        setLogged(true);
        if (qualifiesForRewards(totalElapsed)) {
          postWorkoutComplete.mutate({
            workoutName: workout?.name || 'Workout',
            xpEarned: sessionResult.sessionTotal,
            duration: totalElapsed,
          });
        }
        if (user?.id && profile) {
          const postLogStats = await computePostLogStats(profile.user_id, profile, totalElapsed);
          if (postLogStats) {
            const postL100Increments = computePostL100Increments(
              profile,
              sessionResult.sessionTotal,
              flatSegments,
              getSessionEffort(totalElapsed),
            );
            const credit = getSessionCredit(totalElapsed, tier, sessionLog.content);
            
            
            updateProfile.mutate({
              ...postLogStats,
              ...postL100Increments,
              total_xp: (profile.total_xp || 0) + sessionResult.sessionTotal,
              combos_landed: (profile.combos_landed || 0) + credit.combos,
              total_pushups: (profile.total_pushups || 0) + credit.pushups,
              total_burpees: (profile.total_burpees || 0) + credit.burpees,
              total_curlups: (profile.total_curlups || 0) + credit.curlups,
              total_jog_run_minutes: (profile.total_jog_run_minutes || 0) + credit.jogRunMinutes,
              complex_combos: (profile.complex_combos || 0) + credit.complexCombos,
              defense_combos: (profile.defense_combos || 0) + credit.defenseCombos,
              counter_combos: (profile.counter_combos || 0) + credit.counterCombos,
            });
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
          punchSummary={punchSummary}
          logged={logged}
          onNavigateHome={() => {
            endSession();
            navigate('/');
          }}
          onPrestige={handlePrestige}
        />
      </AppLayout>
    );
  }

  const isShadowboxing = currentSegment?.segmentType === 'shadowboxing' || 
                         currentSegment?.name.toLowerCase().includes('shadow') || 
                         currentSegment?.name.toLowerCase().includes('technique');
  const isSpeedbag = currentSegment?.segmentType === 'speedbag';
  const isDoubleend = currentSegment?.segmentType === 'doubleend';
  const rawCombo = (isSpeedbag || isDoubleend) ? currentSegment?.drill : (isShadowboxing ? (currentSegment?.combo || currentSegment?.nextCombo) : currentSegment?.combo);
  const isFreestyleCombo = rawCombo?.length === 1 && rawCombo[0] === 'FREESTYLE';
  const displayCombo = isFreestyleCombo ? undefined : rawCombo;

  const isRestSegment = currentSegment?.type === 'rest' && !isPreparation;
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

  const getDisplayMove = (move: string): { display: string; type: 'punch' | 'defense' | 'movement' } => {
    const m = move.toUpperCase();
    if (m === 'JAB') return { display: '1', type: 'punch' };
    if (m === 'CROSS' || m === 'STRAIGHT') return { display: '2', type: 'punch' };
    if (m === 'LEAD HOOK' || m === 'LEFT HOOK') return { display: '3', type: 'punch' };
    if (m === 'REAR HOOK' || m === 'RIGHT HOOK') return { display: '4', type: 'punch' };
    if (m === 'LEAD UPPERCUT' || m === 'LEFT UPPERCUT') return { display: '5', type: 'punch' };
    if (m === 'REAR UPPERCUT' || m === 'RIGHT UPPERCUT') return { display: '6', type: 'punch' };
    if (m === 'LEAD BODY HOOK' || m === 'LEFT BODY') return { display: '7', type: 'punch' };
    if (m === 'REAR BODY HOOK' || m === 'RIGHT BODY') return { display: '8', type: 'punch' };
    if (m.includes('SLIP L')) return { display: 'SL', type: 'defense' };
    if (m.includes('SLIP R')) return { display: 'SR', type: 'defense' };
    if (m.includes('ROLL L')) return { display: 'RL', type: 'defense' };
    if (m.includes('ROLL R')) return { display: 'RR', type: 'defense' };
    if (m === 'PULL') return { display: 'PL', type: 'defense' };
    if (m === 'BLOCK') return { display: 'BK', type: 'defense' };
    if (m.includes('CIRCLE L')) return { display: '↺', type: 'movement' };
    if (m.includes('CIRCLE R')) return { display: '↻', type: 'movement' };
    if (m.includes('STEP IN')) return { display: '→', type: 'movement' };
    if (m.includes('STEP OUT')) return { display: '←', type: 'movement' };
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
        <header className="flex items-start justify-between px-4 py-3 safe-top relative z-10">
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
            <button
              onClick={() => setCameraOn(!cameraOn)}
              aria-label="Punch camera"
              aria-pressed={cameraOn}
              title="Punch camera"
              className={cn(
                "px-3 py-2 rounded-full border transition-colors",
                cameraOn ? "bg-volt/20 border-volt/40 text-volt" : "bg-surface-1 border-surface-3 text-muted-foreground hover:text-foreground"
              )}
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex flex-col items-end gap-1 relative">
            {xpBubble && (
              <div 
                key={xpBubble.id}
                className={cn("absolute right-full mr-2 top-1/2 -translate-y-1/2 font-bold text-sm whitespace-nowrap animate-xp-bubble pointer-events-none", accentText)}
              >
                +{xpBubble.amount} XP
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className={cn("timer-display text-2xl font-black", accentText60)}>
                {formatTimeCompact(totalElapsed)}
              </span>
            </div>
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

        {/* Sits in the corner clear of the timer and combos. Only boxing segments are counted. */}
        {cameraOn && hasStartedOnce && (
          <Suspense fallback={null}>
            <PunchCameraPanel
              key={cameraSession}
              counting={
                isRunning && !isPaused && !isPreparation && !!currentSegment &&
                currentSegment.type !== 'rest' && (isBoxingSegment(currentSegment) || isShadowboxing)
              }
              onSummary={setPunchSummary}
              className="fixed left-4 top-[4.5rem] z-10"
            />
          </Suspense>
        )}

        {/* Level Up Overlay */}
        {levelUpLevel !== null && (
          <LevelUpOverlay
            level={levelUpLevel}
            variant={isChampionship ? 'championship' : isCooldown ? 'cooldown' : 'volt'}
            onComplete={() => setLevelUpLevel(null)}
          />
        )}

        {/* BUG 3: Live Badge Notification — shows earned badges during workout */}
        {latestBadgePop && (
          <div 
            key={latestBadgePop.id}
            className="flex items-center justify-center gap-2 px-4 py-2 z-20 relative"
            style={{ animation: 'badge-overlay-in 0.4s ease-out forwards' }}
          >
            <div className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full border",
              "bg-championship-gold/15 border-championship-gold/30"
            )}
            style={{ animation: 'badge-pulse 1s ease-in-out infinite' }}
            >
              <Trophy className="w-4 h-4 text-championship-gold" />
              <span className="text-xs font-bold text-championship-gold uppercase tracking-wide">
                {latestBadgePop.badge.name}
              </span>
              <span className="text-xs font-black text-volt">
                +{latestBadgePop.badge.xpReward.toLocaleString()} XP
              </span>
            </div>
          </div>
        )}
        {/* Badge tally — persistent count when no pop is active */}
        {liveBadgesEarned.length > 0 && !latestBadgePop && (
          <div className="flex items-center justify-center gap-2 px-4 py-1 z-20 relative">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-championship-gold/15 border border-championship-gold/30">
              <Trophy className="w-3 h-3 text-championship-gold" />
              <span className="text-[10px] font-bold text-championship-gold">
                {liveBadgesEarned.length} badge{liveBadgesEarned.length !== 1 ? 's' : ''} · +{liveBadgesEarned.reduce((s, lb) => s + lb.badge.xpReward, 0).toLocaleString()} XP
              </span>
            </div>
          </div>
        )}

        {/* Main Timer — middle area between top bar and bottom bar */}
        {/* On short screens and laptops the two layers stack in normal flow, so a combo card can never land on the timer or the controls */}
        <div className="flex-1 relative px-4 min-h-[26rem] [@media(max-height:700px)]:min-h-0 [@media(max-height:700px)]:flex [@media(max-height:700px)]:flex-col [@media(max-height:700px)]:justify-center [@media(max-height:700px)]:gap-2 md:[@media(max-height:900px)]:min-h-0 md:[@media(max-height:900px)]:flex md:[@media(max-height:900px)]:flex-col md:[@media(max-height:900px)]:justify-center md:[@media(max-height:900px)]:gap-2">
          {/* Layer 1: Fixed, vertically centered — phase name, timer, segment */}
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4 -mt-[24%] md:mt-0 [@media(max-height:700px)]:static [@media(max-height:700px)]:mt-0 md:[@media(max-height:900px)]:static">
                {/* Phase Name */}
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
                  <div className="relative flex items-center justify-center w-[280px] h-[280px] [@media(max-height:700px)]:w-[max(150px,27vh)] [@media(max-height:700px)]:h-[max(150px,27vh)] md:[@media(max-height:760px)]:w-[max(150px,27vh)] md:[@media(max-height:760px)]:h-[max(150px,27vh)]">
                    {/* SVG Arc Ring — 270° open at bottom */}
                    <svg className="absolute inset-0" viewBox="0 0 280 280">
                      {(() => {
                        const r = 128;
                        const circumference = 2 * Math.PI * r;
                        const arcFrac = 0.75;
                        const arcLen = circumference * arcFrac;
                        const gapLen = circumference - arcLen;
                        const startAngle = 135;
                        const segDuration = isPreparation ? PREPARATION_SECONDS : (currentSegment?.duration || 1);
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
                      "timer-display text-7xl font-black [@media(max-height:700px)]:text-[length:max(36px,7vh)] md:[@media(max-height:760px)]:text-[length:max(36px,7vh)]",
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

          {/* Segment Name */}
          <div className="flex items-center gap-3 mb-4 whitespace-nowrap w-full max-w-sm mx-auto">
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

          <div className="flex gap-2 relative z-10">
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
          {/* END Layer 1 */}

          {/* Layer 2: absolute, lower portion only — combo/UP NEXT cards */}
          <div className="absolute left-4 right-4 flex flex-col items-center justify-start pointer-events-none top-[80%] md:top-[78%] [@media(max-height:700px)]:static [@media(max-height:700px)]:min-h-[5.5rem] md:[@media(max-height:900px)]:static md:[@media(max-height:900px)]:min-h-[5.5rem]">
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

          {/* Combo Display - for shadowboxing */}
          {isShadowboxing && !isPreparation && (
            <div className="w-full max-w-xs bg-surface-1 rounded-xl p-3 border border-surface-3">
              {displayCombo && displayCombo.length > 0 ? (
                <>
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
            <button
              onClick={handleBack}
              disabled={isPreparation}
              className="w-12 h-12 rounded-full bg-surface-1 border border-surface-3 flex items-center justify-center disabled:opacity-30"
            >
              <SkipBack className="w-5 h-5 text-foreground" />
            </button>

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

            <button
              onClick={handleSkip}
              className="w-12 h-12 rounded-full bg-surface-1 border border-surface-3 flex items-center justify-center"
            >
              <SkipForward className="w-5 h-5 text-foreground" />
            </button>
          </div>
        </div>
        {resumable && (
          <ResumeSessionDialog
            name={workout.name}
            saved={resumable}
            onResume={() => restoreSession(resumable)}
            onDiscard={() => {
              clearSession();
              setResumable(null);
            }}
          />
        )}
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
                  ? `This starts over from the beginning and drops the +${Math.round(accumulatedXP)} XP from this run.`
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
