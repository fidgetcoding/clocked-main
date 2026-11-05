import { toast } from 'sonner';
import type { SegmentType, WorkoutPhase, WorkoutSegment } from '@/types';
import type { Badge } from '@/data/badges';
import type { PostL100Badge } from '@/data/postL100Badges';
import { splitStoredPhases } from '@/lib/storedPhases';
import { lazy, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { RoundFeedbackPanel } from '@/components/workout/RoundFeedbackPanel';
import { RoundFeedback } from '@/types';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { RunStage } from '@/components/broadcast/run/RunStage';
import { comboText, toComboMove } from '@/components/broadcast/run/moves';
import type { RunKind, RunView } from '@/components/broadcast/run/types';
import type { CameraFeedState } from '@/components/punch/feedState';
import { ResumeSessionDialog } from '@/components/workout/ResumeSessionDialog';
import { clearSession, findResumableSession, saveSession, type SessionSnapshot } from '@/lib/sessionRecovery';

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
import { useTimesCompleted } from '@/hooks/useTimesCompleted';
import { useWorkoutHistory } from '@/hooks/useWorkoutHistory';
import { useUserStore } from '@/stores/userStore';
import { useProfile } from '@/hooks/useProfile';
import { useUserRole } from '@/hooks/useUserRole';
import { useSpeechSynthesis, useVoicePreload } from '@/hooks/useSpeechSynthesis';
import { useCoachTalk } from '@/hooks/useCoachTalk';
import { useSegmentAnnouncement } from '@/hooks/useSegmentAnnouncement';
import { useVoiceStore } from '@/stores/voiceStore';
import { endsRound, isWorkRound, roundStart } from '@/lib/voice/coachTalk';
import { coachLine, comboLine, lineForText, lineIds, numberLine, roundLine, voiceLine, VOICE_LINES } from '@/lib/voice/lines';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useBadges } from '@/hooks/useBadges';
import { useRepeatingCheck } from '@/hooks/useRepeatingCheck';
import { ACTIVITY_XP_RATES, ActivityType, getStreakMultiplier, getActivityTypeFromName, calculateComboXP, getLevelFromXP, getLevelProgress, getXPWithinCurrentLevel, Prestige, isPrestigeEligible as checkPrestigeEligible, isMaxLevel as checkIsMaxLevel } from '@/lib/xpSystem';
import { computePostLogStats, computePostL100Increments } from '@/lib/workoutTracking';
import { CameraBoundary } from '@/components/errors/CameraBoundary';
import { useSessionPunchLog } from '@/hooks/useSessionPunchLog';
import { buildSessionBadgeStats, FRESH_SESSION, getSessionCredit, getSessionEffort, noteTraining, qualifiesForRewards, SessionLog, toSessionFacts } from '@/lib/sessionEffort';
import { checkBadges, sumBadgeXP } from '@/data/badges';
import { checkPostL100Badges } from '@/data/postL100Badges';
import { LevelUpOverlay } from '@/components/ui/LevelUpOverlay';
import { PostWorkoutSummary, SessionXPBreakdown } from '@/components/workout/PostWorkoutSummary';
import { usePostWorkoutComplete } from '@/hooks/useCommunityPosts';
import { splitSessionTick, wholeSecondsSince } from '@/lib/sessionClock';
import { usePunchPrefsStore } from '@/stores/punchPrefsStore';
import type { PunchSessionReport } from '@/lib/punch/round';

// Lazy so the camera pipeline stays out of the main bundle
const CAMERA_FAILED = "The camera couldn't load. Your session carries on without it. Reload to try again.";
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

/** What's said when a segment starts. */
function segmentAnnouncement(segment: FlatSegment): string {
  if (segment.type === 'rest') return 'Rest';
  if (segment.segmentType === 'shadowboxing' || segment.name.toLowerCase().includes('shadow')) return 'Shadowboxing';
  if (segment.segmentType === 'speedbag') return segment.name.includes('Freestyle') ? 'Speed Bag Freestyle' : segment.name;
  if (segment.segmentType === 'doubleend') return segment.name.includes('Freestyle') ? 'Double End Bag Freestyle' : 'Double End Bag';
  if (segment.segmentType === 'combo') return segment.name.includes('Freestyle') ? 'Heavy Bag Freestyle' : 'Heavy Bag';
  return segment.name;
}

