import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, Play, Pause, RotateCcw, SkipForward, SkipBack, ChevronRight, MoreVertical } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { VerticalXPBar } from '@/components/ui/VerticalXPBar';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useUserStore } from '@/stores/userStore';
import { useHistoryStore } from '@/stores/historyStore';
import { cn } from '@/lib/utils';

interface FlatSegment {
  id: string;
  name: string;
  type: 'active' | 'rest';
  segmentType?: 'work' | 'rest' | 'shadowboxing' | 'combo';
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

const WorkoutSession = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { workouts, markWorkoutUsed } = useWorkoutStore();
  const user = useUserStore((state) => state.user);
  const addXP = useUserStore((state) => state.addXP);
  const addCompletedWorkout = useHistoryStore((state) => state.addCompletedWorkout);

  const workout = workouts.find((w) => w.id === id);

  // Flatten workout into segments
  const flatSegments = useMemo(() => {
    if (!workout) return [];
    
    const segments: FlatSegment[] = [];
    const sections = ['warmup', 'grind', 'cooldown'] as const;
    let comboIndex = 0;
    
    sections.forEach((sectionName) => {
      const phases = workout.sections[sectionName];
      phases.forEach((phase) => {
        for (let r = 0; r < phase.repeats; r++) {
          phase.segments.forEach((segment, segIdx) => {
            let combo: string[] | undefined;
            let nextCombo: string[] | undefined;
            
            const isShadowboxing = segment.segmentType === 'shadowboxing' || 
                                   segment.name.toLowerCase().includes('shadow') || 
                                   segment.name.toLowerCase().includes('technique');
            const isComboSegment = segment.segmentType === 'combo' || segment.comboIndex === 'cycle';
            
            if (workout.combos && workout.combos.length > 0) {
              if (isShadowboxing && !isComboSegment) {
                // For shadowboxing: show the NEXT combo that's coming (don't increment)
                nextCombo = workout.combos[comboIndex % workout.combos.length];
              } else if (isComboSegment) {
                // For combo segments: show current combo and increment
                combo = workout.combos[comboIndex % workout.combos.length];
                nextCombo = workout.combos[(comboIndex + 1) % workout.combos.length];
                comboIndex++;
              }
            }
            
            segments.push({
              id: `${segment.id}-${r}-${segIdx}`,
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
              repeatIndex: phase.repeats > 1 ? r + 1 : undefined,
            });
          });
        }
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

  const currentSegment = flatSegments[currentSegmentIndex];
  const nextSegment = flatSegments[currentSegmentIndex + 1];
  const totalSegments = flatSegments.length;
  const progressPercent = totalSegments > 0 ? (currentSegmentIndex / totalSegments) * 100 : 0;
  
  // Calculate XP earned so far (10 XP per minute of active work)
  const currentXP = Math.floor((totalElapsed / 60) * 10);

  // Timer effect - always runs at normal speed
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning && !isPaused && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => prev - 1);
        if (!isPreparation) {
          setTotalElapsed((prev) => prev + 1);
        }
      }, 1000);
    } else if (timeRemaining === 0 && isRunning) {
      if (isPreparation) {
        setIsPreparation(false);
        setTimeRemaining(flatSegments[0]?.duration || 60);
      } else if (currentSegmentIndex < flatSegments.length - 1) {
        setCurrentSegmentIndex((prev) => prev + 1);
        setTimeRemaining(flatSegments[currentSegmentIndex + 1].duration);
      } else {
        setIsComplete(true);
        setIsRunning(false);
        if (workout) {
          markWorkoutUsed(workout.id);
          const xpEarned = Math.floor((totalElapsed / 60) * 10);
          addXP(xpEarned);
        }
      }
    }
    
    return () => clearInterval(interval);
  }, [isRunning, isPaused, timeRemaining, currentSegmentIndex, flatSegments, isPreparation, workout, markWorkoutUsed, addXP, totalElapsed]);

  const handleStart = () => {
    setIsRunning(true);
    setIsPaused(false);
  };

  const handlePauseResume = () => {
    setIsPaused((prev) => !prev);
  };

  const handleReset = () => {
    setCurrentSegmentIndex(0);
    setTimeRemaining(10);
    setTotalElapsed(0);
    setIsRunning(false);
    setIsPaused(true);
    setIsPreparation(true);
    setIsComplete(false);
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
    const xpEarned = Math.floor((totalElapsed / 60) * 10);
    addCompletedWorkout({
      id: crypto.randomUUID(),
      workoutId: workout?.id,
      workoutName: workout?.name || 'Workout',
      completedAt: new Date(),
      duration: totalElapsed,
      xpEarned,
      difficulty: difficultyRating || undefined,
      notes: notes || undefined,
      isManualEntry: false,
    });
    setLogged(true);
  };

  // Workout complete screen
  if (isComplete) {
    const xpEarned = Math.floor((totalElapsed / 60) * 10);
    
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
  // For shadowboxing, show the nextCombo (the upcoming combo to practice)
  // For combo segments, show the current combo
  const displayCombo = isShadowboxing ? currentSegment?.nextCombo : currentSegment?.combo;

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
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-3 py-2 rounded-full bg-surface-1 border border-surface-3"
            >
              <ArrowLeft className="w-4 h-4" />
              <Home className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-2 rounded-full bg-surface-1 border border-surface-3 text-muted-foreground hover:text-foreground transition-colors"
              title="Restart from beginning"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
          
          {/* Elapsed time in center-ish area - desaturated volt */}
          <span className="timer-display text-2xl font-black text-volt/60">
            {formatTimeCompact(totalElapsed)}
          </span>
          
          {/* Right side - XP bar */}
          <div className="flex flex-col items-end">
            <VerticalXPBar currentXP={(user?.totalXP || 0) + currentXP} />
          </div>
        </header>

        {/* Main Timer */}
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          {/* Phase Title */}
          <h2 className="text-2xl font-black text-foreground mb-2 uppercase tracking-wider text-center">
            {isPreparation ? 'GET READY' : currentSegment?.name || 'WORK'}
          </h2>

          {/* Shadowboxing hint - show INCOMING combo */}
          {isShadowboxing && !isPreparation && displayCombo && (
            <p className="text-xs text-volt font-bold mb-2 animate-pulse">INCOMING COMBO:</p>
          )}

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

          {/* Combo Display - Convert words to numbers/short codes */}
          {displayCombo && displayCombo.length > 0 && !isPreparation && (
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
                  const isPunch = !isDefense && !isMovement;
                  
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
      </div>
    </AppLayout>
  );
};

export default WorkoutSession;
