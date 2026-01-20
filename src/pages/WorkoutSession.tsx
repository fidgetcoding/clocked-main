import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, Play, Pause, RotateCcw, SkipForward, ChevronRight } from 'lucide-react';
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
  duration: number;
  phaseName: string;
  section: 'warmup' | 'grind' | 'cooldown';
  combo?: string[];
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
    
    sections.forEach((sectionName) => {
      const phases = workout.sections[sectionName];
      phases.forEach((phase) => {
        for (let r = 0; r < phase.repeats; r++) {
          phase.segments.forEach((segment, segIdx) => {
            let combo: string[] | undefined;
            
            // Show combo for segments with comboIndex='cycle' OR shadowboxing/technique segments
            const isShadowboxing = segment.name.toLowerCase().includes('shadow') || 
                                   segment.name.toLowerCase().includes('technique');
            
            if ((segment.comboIndex === 'cycle' || isShadowboxing) && workout.combos && workout.combos.length > 0) {
              const comboIdx = r % workout.combos.length;
              combo = workout.combos[comboIdx];
            }
            
            segments.push({
              id: `${segment.id}-${r}-${segIdx}`,
              name: segment.name,
              type: segment.type,
              duration: segment.duration,
              phaseName: phase.name,
              section: sectionName,
              combo,
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
  const [speed, setSpeed] = useState<0.5 | 1 | 2>(1);
  const [notes, setNotes] = useState('');
  const [logged, setLogged] = useState(false);

  const currentSegment = flatSegments[currentSegmentIndex];
  const nextSegment = flatSegments[currentSegmentIndex + 1];
  const totalSegments = flatSegments.length;
  const progressPercent = totalSegments > 0 ? (currentSegmentIndex / totalSegments) * 100 : 0;
  
  // Calculate XP earned so far (10 XP per minute of active work)
  const currentXP = Math.floor((totalElapsed / 60) * 10);

  // Timer effect with speed control
  useEffect(() => {
    let interval: NodeJS.Timeout;
    const intervalMs = 1000 / speed; // Adjust interval based on speed
    
    if (isRunning && !isPaused && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => prev - 1);
        if (!isPreparation) {
          setTotalElapsed((prev) => prev + 1);
        }
      }, intervalMs);
    } else if (timeRemaining === 0 && isRunning) {
      if (isPreparation) {
        // End preparation, start first segment
        setIsPreparation(false);
        setTimeRemaining(flatSegments[0]?.duration || 60);
      } else if (currentSegmentIndex < flatSegments.length - 1) {
        // Move to next segment
        setCurrentSegmentIndex((prev) => prev + 1);
        setTimeRemaining(flatSegments[currentSegmentIndex + 1].duration);
      } else {
        // Workout complete
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
  }, [isRunning, isPaused, timeRemaining, currentSegmentIndex, flatSegments, isPreparation, workout, markWorkoutUsed, addXP, totalElapsed, speed]);

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

  const [difficultyRating, setDifficultyRating] = useState<'too_easy' | 'just_right' | 'too_hard' | null>(null);

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
                  {['Too Easy', 'Just Right', 'Too Hard'].map((label, idx) => (
                    <button
                      key={label}
                      className="flex-1 py-2 px-3 rounded-lg bg-surface-1 border border-surface-3 text-sm text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors"
                    >
                      {['😴', '💪', '🔥'][idx]} {label}
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
                <p className="text-volt font-semibold">✓ Workout Logged!</p>
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

  // Active workout screen
  return (
    <AppLayout hideNav>
      <div className={cn(
        'min-h-screen flex flex-col',
        currentSegment?.type === 'rest' && !isPreparation ? 'bg-surface-1' : 'bg-background'
      )}>
        {/* Top Bar */}
        <header className="flex items-center justify-between px-4 py-4 safe-top">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-3 py-2 rounded-full bg-surface-1 border border-surface-3"
          >
            <ArrowLeft className="w-4 h-4" />
            <Home className="w-4 h-4" />
            <span className="text-sm font-medium">HOME</span>
          </button>
          
          <div className="flex items-center gap-3">
            {/* XP Display */}
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-volt/20 border border-volt/30">
              <span className="text-volt text-sm font-bold">+{currentXP} XP</span>
            </div>
            <span className="timer-display text-lg text-foreground font-bold">
              {formatTimeCompact(totalElapsed)}
            </span>
          </div>
        </header>

        {/* Main Timer with Vertical XP Bar */}
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="flex items-center gap-6">
            {/* Timer Column */}
            <div className="flex flex-col items-center">
              {/* Phase Title */}
              <h2 className="text-2xl font-black text-foreground mb-4 uppercase tracking-wider">
                {isPreparation ? 'GET READY' : currentSegment?.name || 'WORK'}
              </h2>

              {/* Timer */}
              <span className="timer-display text-timer-lg font-black text-volt text-glow-volt mb-4">
                {formatTime(timeRemaining)}
              </span>

              {/* Segment Type */}
              <div className="flex items-center gap-2 mb-6">
                <div className="h-px w-16 bg-surface-3" />
                <span className="text-sm text-muted-foreground uppercase tracking-widest">
                  {isPreparation ? 'PREPARATION' : currentSegment?.type === 'rest' ? 'REST' : 'WORK'}
                </span>
                <div className="h-px w-16 bg-surface-3" />
              </div>
            </div>

            {/* Vertical XP Bar */}
            <VerticalXPBar currentXP={(user?.totalXP || 0) + currentXP} className="ml-4" />
          </div>
        </div>
        {/* Controls Section */}
        <div className="px-4 mb-4">
          {/* Time Adjustment Buttons */}
          <div className="flex justify-center gap-3 mb-4">
            {['-30', '-15', '+15', '+30'].map((val) => (
              <button
                key={val}
                onClick={() => adjustTime(parseInt(val))}
                className="px-4 py-2 rounded-full border border-surface-3 text-foreground text-sm font-medium hover:bg-surface-1 transition-colors"
              >
                {val}
              </button>
            ))}
          </div>

          {/* Speed Buttons */}
          <div className="flex justify-center gap-3 mb-4">
            <button 
              onClick={() => setSpeed(0.5)}
              className={cn(
                'px-6 py-2 rounded-full text-sm font-medium transition-colors',
                speed === 0.5 
                  ? 'bg-volt text-primary-foreground' 
                  : 'bg-surface-1 border border-surface-3 text-muted-foreground hover:bg-surface-2'
              )}
            >
              50%
            </button>
            <button 
              onClick={() => setSpeed(1)}
              className={cn(
                'px-6 py-2 rounded-full text-sm font-medium transition-colors',
                speed === 1 
                  ? 'bg-volt text-primary-foreground' 
                  : 'bg-surface-1 border border-surface-3 text-muted-foreground hover:bg-surface-2'
              )}
            >
              1X
            </button>
            <button 
              onClick={() => setSpeed(2)}
              className={cn(
                'px-6 py-2 rounded-full text-sm font-medium transition-colors',
                speed === 2 
                  ? 'bg-volt text-primary-foreground' 
                  : 'bg-surface-1 border border-surface-3 text-muted-foreground hover:bg-surface-2'
              )}
            >
              2X
            </button>
          </div>

          {currentSegment?.combo && currentSegment.combo.length > 0 && !isPreparation && (
            <div className="w-full max-w-sm bg-surface-1 rounded-xl p-4 border border-surface-3 mb-4">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {currentSegment.combo.map((move, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className={cn(
                      'text-xl font-black',
                      move.includes('SLIP') || move.includes('ROLL') ? 'text-yellow-500' : 'text-volt'
                    )}>
                      {move}
                    </span>
                    {idx < currentSegment.combo!.length - 1 && (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Section */}
        <div className="px-4 pb-8 safe-bottom">
          {/* Phase Info */}
          <div className="flex items-center justify-between mb-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Current Phase</p>
              <p className="font-bold text-foreground uppercase">
                {isPreparation ? 'PREPARATION' : currentSegment?.phaseName || 'WARMUP'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Up Next</p>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-volt" />
                <p className="font-bold text-foreground uppercase">
                  {isPreparation ? flatSegments[0]?.name : nextSegment?.name || 'FINISH'}
                </p>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>START</span>
              <span>{Math.round(progressPercent)}% COMPLETE</span>
              <span>FINISH</span>
            </div>
            <div className="h-1 bg-surface-2 rounded-full overflow-hidden">
              <div 
                className="h-full bg-volt transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={handleReset}
              className="w-14 h-14 rounded-full bg-surface-1 border border-surface-3 flex items-center justify-center"
            >
              <RotateCcw className="w-6 h-6 text-foreground" />
            </button>

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

            <button
              onClick={handleSkip}
              className="w-14 h-14 rounded-full bg-surface-1 border border-surface-3 flex items-center justify-center"
            >
              <SkipForward className="w-6 h-6 text-foreground" />
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default WorkoutSession;