/** The combo or drill called out after the announcement. Only boxing segments get one. */
function segmentCallout(segment: FlatSegment): string[] | null {
  const boxing = ['shadowboxing', 'combo', 'doubleend', 'speedbag'].includes(segment.segmentType ?? '');
  const combo = segment.combo ?? segment.drill;
  return boxing && combo && combo.length > 0 ? combo : null;
}

const WorkoutSession = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { workouts, updateWorkout } = useWorkouts();
  const { addHistoryEntry } = useWorkoutHistory();
  const postWorkoutComplete = usePostWorkoutComplete();
  const { profile, addXP: addProfileXP, updateProfile, creditSession } = useProfile();
  const { isAdmin } = useUserRole();
  const user = useUserStore((state) => state.user);
  const addLocalXP = useUserStore((state) => state.addXP);
  const { initialize: initSpeech, speak, speakQueued, isRecorded, cancel: cancelSpeech } = useSpeechSynthesis();
  const { playWarningBeep } = useSoundEffects();

  const preferences = user?.preferences as {
    voiceCountdown?: boolean;
    voiceComboCallouts?: boolean;
  } | undefined;

  const oneOffLoadout = (location.state)?.oneOffLoadout;
  const oneOffName = (location.state)?.workoutName;

  const dbWorkout = workouts.find((w) => w.id === id);
  const { mutate: updateWorkoutRow } = updateWorkout;
  const { ranToEnd: countRanToEnd, saved: countSaved, reset: resetTimesCompleted } = useTimesCompleted(dbWorkout, updateWorkoutRow);
  
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
      
      // The Get Ready before the first round isn't a round
      const isRound = sectionName === 'grind' && !phase.id.startsWith('transition-');
      if (isRound) {
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
        cumulativeRound: isRound ? cumulativeRound : undefined,
      });
    });
    
    return segments;
  }, [workout]);

  // Every line this workout can say, ready before it's needed
  const voiceIds = useMemo(() => {
    const ids = new Set(lineIds(voiceLine('clock-3-2-1', 'clock-10-seconds')));
    for (const line of VOICE_LINES) if (line.section === 'coach') ids.add(line.id);
    for (const segment of flatSegments) if (segment.cumulativeRound) for (const id of lineIds(numberLine(segment.cumulativeRound))) ids.add(id);
    for (const segment of flatSegments) {
      for (const id of lineIds(lineForText(segmentAnnouncement(segment)))) ids.add(id);
      const combo = segmentCallout(segment);
      if (combo) for (const id of lineIds(comboLine(combo))) ids.add(id);
    }
    return [...ids];
  }, [flatSegments]);
  useVoicePreload(voiceIds);

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
  const [cameraFailed, setCameraFailed] = useState(false);
  const onCameraFailed = useCallback(() => {
    setCameraFailed(true);
    toast.error(CAMERA_FAILED);
  }, []);
  const punchLog = useSessionPunchLog(totalElapsed);
  const { snapshot: punchSnapshot, restore: restorePunchLog } = punchLog;
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
  const [feed, setFeed] = useState<CameraFeedState | null>(null);
  const [feedProblemDismissed, setFeedProblemDismissed] = useState(false);
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
  useCoachTalk({
    segments: flatSegments,
    index: currentSegmentIndex,
    timeRemaining,
    live: isRunning && !isPaused && !isPreparation && !isComplete,
    isComplete,
    punches: cameraOn ? punchLog.log.totals.punches : null,
    seenCombo: cameraOn ? feed?.combo ?? null : null,
  });
  const nextSegment = flatSegments[currentSegmentIndex + 1];
  const totalSegments = flatSegments.length;
  const isChampionship = !isPreparation && !!currentSegment && 
    currentSegment.phaseName.toLowerCase().includes('championship');
  const isCooldown = !isPreparation && (
    currentSegment?.section === 'cooldown' || 
    currentSegment?.phaseName?.toLowerCase() === 'cooldown'
  );
  
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
    
    // A new best session, said after "Workout done". Recorded voice only
    const bestBefore = profile.best_session_xp || 0;
    if (earnedRewards && bestBefore > 0 && effectiveBase > bestBefore) speakQueued(coachLine('newBest'), { recordedOnly: true });

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
  }, [isComplete, sessionResult, profile, accumulatedXP, totalElapsed, earnedBadgeIds, liveBadgesEarned, sessionLog, flatSegments, speakQueued]);

  const clockPosition = useRef({ currentSegmentIndex, timeRemaining, isPreparation });
  clockPosition.current = { currentSegmentIndex, timeRemaining, isPreparation };

  const tickInputs = useRef({ flatSegments, streakMultiplier, getXPPerSecond });
  tickInputs.current = { flatSegments, streakMultiplier, getXPPerSecond };

  // Background-safe timer using wall-clock deltas, credited to the segments actually crossed.
  // Restarts only on play/pause: a natural segment change keeps the partial second already counted.
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isRunning && !isPaused) {
      lastTickTimeRef.current = Date.now();
      
      interval = setInterval(() => {
        const now = Date.now();
        const { seconds: delta, lastTick } = wholeSecondsSince(lastTickTimeRef.current, now);
        if (delta < 1) return;
        lastTickTimeRef.current = lastTick;

        const { flatSegments, streakMultiplier, getXPPerSecond } = tickInputs.current;
        const position = clockPosition.current;
        const { consumedSeconds, trained } = splitSessionTick(
          flatSegments, position.currentSegmentIndex, position.timeRemaining, position.isPreparation, delta,
        );
        setTimeRemaining(prev => prev - consumedSeconds);

        if (trained.length > 0) {
          setTotalElapsed(prev => prev + trained.reduce((sum, entry) => sum + entry.seconds, 0));
          setSessionLog(log => trained.reduce((current, entry) => noteTraining(current, entry.segment), log));
          const xpGained = trained.reduce((sum, entry) => sum + getXPPerSecond(entry.segment) * entry.seconds, 0) * streakMultiplier;
          setAccumulatedXP(prev => prev + xpGained);
        }
      }, 250);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, isPaused]);

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
  const localXPPaid = useRef(false);
  const historySaved = useRef(false);
  // One id per run, kept with the saved run, so its history row is only ever added once
  const historyId = useRef<string>(crypto.randomUUID());
  const prevComboSegRef = useRef<number>(-1);

  // Voice countdown at 3 seconds
  useEffect(() => {
    if (timeRemaining === 3 && isRunning && !isPaused) {
      if (preferences?.voiceCountdown !== false) {
        speak(voiceLine('clock-3-2-1'), { rate: 0.8 });
      }
    }
  }, [timeRemaining, isRunning, isPaused, preferences, speak]);

  // 10-second warning voice and beep
  useEffect(() => {
    if (timeRemaining === 10 && isRunning && !isPaused && !isPreparation) {
      // In a round, "Last ten, let's go" once it's recorded
      if (preferences?.voiceCountdown !== false && !(isWorkRound(currentSegment) && speak(coachLine('lastTen'), { recordedOnly: true }))) {
        speak(voiceLine('clock-10-seconds'), { rate: 0.9 });
      }
      playWarningBeep();
    }
  }, [timeRemaining, isRunning, isPaused, isPreparation, preferences, speak, playWarningBeep, currentSegment]);

  const voiceOn = useVoiceStore(state => state.voiceOn);
  // Stable lifecycle inputs keep ordinary clock renders from cancelling the delayed combo.
  useSegmentAnnouncement({
    index: currentSegmentIndex,
    active: !isPreparation && !!currentSegment && isRunning && !isPaused && !isComplete,
    voiceOn,
    comboOn: preferences?.voiceComboCallouts !== false,
    previousIndex: prevSegmentIndexRef,
    announce: () => {
      if (!currentSegment) return;
      const announcement = lineForText(segmentAnnouncement(currentSegment));
      const combo = segmentCallout(currentSegment);
      const callCombo = combo && preferences?.voiceComboCallouts !== false;
      // "Time" as a round ends, "Round, Three" as one starts, then "Fight" if there's no combo to call.
      // Recorded voice only, and only ahead of a recorded announcement so two voices never talk at once
      const start = roundStart(flatSegments, currentSegmentIndex);
      const leadIn = endsRound(flatSegments, currentSegmentIndex) ? coachLine('time') : start ? roundLine(start.round, start.last) : null;
      const led = !!leadIn && isRecorded(announcement) && speak(leadIn, { recordedOnly: true });
      (led ? speakQueued : speak)(announcement, { rate: 0.9 });
      if (led && start && !callCombo) speakQueued(coachLine('fight'), { recordedOnly: true });
      if (callCombo) {
        const line = comboLine(combo);
        const timer = setTimeout(() => (led && isRecorded(line) ? speakQueued : speak)(line, { rate: 0.85 }), 1200);
        return () => clearTimeout(timer);
      }
    },
  });

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
        countRanToEnd();
      }
    }
  }, [timeRemaining, isRunning, isPreparation, currentSegmentIndex, flatSegments, countRanToEnd, cancelSpeech, isComplete, accumulatedXP, streakMultiplier, isBoxingSegment]);


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
    if (!isPaused) cancelSpeech();
    if (!isPaused && !isPreparation) setSessionLog(log => ({ ...log, paused: true }));
    setIsPaused((prev) => !prev);
  };

  const handleReset = () => {
    cancelSpeech();
    prevSegmentIndexRef.current = -1;
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
      punchLog: punchSnapshot(),
      isComplete,
      historyId: historyId.current,
    });
  }, [punchSnapshot, logged, workout, user?.id, flatSegments.length, currentSegmentIndex, timeRemaining, totalElapsed, isPreparation, accumulatedXP, liveBadgesEarned, sessionLog, isComplete]);

  // Comes back paused with the clock where it was. Only trained runs get saved, so the start bonus is already in timerXP.
  const restoreSession = useCallback((saved: SessionSnapshot) => {
    if (saved.historyId) historyId.current = saved.historyId;
    prevSegmentIndexRef.current = saved.segmentIndex;
    setCurrentSegmentIndex(saved.segmentIndex);
    setTimeRemaining(saved.timeRemaining);
    setTotalElapsed(saved.totalElapsed);
    setIsPreparation(saved.isPreparation);
    setAccumulatedXP(saved.timerXP);
    setSessionLog(saved.log);
    restorePunchLog(saved.punchLog);
    startBonusPaidRef.current = true;
    setHasStartedOnce(true);
    setIsPaused(true);
    setIsRunning(!saved.isComplete);
    setIsComplete(saved.isComplete);
    xpAwardedRef.current = saved.isComplete;
    setHasAwardedXP(saved.isComplete);
    setResumable(null);
  }, [restorePunchLog]);

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

  const handleConfirmExit = () => {
    endSession();
    cancelSpeech();
    setShowExitConfirm(false);
    navigate('/');
  };

  const handleConfirmRestart = () => {
    clearSession();
    resetTimesCompleted();
    historyId.current = crypto.randomUUID();
    cancelSpeech();
    prevSegmentIndexRef.current = -1;
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
    cancelSpeech();
    lastTickTimeRef.current = Date.now();
    if (currentSegmentIndex > 0) {
      const prevSegment = flatSegments[currentSegmentIndex - 1];
      setCurrentSegmentIndex((prev) => prev - 1);
      setTimeRemaining(prevSegment.duration);
    } else {
      prevSegmentIndexRef.current = -1;
      setIsPreparation(true);
      setTimeRemaining(PREPARATION_SECONDS);
    }
  };

  const handleSkip = () => {
    cancelSpeech();
    // A jump starts the new segment on a fresh second
    lastTickTimeRef.current = Date.now();
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
    // Counted toward times_completed only once it's saved, in handleLog
  };

  // End & Save finishes the session the way Done does, then logs it and goes home without stopping at the summary.
  // Waits for the result, so the XP and stats are worked out in the one place they always are.
  const [savingOnLeave, setSavingOnLeave] = useState(false);
  const logRef = useRef<() => Promise<void>>();
  const leaveLogged = useRef(false);
  useEffect(() => {
    if (!savingOnLeave || !sessionResult || leaveLogged.current) return;
    leaveLogged.current = true;
    void logRef.current?.().finally(() => navigate('/'));
  }, [savingOnLeave, sessionResult, navigate]);

  const handleEndAndSave = () => {
    setShowExitConfirm(false);
    setSavingOnLeave(true);
    handleCompleteEarly();
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
            <p className="fx mb-4 text-4xl">Workout not found</p>
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
    
    if (sessionResult.sessionTotal > 0 && !localXPPaid.current) {
      localXPPaid.current = true;
      try { addLocalXP(sessionResult.sessionTotal, true); } catch (e) { console.error('Local XP update failed:', e); }
    }
    
    // mutateAsync, because End & Save leaves the page and a callback passed to mutate would never run
    try {
      // A retry after the stats failed doesn't put the session in the history twice
      if (!historySaved.current) {
        await addHistoryEntry.mutateAsync({
        id: historyId.current,
        workout_id: workout?.id || null,
        workout_name: workout?.name || 'Workout',
        completed_at: new Date().toISOString(),
        duration: totalElapsed,
        xp_earned: sessionResult.sessionTotal,
        difficulty: difficultyRating || null,
        notes: [notes, punchSummary?.total ? punchSummary.note : ''].filter(Boolean).join('\n') || null,
        punch_log: punchLog.finish() ?? undefined,
        is_manual_entry: false,
        round_feedback: feedbackMode === 'advanced' ? roundFeedback : [],
        });
        historySaved.current = true;
        countSaved();
        if (qualifiesForRewards(totalElapsed)) {
          postWorkoutComplete.mutate({
            workoutName: workout?.name || 'Workout',
            xpEarned: sessionResult.sessionTotal,
            duration: totalElapsed,
          });
        }
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
          
          
          // Counted once per history entry on the server, so a retry or a second tab can't double it
          await creditSession.mutateAsync({ historyId: historyId.current, base: profile, update: {
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
          } });
        }
      }
      // Only now: the streak and totals are saved too
      setLogged(true);
    } catch (error) {
      console.error('Failed to log workout:', error);
      toast.error("Couldn't save your workout. Check your connection and try again.");
      // Still in this browser until it's really saved, so a reload can pick it back up
      sessionEnded.current = false;
      setSessionLog((log) => ({ ...log }));
    }
  };
  logRef.current = handleLog;

  // Workout complete screen
  if (isComplete) {
    if (savingOnLeave) {
      return (
        <AppLayout hideNav>
          <div className="min-h-screen flex items-center justify-center">
            <p className="fx text-4xl text-volt">Saving...</p>
          </div>
        </AppLayout>
      );
    }
    if (!sessionResult) {
      return (
        <AppLayout hideNav>
          <div className="min-h-screen flex items-center justify-center">
            <p className="fx text-4xl text-volt">Calculating results...</p>
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

  const toMoves = (combo: string[] | undefined) => (combo ?? []).map(toComboMove);
  const usesCombos = isShadowboxing || currentSegment?.segmentType === 'combo' || isSpeedbag || isDoubleend;
  const shownCombo = !isPreparation && !isRestSegment && usesCombos ? toMoves(displayCombo) : [];
  const kind: RunKind = isPreparation
    ? 'prep'
    : isRestSegment
      ? 'rest'
      : shownCombo.length > 0
        ? isSpeedbag || isDoubleend ? 'drill' : 'combo'
        : usesCombos
          ? 'freestyle'
          : 'exercise';
  const nextWithCombo = flatSegments.slice(isPreparation ? 0 : currentSegmentIndex + 1).find((segment) => segment.combo?.length && segment.combo[0] !== 'FREESTYLE');
  const preview = isRestSegment && restComboPreview ? restComboPreview : nextWithCombo?.combo;
  const totalRounds = flatSegments.reduce((most, segment) => Math.max(most, segment.cumulativeRound ?? 0), 0);
  const round = !isPreparation ? currentSegment?.cumulativeRound ?? null : null;
  const totalXP = (profile?.total_xp || 0) + currentXP;
  const prestige = profile?.prestige || 'beginner';
  const within = getXPWithinCurrentLevel(prestige, totalXP);

  const runView: RunView = {
    workoutName: workout.name,
    phaseName: isPreparation ? 'PREP' : currentSegment?.phaseName || 'WARMUP',
    segmentName: isPreparation ? 'PREPARATION' : currentSegment?.name || 'WORK',
    kind,
    idle: !hasStartedOnce,
    paused: isPaused,
    clock: formatTime(Math.max(0, timeRemaining)),
    remaining: timeRemaining,
    duration: isPreparation ? PREPARATION_SECONDS : currentSegment?.duration || 1,
    round,
    roundLabel: round ? `Round ${round} of ${totalRounds}` : null,
    championship: isChampionship,
    cooldown: isCooldown,
    comboLabel: shownCombo.length === 0 ? null : isShadowboxing ? 'INCOMING COMBO' : isSpeedbag || isDoubleend ? 'DRILL' : 'COMBO',
    combo: shownCombo,
    nextCombo: preview ? comboText(toMoves(preview)) : null,
    upNext: isPreparation ? flatSegments[0]?.name || 'WORK' : nextSegment?.name || 'FINISH',
    upNextSeconds: isPreparation ? flatSegments[0]?.duration ?? null : nextSegment?.duration ?? null,
    segmentIndex: isPreparation ? 0 : currentSegmentIndex + 1,
    segmentCount: totalSegments,
    elapsed: formatTimeCompact(totalElapsed),
    sessionXP: Math.round(currentXP),
    streak: profile?.current_streak || 0,
    multiplier: streakMultiplier,
    level: liveLevel,
    levelPercent: getLevelProgress(prestige, liveLevel, totalXP),
    xpToNext: liveLevel >= 100 ? null : Math.max(0, Math.ceil(within.required - within.current)),
  };

  const counting = isRunning && !isPaused && !isPreparation && !!currentSegment &&
    currentSegment.type !== 'rest' && (isBoxingSegment(currentSegment) || isShadowboxing);

  // Active workout screen
  return (
    <AppLayout hideNav>
      {/* Level Up Overlay */}
      {levelUpLevel !== null && (
        <LevelUpOverlay
          level={levelUpLevel}
          variant={isChampionship ? 'championship' : isCooldown ? 'cooldown' : 'volt'}
          onComplete={() => setLevelUpLevel(null)}
        />
      )}
      <RunStage
        view={runView}
        actions={{
          onPlay: handleStart,
          onPause: handlePauseResume,
          onBack: handleBack,
          onSkip: handleSkip,
          onFinish: handleCompleteEarly,
          onLeave: () => setShowExitConfirm(true),
          onRestart: () => setShowRestartConfirm(true),
          onAdjust: adjustTime,
          onToggleCamera: () => {
            setFeed(null);
            setFeedProblemDismissed(false);
            setCameraOn(!cameraOn);
          },
        }}
        flash={{
          xp: xpBubble,
          comboXP: comboXPPop,
          badge: latestBadgePop && {
            id: latestBadgePop.id,
            name: latestBadgePop.badge.name,
            xp: latestBadgePop.badge.xpReward,
            artId: latestBadgePop.badge.id,
          },
          badgeTally: liveBadgesEarned.length > 0
            ? { count: liveBadgesEarned.length, xp: liveBadgesEarned.reduce((sum, earned) => sum + earned.badge.xpReward, 0) }
            : null,
        }}
        cameraOn={cameraOn && !cameraFailed}
        camera={
          // Asks for the camera once the session has started. Only boxing segments are counted.
          cameraOn && !cameraFailed ? (
            <CameraBoundary onFailed={onCameraFailed}>
              <PunchCameraPanel
                key={cameraSession}
                counting={counting}
                preview={!hasStartedOnce || isPreparation}
                onSummary={setPunchSummary}
                onEvent={punchLog.onEvent}
                onTracking={punchLog.onTracking}
                displayCount={punchLog.log.totals.punches}
                onCountingChange={(on) => (on ? punchLog.startRound() : punchLog.endRound())}
                onFeed={setFeed}
              />
            </CameraBoundary>
          ) : undefined
        }
        feed={cameraOn ? feed : null}
        counting={counting}
        problemDismissed={feedProblemDismissed}
        onDismissProblem={() => setFeedProblemDismissed(true)}
      >
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
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Leave Workout?</AlertDialogTitle>
              <AlertDialogDescription>
                {accumulatedXP > 0 
                  ? `You have +${Math.round(accumulatedXP)} XP so far. End & Save keeps your XP, history and punch log.`
                  : "Are you sure you want to leave this workout?"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmExit} className={buttonVariants({ variant: 'destructive' })}>
                Leave Without Saving
              </AlertDialogAction>
              {/* Nothing trained, nothing to save */}
              {totalElapsed > 0 && <AlertDialogAction onClick={handleEndAndSave}>End & Save</AlertDialogAction>}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Restart Confirmation Dialog */}
        <AlertDialog open={showRestartConfirm} onOpenChange={setShowRestartConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restart Workout?</AlertDialogTitle>
              <AlertDialogDescription>
                {accumulatedXP > 0 
                  ? `This starts over from the beginning and drops the +${Math.round(accumulatedXP)} XP from this run.`
                  : "This will reset the workout to the beginning."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmRestart}>
                Restart
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </RunStage>
    </AppLayout>
  );
};

export default WorkoutSession;
