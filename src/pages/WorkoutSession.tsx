import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, RotateCcw, SkipForward, ChevronRight } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { XPBar } from '@/components/ui/XPBar';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useUserStore } from '@/stores/userStore';
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
            // Get combo for this segment if applicable
            let combo: string[] | undefined;
            if (segment.comboIndex === 'cycle' && workout.combos) {
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
  const [timeRemaining, setTimeRemaining] = useState(flatSegments[0]?.duration || 0);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const currentSegment = flatSegments[currentSegmentIndex];
  const progress = flatSegments.length > 0 
    ? ((currentSegmentIndex + 1) / flatSegments.length) * 100 
    : 0;

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning && !isPaused && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => prev - 1);
        setTotalElapsed((prev) => prev + 1);
      }, 1000);
    } else if (timeRemaining === 0 && isRunning) {
      // Move to next segment
      if (currentSegmentIndex < flatSegments.length - 1) {
        setCurrentSegmentIndex((prev) => prev + 1);
        setTimeRemaining(flatSegments[currentSegmentIndex + 1].duration);
      } else {
        // Workout complete
        setIsComplete(true);
        setIsRunning(false);
        if (workout) {
          markWorkoutUsed(workout.id);
          // Calculate and add XP (10 XP per minute)
          const xpEarned = Math.floor((totalElapsed / 60) * 10);
          addXP(xpEarned);
        }
      }
    }
    
    return () => clearInterval(interval);
  }, [isRunning, isPaused, timeRemaining, currentSegmentIndex, flatSegments, workout, markWorkoutUsed, addXP, totalElapsed]);

  const handleStart = () => {
    setIsRunning(true);
    setIsPaused(false);
  };

  const handlePauseResume = () => {
    setIsPaused((prev) => !prev);
  };

  const handleReset = () => {
    setCurrentSegmentIndex(0);
    setTimeRemaining(flatSegments[0]?.duration || 0);
    setTotalElapsed(0);
    setIsRunning(false);
    setIsPaused(false);
    setIsComplete(false);
  };

  const handleNextSegment = () => {
    if (currentSegmentIndex < flatSegments.length - 1) {
      setCurrentSegmentIndex((prev) => prev + 1);
      setTimeRemaining(flatSegments[currentSegmentIndex + 1].duration);
    }
  };

  const handleExit = () => {
    navigate('/');
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

  // Workout complete screen
  if (isComplete) {
    const xpEarned = Math.floor((totalElapsed / 60) * 10);
    return (
      <AppLayout hideNav>
        <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-volt/10 to-background">
          <div className="text-6xl mb-6">🏆</div>
          <h1 className="text-3xl font-black text-foreground mb-2">WORKOUT COMPLETE!</h1>
          <p className="text-muted-foreground mb-8">{workout.name}</p>
          
          <div className="grid grid-cols-2 gap-4 mb-8 w-full max-w-xs">
            <div className="card-workout text-center">
              <p className="text-2xl font-bold text-volt">{formatTimeCompact(totalElapsed)}</p>
              <p className="text-sm text-muted-foreground">Duration</p>
            </div>
            <div className="card-workout text-center">
              <p className="text-2xl font-bold text-volt">+{xpEarned}</p>
              <p className="text-sm text-muted-foreground">XP Earned</p>
            </div>
          </div>

          <Button onClick={handleExit} className="btn-primary-glow w-full max-w-xs">
            Done
          </Button>
        </div>
      </AppLayout>
    );
  }

  // Pre-start screen
  if (!isRunning && !isPaused) {
    return (
      <AppLayout hideNav>
        <div className="min-h-screen flex flex-col">
          <header className="flex items-center gap-4 px-4 py-4 safe-top border-b border-surface-3">
            <button onClick={() => navigate('/')} className="text-muted-foreground">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold text-foreground truncate">{workout.name}</h1>
          </header>

          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <div className="w-24 h-24 rounded-2xl bg-volt/20 flex items-center justify-center text-5xl mb-6">
              {workout.icon}
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">{workout.name}</h2>
            <p className="text-muted-foreground mb-2">
              {formatTime(workout.totalDuration)} • {flatSegments.length} segments
            </p>
            <p className="text-sm text-muted-foreground mb-8 capitalize">{workout.difficulty}</p>

            <Button onClick={handleStart} className="btn-primary-glow w-full max-w-xs h-14 text-lg">
              <Play className="w-6 h-6 mr-2" />
              START WORKOUT
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Active workout screen
  return (
    <AppLayout hideNav>
      <div className={cn(
        'min-h-screen flex flex-col',
        currentSegment?.type === 'rest' ? 'bg-rest-green/10' : 'bg-background'
      )}>
        {/* XP Bar */}
        <div className="px-4 pt-2">
          <XPBar currentXP={user?.totalXP || 0} />
        </div>

        {/* Top Bar */}
        <header className="flex items-center justify-between px-4 py-3">
          <button onClick={handleExit} className="text-muted-foreground">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="text-center">
            <p className="text-sm text-muted-foreground uppercase tracking-wider">
              {currentSegment?.section}
            </p>
            <p className="text-lg font-bold text-foreground">
              {currentSegment?.phaseName}
              {currentSegment?.repeatIndex && ` (${currentSegment.repeatIndex})`}
            </p>
          </div>
          <div className="timer-display text-lg text-muted-foreground">
            {formatTimeCompact(totalElapsed)}
          </div>
        </header>

        {/* Progress bar */}
        <div className="px-4">
          <div className="h-1 bg-surface-2 rounded-full overflow-hidden">
            <div 
              className="h-full bg-volt transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center mt-1">
            {currentSegmentIndex + 1} / {flatSegments.length}
          </p>
        </div>

        {/* Main Timer */}
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          {/* Segment name */}
          <p className="text-lg font-semibold text-foreground mb-2">
            {currentSegment?.name}
          </p>
          
          {/* Intensity/Reps */}
          {(currentSegment?.intensity || currentSegment?.reps) && (
            <p className="text-sm text-muted-foreground mb-4">
              {currentSegment?.intensity}
              {currentSegment?.reps && ` • ${currentSegment.reps} reps`}
            </p>
          )}

          {/* Timer */}
          <span className={cn(
            'timer-display text-timer font-bold mb-4',
            currentSegment?.type === 'rest' ? 'text-rest-green' : 'text-volt text-glow-volt'
          )}>
            {formatTime(timeRemaining)}
          </span>

          {/* Combo Display */}
          {currentSegment?.combo && currentSegment.combo.length > 0 && (
            <div className="w-full max-w-sm bg-surface-1 rounded-xl p-4 border border-surface-3">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {currentSegment.combo.map((move, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className={cn(
                      'text-xl font-black',
                      move.includes('SLIP') ? 'text-yellow-500' : 'text-volt'
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

        {/* Controls */}
        <div className="px-4 pb-8 safe-bottom">
          <div className="flex items-center justify-center gap-6">
            <Button
              onClick={handleReset}
              variant="ghost"
              size="lg"
              className="w-14 h-14 rounded-full bg-surface-1 hover:bg-surface-2"
            >
              <RotateCcw className="w-6 h-6" />
            </Button>

            <Button
              onClick={handlePauseResume}
              className={cn(
                'w-20 h-20 rounded-full',
                isPaused 
                  ? 'bg-gradient-volt glow-volt text-primary-foreground' 
                  : 'bg-surface-2 hover:bg-surface-3 text-foreground'
              )}
            >
              {isPaused ? (
                <Play className="w-8 h-8 ml-1" />
              ) : (
                <Pause className="w-8 h-8" />
              )}
            </Button>

            <Button
              onClick={handleNextSegment}
              variant="ghost"
              size="lg"
              className="w-14 h-14 rounded-full bg-surface-1 hover:bg-surface-2"
              disabled={currentSegmentIndex >= flatSegments.length - 1}
            >
              <SkipForward className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default WorkoutSession;
