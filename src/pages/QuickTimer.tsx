import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, Bell, Play, Pause, RotateCcw, SkipForward } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useTimerStore } from '@/stores/timerStore';
import { cn } from '@/lib/utils';

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

const QuickTimer = () => {
  const navigate = useNavigate();
  const {
    settings,
    updateSettings,
    timerState,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    tickTimer,
    nextRound,
  } = useTimerStore();

  const [isSetupMode, setIsSetupMode] = useState(true);

  // Timer tick effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerState.isRunning) {
      interval = setInterval(() => {
        tickTimer();
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerState.isRunning, tickTimer]);

  // Play bell sound on round change
  useEffect(() => {
    // TODO: Add bell sound
  }, [timerState.currentRound, timerState.isRestPeriod]);

  const handleStart = () => {
    setIsSetupMode(false);
    startTimer();
  };

  const handlePauseResume = () => {
    if (timerState.isPaused) {
      resumeTimer();
    } else {
      pauseTimer();
    }
  };

  const handleReset = () => {
    resetTimer();
    setIsSetupMode(true);
  };

  const adjustTime = useCallback((field: 'roundTime' | 'restTime' | 'warningTime', delta: number) => {
    const current = settings[field];
    const newValue = Math.max(10, current + delta);
    updateSettings({ [field]: newValue });
  }, [settings, updateSettings]);

  const adjustRounds = (delta: number) => {
    const newValue = Math.max(1, Math.min(99, settings.rounds + delta));
    updateSettings({ rounds: newValue });
  };

  // Determine if we're done
  const isComplete = !timerState.isRunning && 
                     !timerState.isPaused && 
                     timerState.currentRound >= timerState.totalRounds &&
                     timerState.timeRemaining === 0;

  if (!isSetupMode) {
    // Active Timer View
    return (
      <AppLayout hideNav>
        <div className={cn(
          'min-h-screen flex flex-col',
          timerState.isRestPeriod ? 'bg-rest-green/10' : 'bg-background'
        )}>
          {/* Top Bar */}
          <header className="flex items-center justify-between px-4 py-4 safe-top">
            <button onClick={handleReset} className="text-muted-foreground">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                {timerState.isRestPeriod ? 'REST' : 'ROUND'}
              </p>
              <p className="text-lg font-bold text-foreground">
                {timerState.currentRound} of {timerState.totalRounds}
              </p>
            </div>
            <div className="timer-display text-lg text-muted-foreground">
              {formatTimeCompact(timerState.totalElapsed)}
            </div>
          </header>

          {/* Main Timer */}
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            {/* Progress Ring */}
            <div className="relative mb-8">
              <svg className="w-64 h-64 -rotate-90" viewBox="0 0 256 256">
                <circle
                  cx="128"
                  cy="128"
                  r="120"
                  fill="none"
                  strokeWidth="8"
                  className="stroke-surface-2"
                />
                <circle
                  cx="128"
                  cy="128"
                  r="120"
                  fill="none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  className={cn(
                    'transition-all duration-1000',
                    timerState.isRestPeriod ? 'stroke-rest-green' : 'stroke-volt'
                  )}
                  style={{
                    strokeDasharray: 2 * Math.PI * 120,
                    strokeDashoffset: 2 * Math.PI * 120 * (1 - timerState.timeRemaining / (timerState.isRestPeriod ? settings.restTime : settings.roundTime)),
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn(
                  'timer-display text-timer font-bold',
                  timerState.isRestPeriod ? 'text-rest-green text-glow-green' : 'text-volt text-glow-volt',
                  timerState.timeRemaining <= settings.warningTime && !timerState.isRestPeriod && 'text-alert-red'
                )}>
                  {formatTime(timerState.timeRemaining)}
                </span>
                <span className="text-sm text-muted-foreground uppercase tracking-wider mt-2">
                  {timerState.isRestPeriod ? 'Rest Period' : 'Work Time'}
                </span>
              </div>
            </div>

            {/* Warning indicator */}
            {timerState.timeRemaining <= settings.warningTime && 
             timerState.timeRemaining > 0 && 
             !timerState.isRestPeriod && (
              <div className="text-alert-red text-sm font-semibold animate-pulse mb-4">
                ⚠️ Final {settings.warningTime} seconds!
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="px-4 pb-8 safe-bottom">
            <div className="flex items-center justify-center gap-6 mb-6">
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
                  'w-20 h-20 rounded-full text-primary-foreground',
                  timerState.isPaused 
                    ? 'bg-gradient-volt glow-volt' 
                    : 'bg-surface-2 hover:bg-surface-3 text-foreground'
                )}
              >
                {timerState.isPaused ? (
                  <Play className="w-8 h-8 ml-1" />
                ) : (
                  <Pause className="w-8 h-8" />
                )}
              </Button>

              <Button
                onClick={nextRound}
                variant="ghost"
                size="lg"
                className="w-14 h-14 rounded-full bg-surface-1 hover:bg-surface-2"
                disabled={timerState.currentRound >= timerState.totalRounds}
              >
                <SkipForward className="w-6 h-6" />
              </Button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Setup Mode
  return (
    <AppLayout>
      <div className="min-h-screen">
        {/* Header */}
        <header className="flex items-center gap-4 px-4 py-4 safe-top border-b border-surface-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-foreground">Quick Timer</h1>
        </header>

        <div className="px-4 py-6 space-y-6">
          {/* Round Time */}
          <div className="card-workout">
            <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Round Time
            </label>
            <div className="flex items-center justify-between mt-3">
              <Button
                onClick={() => adjustTime('roundTime', -30)}
                variant="ghost"
                size="lg"
                className="w-14 h-14 rounded-full bg-surface-2 hover:bg-surface-3"
              >
                <Minus className="w-6 h-6" />
              </Button>
              <span className="timer-display text-4xl font-bold text-foreground">
                {formatTime(settings.roundTime)}
              </span>
              <Button
                onClick={() => adjustTime('roundTime', 30)}
                variant="ghost"
                size="lg"
                className="w-14 h-14 rounded-full bg-surface-2 hover:bg-surface-3"
              >
                <Plus className="w-6 h-6" />
              </Button>
            </div>
          </div>

          {/* Rest Time */}
          <div className="card-workout">
            <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Rest Time
            </label>
            <div className="flex items-center justify-between mt-3">
              <Button
                onClick={() => adjustTime('restTime', -15)}
                variant="ghost"
                size="lg"
                className="w-14 h-14 rounded-full bg-surface-2 hover:bg-surface-3"
              >
                <Minus className="w-6 h-6" />
              </Button>
              <span className="timer-display text-4xl font-bold text-foreground">
                {formatTime(settings.restTime)}
              </span>
              <Button
                onClick={() => adjustTime('restTime', 15)}
                variant="ghost"
                size="lg"
                className="w-14 h-14 rounded-full bg-surface-2 hover:bg-surface-3"
              >
                <Plus className="w-6 h-6" />
              </Button>
            </div>
          </div>

          {/* Number of Rounds */}
          <div className="card-workout">
            <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Number of Rounds
            </label>
            <div className="flex items-center justify-between mt-3">
              <Button
                onClick={() => adjustRounds(-1)}
                variant="ghost"
                size="lg"
                className="w-14 h-14 rounded-full bg-surface-2 hover:bg-surface-3"
              >
                <Minus className="w-6 h-6" />
              </Button>
              <span className="timer-display text-4xl font-bold text-foreground">
                {settings.rounds}
              </span>
              <Button
                onClick={() => adjustRounds(1)}
                variant="ghost"
                size="lg"
                className="w-14 h-14 rounded-full bg-surface-2 hover:bg-surface-3"
              >
                <Plus className="w-6 h-6" />
              </Button>
            </div>
          </div>

          {/* Warning Time */}
          <div className="card-workout">
            <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Warning At
            </label>
            <div className="flex items-center justify-between mt-3">
              <Button
                onClick={() => adjustTime('warningTime', -5)}
                variant="ghost"
                size="lg"
                className="w-14 h-14 rounded-full bg-surface-2 hover:bg-surface-3"
              >
                <Minus className="w-6 h-6" />
              </Button>
              <span className="timer-display text-4xl font-bold text-foreground">
                {formatTime(settings.warningTime)}
              </span>
              <Button
                onClick={() => adjustTime('warningTime', 5)}
                variant="ghost"
                size="lg"
                className="w-14 h-14 rounded-full bg-surface-2 hover:bg-surface-3"
              >
                <Plus className="w-6 h-6" />
              </Button>
            </div>
          </div>

          {/* Start Button */}
          <Button
            onClick={handleStart}
            className="w-full h-14 btn-primary-glow text-lg font-bold"
          >
            <Bell className="w-5 h-5 mr-2" />
            START TIMER
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default QuickTimer;
