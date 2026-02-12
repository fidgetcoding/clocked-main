import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, Play, Pause, RotateCcw, SkipForward, SkipBack, ChevronRight, MoreVertical, CheckCircle, Zap } from 'lucide-react';
import { RoundFeedbackPanel } from '@/components/workout/RoundFeedbackPanel';
import { RoundFeedback } from '@/types';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { VerticalXPBar } from '@/components/ui/VerticalXPBar';
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
import { cn } from '@/lib/utils';
import { ACTIVITY_XP_RATES, ActivityType, getStreakMultiplier, getActivityTypeFromName, calculateComboXP, getSparringXPRate, getLevelFromXP } from '@/lib/xpSystem';
import { computePostLogStats } from '@/lib/workoutTracking';
import { LevelUpOverlay } from '@/components/ui/LevelUpOverlay';

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
  const phases = dbWorkout.phases as any[];
  const sections = {
    warmup: phases?.filter((p: any) => p.section === 'warmup').map(({ section, ...rest }) => rest) || [],
    grind: phases?.filter((p: any) => p.section === 'grind').map(({ section, ...rest }) => rest) || [],
    cooldown: phases?.filter((p: any) => p.section === 'cooldown').map(({ section, ...rest }) => rest) || [],
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
  };
}

const WorkoutSession = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { workouts, updateWorkout } = useWorkouts();
  const { addHistoryEntry } = useWorkoutHistory();
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

  const dbWorkout = workouts.find((w) => w.id === id);
  const workout = useMemo(() => dbWorkout ? dbWorkoutToLocal(dbWorkout) : null, [dbWorkout]);

  // Flatten workout into segments
  const flatSegments = useMemo(() => {
    if (!workout) return [];
    
    const segments: FlatSegment[] = [];
    const sections = ['warmup', 'grind', 'cooldown'] as const;
    
    // First pass: collect all segments to know what's next
    const tempSegments: { segment: any; sectionName: typeof sections[number]; phase: any; repeatIndex: number }[] = [];
    
    sections.forEach((sectionName) => {
      const phases = workout.sections[sectionName];
      phases.forEach((phase) => {
        for (let r = 0; r < phase.repeats; r++) {
          phase.segments.forEach((segment) => {
            tempSegments.push({ segment, sectionName, phase, repeatIndex: r });
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
      const { segment } = item;
      const isSpeedbag = segment.segmentType === 'speedbag';
      const isDoubleend = segment.segmentType === 'doubleend';
      // Speedbag and double end bag segments are always freestyle — skip combo assignment
      if (isSpeedbag || isDoubleend) return;
      const isComboSegment = segment.segmentType === 'combo' || segment.comboIndex === 'cycle';
      const isShadowboxing = segment.segmentType === 'shadowboxing' || 
                             segment.name.toLowerCase().includes('shadow') || 
                             segment.name.toLowerCase().includes('technique');
      if (isComboSegment) comboSegmentIndices.push(idx);
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
      if (totalCombos === 0) return undefined;
      if (!phaseComboLists.has(phaseKey)) {
        phaseComboLists.set(phaseKey, { list: getComboListForPhase(phase), cursor: 0 });
      }
      const entry = phaseComboLists.get(phaseKey)!;
      if (entry.cursor >= entry.list.length) return undefined; // ran out
      return entry.list[entry.cursor++];
    };
    
    // Assign to combo segments first
    for (const idx of comboSegmentIndices) {
      const { phase, repeatIndex } = tempSegments[idx];
      const phaseKey = `${phase.id}`;
      const combo = getPhaseCombo(phase, phaseKey);
      if (combo) comboAssignments.set(idx, combo);
    }
    
    // Overflow to shadowboxing segments (these use sequential from remaining)
    for (const idx of shadowboxIndices) {
      const { phase } = tempSegments[idx];
      const phaseKey = `${phase.id}`;
      const combo = getPhaseCombo(phase, phaseKey);
      if (combo) comboAssignments.set(idx, combo);
    }
    
    // Second pass: build flat segments with proper next-segment awareness
    tempSegments.forEach((item, idx) => {
      const { segment, sectionName, phase, repeatIndex } = item;
      
      const combo = comboAssignments.get(idx);
      
      // For shadowboxing, check if the NEXT segment has a combo assigned (incoming combo preview)
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
  const [accumulatedXP, setAccumulatedXP] = useState(0); // Track XP earned during session
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [levelUpLevel, setLevelUpLevel] = useState<number | null>(null);
  
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
  const prevLevelRef = useRef<number>(profile?.current_level || 1);

  const { playLevelUpSound } = useSoundEffects();

  // Compute live level from accumulated XP - use profile (database) as source of truth
  const liveLevel = getLevelFromXP(
    (profile?.prestige || 'beginner') as any,
    (profile?.total_xp || 0) + accumulatedXP
  );

  // Detect level-up during session
  useEffect(() => {
    if (liveLevel > prevLevelRef.current) {
      setLevelUpLevel(liveLevel);
      playLevelUpSound();
      prevLevelRef.current = liveLevel;
    }
  }, [liveLevel, playLevelUpSound]);

  // Helper: compute XP per second for a given segment
  const getXPPerSecond = useCallback((segment: FlatSegment) => {
    const activityType = getActivityTypeFromSegment(segment);
    let xpPerSecond = ACTIVITY_XP_RATES[activityType];
    
    if (activityType === 'sparring' && profile?.prestige) {
      xpPerSecond = getSparringXPRate(profile.prestige as any);
    }
    
    if (activityType === 'combo' && segment.combo && segment.combo.length > 0) {
      const totalComboXP = calculateComboXP(segment.combo, segment.duration);
      xpPerSecond = totalComboXP / segment.duration;
    }
    
    return xpPerSecond;
  }, [profile?.prestige]);


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
        // If we overshot (e.g. backgrounded past prep), account for overflow
        setTimeRemaining(firstDuration + timeRemaining); // timeRemaining is negative, so this subtracts overshoot
      } else if (currentSegmentIndex < flatSegments.length - 1) {
        const nextIdx = currentSegmentIndex + 1;
        const nextDuration = flatSegments[nextIdx]?.duration || 60;
        setCurrentSegmentIndex(nextIdx);
        // Carry over any overshoot into the next segment
        setTimeRemaining(nextDuration + timeRemaining);
      } else if (!isComplete && !xpAwardedRef.current) {
        // Mark as complete FIRST to prevent re-entry
        xpAwardedRef.current = true;
        
        // Workout complete - stop timer, show journal
        // XP is NOT persisted here — only when user logs the workout
        cancelSpeech();
        setIsComplete(true);
        setIsRunning(false);
        
        // Mark workout as used
        if (dbWorkout) {
          updateWorkout.mutate({
            id: dbWorkout.id,
            times_completed: (dbWorkout.times_completed || 0) + 1,
            last_used_at: new Date().toISOString(),
          });
        }
      }
    }
  }, [timeRemaining, isRunning, isPreparation, currentSegmentIndex, flatSegments, dbWorkout, updateWorkout, cancelSpeech, isComplete, accumulatedXP]);


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

  const handleLog = () => {
    const xpEarned = Math.round(accumulatedXP);
    
    // Persist XP to database ONLY when user logs the workout
    if (xpEarned > 0) {
      try {
        addLocalXP(xpEarned, true);
        addProfileXP.mutate(xpEarned);
      } catch (error) {
        console.error('Failed to award XP:', error);
      }
    }
    
    addHistoryEntry.mutate({
      workout_id: workout?.id || null,
      workout_name: workout?.name || 'Workout',
      completed_at: new Date().toISOString(),
      duration: totalElapsed,
      xp_earned: xpEarned,
      difficulty: difficultyRating || null,
      notes: notes || null,
      is_manual_entry: false,
      round_feedback: feedbackMode === 'advanced' ? roundFeedback : [],
    }, {
      onSuccess: async () => {
        setLogged(true);
        if (user?.id && profile) {
          const stats = await computePostLogStats(user.id, profile);
          if (stats) {
            updateProfile.mutate(stats);
          }
        }
      },
      onError: (error) => console.error('Failed to log workout:', error),
    });
  };

  // Workout complete screen
  if (isComplete) {
    const xpEarned = Math.round(accumulatedXP);
    
    return (
      <AppLayout hideNav>
        <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
          <div className="text-6xl mb-6">🏆</div>
          <h1 className="text-3xl font-black text-foreground mb-2">WORKOUT COMPLETE!</h1>
          <p className="text-muted-foreground mb-6">{workout.name}</p>
          
          <div className="grid grid-cols-2 gap-4 mb-6 w-full max-w-xs">
            <div className="card-workout text-center">
              <p className="text-2xl font-bold text-volt">{formatTimeCompact(totalElapsed)}</p>
              <p className="text-sm text-muted-foreground">Duration</p>
            </div>
            <div className="card-workout text-center">
              <p className="text-2xl font-bold text-volt">+{xpEarned}</p>
              <p className="text-sm text-muted-foreground">XP Earned</p>
            </div>
          </div>

          {/* Workout Log */}
          {!logged ? (
            <div className="w-full max-w-xs space-y-4 mb-6">
              {/* Basic/Advanced Toggle */}
              {roundCount > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setFeedbackMode('basic')}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                      feedbackMode === 'basic'
                        ? 'bg-volt text-primary-foreground'
                        : 'bg-surface-1 text-muted-foreground'
                    )}
                  >
                    Basic
                  </button>
                  <button
                    onClick={() => setFeedbackMode('advanced')}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                      feedbackMode === 'advanced'
                        ? 'bg-volt text-primary-foreground'
                        : 'bg-surface-1 text-muted-foreground'
                    )}
                  >
                    Advanced
                  </button>
                </div>
              )}
              
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">How did it go?</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about your workout..."
                  className="w-full h-24 p-3 rounded-xl bg-surface-1 border border-surface-3 text-foreground placeholder:text-muted-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-volt"
                />
              </div>
              
              {/* Rating */}
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Difficulty</label>
                <div className="flex gap-2">
                  {[
                    { value: 'too_easy', label: 'Too Easy' },
                    { value: 'just_right', label: 'Just Right' },
                    { value: 'too_hard', label: 'Too Hard' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setDifficultyRating(opt.value as typeof difficultyRating)}
                      className={cn(
                        'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors',
                        difficultyRating === opt.value
                          ? 'bg-volt text-primary-foreground'
                          : 'bg-surface-1 border border-surface-3 text-muted-foreground hover:bg-surface-2'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Round-by-Round Feedback (Advanced Mode Only) */}
              {feedbackMode === 'advanced' && roundCount > 0 && (
                <RoundFeedbackPanel
                  roundCount={roundCount}
                  roundFeedback={roundFeedback}
                  onRoundRating={handleRoundRating}
                />
              )}
              
              <Button onClick={handleLog} className="btn-primary-glow w-full">
                Log Workout
              </Button>
            </div>
          ) : (
            <div className="w-full max-w-xs mb-6">
              <div className="card-workout text-center">
                <p className="text-volt font-semibold">Workout Logged!</p>
              </div>
            </div>
          )}

          <Button onClick={() => navigate('/')} variant="outline" className="w-full max-w-xs bg-surface-1 border-surface-3">
            Back to Home
          </Button>
        </div>
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
  const rawCombo = (isSpeedbag || isDoubleend) ? undefined : (isShadowboxing ? currentSegment?.nextCombo : currentSegment?.combo);
  const isFreestyleCombo = rawCombo?.length === 1 && rawCombo[0] === 'FREESTYLE';
  const displayCombo = isFreestyleCombo ? undefined : rawCombo;

  // Check if current segment is rest (for rest screen preview)
  const isRestSegment = currentSegment?.type === 'rest' && !isPreparation;
  // Get the combo from the next segment to preview during rest
  const restComboPreview = nextSegment?.combo;

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
    if (['1', '2', '3', '4', '5', '6', '7', '8'].includes(m)) return { display: m, type: 'punch' };
    if (['SL', 'SR', 'RL', 'RR', 'PL', 'BK'].includes(m)) return { display: m, type: 'defense' };
    if (['↺', '↻', '→', '←'].includes(m)) return { display: m, type: 'movement' };
    return { display: move, type: 'punch' };
  };

  // Active workout screen
  return (
    <AppLayout hideNav>
      <div className={cn(
        'min-h-screen flex flex-col',
        currentSegment?.type === 'rest' && !isPreparation ? 'bg-surface-1' : 'bg-background'
      )}>
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
              className="px-3 py-2 rounded-full bg-surface-1 border border-surface-3 text-volt hover:text-volt/80 transition-colors"
              title="Complete workout early"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          </div>
          
          {/* Elapsed time + dev button */}
          <div className="flex items-center gap-2">
            <span className="timer-display text-2xl font-black text-volt/60">
              {formatTimeCompact(totalElapsed)}
            </span>
            {isAdmin && (
              <button
                onClick={() => {
                  playLevelUpSound();
                  setLevelUpLevel(2);
                }}
                className="p-1.5 rounded-full border border-dashed border-volt/30 text-volt/40 hover:text-volt hover:border-volt transition-colors"
                title="DEV: Test Level Up"
              >
                <Zap className="w-3 h-3" />
              </button>
            )}
          </div>
          
          {/* Right side - XP bar with bubble */}
          <div className="flex items-center relative">
            {/* XP Bubble - positioned to left of bar, vertically centered */}
            {xpBubble && (
              <div 
                key={xpBubble.id}
                className="absolute right-full mr-2 top-1/2 -translate-y-1/2 text-volt font-bold text-sm whitespace-nowrap animate-xp-bubble"
              >
                +{xpBubble.amount} XP
              </div>
            )}
            <VerticalXPBar prestige={profile?.prestige || 'beginner'} level={liveLevel} totalXP={(profile?.total_xp || 0) + currentXP} />
          </div>
        </header>

        {/* Level Up Overlay */}
        {levelUpLevel !== null && (
          <LevelUpOverlay level={levelUpLevel} onComplete={() => setLevelUpLevel(null)} />
        )}

        {/* Main Timer */}
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          {/* Section Indicator */}
          {!isPreparation && currentSegment?.section && (
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
              {currentSegment.section === 'warmup' ? 'WARM-UP' : 
               currentSegment.section === 'grind' ? 'ROUNDS' : 
               'COOL DOWN'}
            </p>
          )}
          
          {/* Phase Title */}
          <h2 className="text-2xl font-black text-foreground mb-2 uppercase tracking-wider text-center">
            {isPreparation ? 'GET READY' : currentSegment?.name || 'WORK'}
          </h2>


          {/* Timer */}
          <span className="timer-display text-8xl font-black text-volt text-glow-volt mb-2">
            {formatTime(timeRemaining)}
          </span>

          {/* Segment Type */}
          <div className="flex items-center gap-2 mb-6">
            <div className="h-px w-12 bg-surface-3" />
            <span className="text-xs text-muted-foreground uppercase tracking-widest">
              {isPreparation ? 'PREPARATION' : currentSegment?.type === 'rest' ? 'REST' : 
               currentSegment?.segmentType?.toUpperCase() || 'WORK'}
            </span>
            <div className="h-px w-12 bg-surface-3" />
          </div>

          {/* Time Modification Buttons */}
          <div className="flex gap-3 mb-4">
            <button 
              onClick={halveTime}
              className="px-5 py-2 rounded-full bg-surface-1 border border-surface-3 text-foreground text-sm font-bold hover:bg-surface-2 transition-colors"
            >
              50%
            </button>
            <button 
              onClick={doubleTime}
              className="px-5 py-2 rounded-full bg-surface-1 border border-surface-3 text-foreground text-sm font-bold hover:bg-surface-2 transition-colors"
            >
              2X
            </button>
          </div>

          {/* Fine-tune buttons */}
          <div className="flex gap-2 mb-6">
            {['-30', '-15', '+15', '+30'].map((val) => (
              <button
                key={val}
                onClick={() => adjustTime(parseInt(val))}
                className="px-3 py-1.5 rounded-full border border-surface-3 text-muted-foreground text-xs font-medium hover:bg-surface-1 transition-colors"
              >
                {val}
              </button>
            ))}
          </div>

          {/* Rest Screen - Next Segment Preview */}
          {isRestSegment && (
            <div className="w-full max-w-sm space-y-4">
              {/* Next Segment Card */}
              <div className="bg-surface-2 rounded-xl p-4 border border-surface-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 text-center">
                  UP NEXT
                </p>
                <p className="text-xl font-black text-foreground text-center uppercase">
                  {nextSegment?.name || 'FINISH'}
                </p>
                {nextSegment?.duration && (
                  <p className="text-sm text-muted-foreground text-center mt-1">
                    {formatTime(nextSegment.duration)}
                  </p>
                )}
              </div>
              
              {/* Incoming Combo Preview (if next segment has a combo) */}
              {restComboPreview && restComboPreview.length > 0 && (
                <div className="bg-surface-1 rounded-xl p-4 border border-surface-3">
                  <p className="text-xs text-alert-red font-bold mb-3 text-center animate-pulse">
                    INCOMING COMBO
                  </p>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {restComboPreview.map((move, idx) => {
                      const { display, type } = getDisplayMove(move);
                      return (
                        <div key={idx} className="flex items-center gap-1">
                          <span className={cn(
                            'text-2xl font-black',
                            type === 'defense' ? 'text-yellow-500' : 
                            type === 'movement' ? 'text-blue-400' : 'text-volt'
                          )}>
                            {display}
                          </span>
                          {idx < restComboPreview.length - 1 && (
                            <ChevronRight className="w-3 h-3 text-muted-foreground" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Combo Display - for shadowboxing: show incoming combo OR freestyle */}
          {isShadowboxing && !isPreparation && (
            <div className="w-full max-w-sm bg-surface-1 rounded-xl p-4 border border-surface-3">
              {displayCombo && displayCombo.length > 0 ? (
                <>
                  {/* Incoming combo label for shadowboxing */}
                  <p className="text-xs text-alert-red font-bold mb-3 text-center animate-pulse">INCOMING COMBO</p>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {displayCombo.map((move, idx) => {
                      // Convert punch names to numbers if they're stored as words
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
                        // Keep defense/movement as short codes
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
                        return move; // Return original if already a number
                      })();
                      
                      const isDefense = ['SL', 'SR', 'RL', 'RR', 'PL', 'BK'].includes(displayMove);
                      const isMovement = ['↺', '↻', '→', '←'].includes(displayMove);
                      
                      return (
                        <div key={idx} className="flex items-center gap-1">
                          <span className={cn(
                            'text-2xl font-black',
                            isDefense ? 'text-yellow-500' : 
                            isMovement ? 'text-blue-400' : 'text-volt'
                          )}>
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
                <p className="text-2xl font-black text-volt text-center">FREESTYLE</p>
              )}
            </div>
          )}
          
          {/* Combo Display for combo segments - always show the current combo */}
          {!isShadowboxing && displayCombo && displayCombo.length > 0 && !isPreparation && (
            <div className="w-full max-w-sm bg-surface-1 rounded-xl p-4 border border-surface-3">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {displayCombo.map((move, idx) => {
                  // Convert punch names to numbers if they're stored as words
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
                    // Keep defense/movement as short codes
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
                    return move; // Return original if already a number
                  })();
                  
                  const isDefense = ['SL', 'SR', 'RL', 'RR', 'PL', 'BK'].includes(displayMove);
                  const isMovement = ['↺', '↻', '→', '←'].includes(displayMove);
                  
                  return (
                    <div key={idx} className="flex items-center gap-1">
                      <span className={cn(
                        'text-2xl font-black',
                        isDefense ? 'text-yellow-500' : 
                        isMovement ? 'text-blue-400' : 'text-volt'
                      )}>
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

          {/* Freestyle Display - for combo-type or speedbag segments with no combos assigned */}
          {!isShadowboxing && !isPreparation && currentSegment?.type === 'active' && 
           (currentSegment?.segmentType === 'combo' || currentSegment?.segmentType === 'speedbag' || currentSegment?.segmentType === 'doubleend') &&
           (!displayCombo || displayCombo.length === 0) && (
            <div className="w-full max-w-sm bg-surface-1 rounded-xl p-4 border border-surface-3">
              <p className="text-2xl font-black text-volt text-center">FREESTYLE</p>
            </div>
          )}
        </div>

        {/* Bottom Section */}
        <div className="px-4 pb-8 safe-bottom">
          {/* Phase Info */}
          <div className="flex items-center justify-between mb-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Current</p>
              <p className="font-bold text-foreground uppercase text-sm">
                {isPreparation ? 'PREP' : currentSegment?.phaseName || 'WARMUP'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Next</p>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-volt" />
                <p className="font-bold text-foreground uppercase text-sm">
                  {isPreparation ? flatSegments[0]?.name : nextSegment?.name || 'FINISH'}
                </p>
              </div>
            </div>
          </div>

          {/* Progress Bar with Phase Indicator */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>{isPreparation ? 'PREP' : currentSegment?.section?.toUpperCase() || 'WARMUP'}</span>
              <span className="text-volt font-bold">
                {isPreparation ? '0' : currentSegmentIndex + 1} / {totalSegments}
              </span>
            </div>
            <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div 
                className="h-full bg-volt transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-center text-muted-foreground mt-1">
              {Math.round(progressPercent)}% COMPLETE
            </p>
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
              className="w-20 h-20 rounded-full bg-volt flex items-center justify-center glow-volt"
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
