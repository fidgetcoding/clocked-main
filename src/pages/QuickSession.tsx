import { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ResumeSessionDialog } from '@/components/workout/ResumeSessionDialog';
import { FRESH_SESSION } from '@/lib/sessionEffort';
import { clearSession, findResumableSession, QUICK_SESSION_ID, saveSession, type SessionSnapshot } from '@/lib/sessionRecovery';
import { ArrowLeft, Home, Play, Pause, Square, Camera } from 'lucide-react';
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
import { useWorkoutHistory } from '@/hooks/useWorkoutHistory';
import { useUserStore } from '@/stores/userStore';
import { useProfile } from '@/hooks/useProfile';
import { cn } from '@/lib/utils';
import { getStreakMultiplier, getLevelFromXP } from '@/lib/xpSystem';
import { LevelUpOverlay } from '@/components/ui/LevelUpOverlay';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { computePostLogStats } from '@/lib/workoutTracking';
import { wholeSecondsSince } from '@/lib/sessionClock';
import { MIN_REWARD_SECONDS, qualifiesForRewards } from '@/lib/sessionEffort';
import { Switch } from '@/components/ui/switch';
import { usePunchPrefsStore } from '@/stores/punchPrefsStore';
import { PunchLogDetails, PunchLogLive } from '@/components/punch/PunchLogView';
import { useSessionPunchLog } from '@/hooks/useSessionPunchLog';

// Lazy so the camera pipeline stays out of the main bundle
const PunchCameraPanel = lazy(() => import('@/components/punch/PunchCameraPanel'));

const QUICK_SESSION_XP_RATE = 0.10; // XP per second

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTimeCompact(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

const QuickSession = () => {
  const navigate = useNavigate();
  const { addHistoryEntry } = useWorkoutHistory();
  const { profile, addXP: addProfileXP, updateProfile } = useProfile();
  const location = useLocation();
  const user = useUserStore((state) => state.user);
  const addLocalXP = useUserStore((state) => state.addXP);

  const [totalElapsed, setTotalElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [accumulatedXP, setAccumulatedXP] = useState(0);
  const [notes, setNotes] = useState('');
  const [logged, setLogged] = useState(false);
  const [difficultyRating, setDifficultyRating] = useState<'too_easy' | 'just_right' | 'too_hard' | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [levelUpLevel, setLevelUpLevel] = useState<number | null>(null);
  const punchLog = useSessionPunchLog(totalElapsed);
  const { snapshot: punchSnapshot, restore: restorePunchLog, endRound: endPunchRound } = punchLog;
  const cameraOn = usePunchPrefsStore((state) => state.quickSessionCamera);
  const setCameraOn = usePunchPrefsStore((state) => state.setQuickSessionCamera);

  const lastTickTimeRef = useRef<number>(Date.now());
  const xpAwardedRef = useRef(false);
  const prevLevelRef = useRef<number>(profile?.current_level || 1);

  const { playLevelUpSound } = useSoundEffects();
  const streakMultiplier = getStreakMultiplier(profile?.current_streak || 0);

  // Compute live level from accumulated XP - use profile (database) as source of truth
  const liveLevel = getLevelFromXP(
    (profile?.prestige || 'beginner'),
    (profile?.total_xp || 0) + accumulatedXP
  );

  // Detect level-up
  useEffect(() => {
    if (liveLevel > prevLevelRef.current) {
      setLevelUpLevel(liveLevel);
      playLevelUpSound();
      prevLevelRef.current = liveLevel;
    }
  }, [liveLevel, playLevelUpSound]);

  // Wall-clock timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRunning && !isPaused) {
      lastTickTimeRef.current = Date.now();

      interval = setInterval(() => {
        const now = Date.now();
        const { seconds: delta, lastTick } = wholeSecondsSince(lastTickTimeRef.current, now);
        if (delta < 1) return;
        lastTickTimeRef.current = lastTick;

        setTotalElapsed(prev => prev + delta);
        setAccumulatedXP(prev => prev + (QUICK_SESSION_XP_RATE * streakMultiplier * delta));
      }, 250);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, isPaused, streakMultiplier]);

  // Keep the run in this browser, so a reload or a killed tab can pick it back up
  const [resumable, setResumable] = useState<SessionSnapshot | null>(null);
  const sessionEnded = useRef(false);

  const snapshotOf = useCallback((userId: string, complete: boolean) => ({
    userId,
    workoutId: QUICK_SESSION_ID,
    segmentCount: 0,
    segmentIndex: 0,
    timeRemaining: 0,
    totalElapsed,
    isPreparation: false,
    timerXP: accumulatedXP,
    log: FRESH_SESSION,
    punchLog: punchSnapshot(),
    isComplete: complete,
  }), [totalElapsed, accumulatedXP, punchSnapshot]);

  useEffect(() => {
    if (!isRunning || isComplete || sessionEnded.current || !user?.id) return;
    saveSession(snapshotOf(user.id, false));
  }, [isRunning, isComplete, user?.id, snapshotOf]);

  // Comes back paused. A finished run already paid out its XP, so it stays marked as paid.
  const restoreSession = useCallback((saved: SessionSnapshot) => {
    setTotalElapsed(saved.totalElapsed);
    restorePunchLog(saved.punchLog);
    setAccumulatedXP(saved.timerXP);
    setIsPaused(true);
    setIsRunning(!saved.isComplete);
    setIsComplete(saved.isComplete);
    xpAwardedRef.current = saved.isComplete;
    setResumable(null);
  }, [restorePunchLog]);

  const resumeChecked = useRef(false);
  useEffect(() => {
    if (resumeChecked.current || !user?.id) return;
    resumeChecked.current = true;
    const saved = findResumableSession(user.id, QUICK_SESSION_ID, 0);
    if (!saved) return;
    if (location.state?.resume) restoreSession(saved);
    else setResumable(saved);
  }, [user?.id, location.state, restoreSession]);

  const endSession = () => {
    sessionEnded.current = true;
    clearSession();
  };

  const handleStart = () => {
    setIsRunning(true);
    setIsPaused(false);
    punchLog.startRound();
  };

  const handlePauseResume = () => {
    if (isPaused) punchLog.startRound();
    else endPunchRound();
    setIsPaused(!isPaused);
  };

  const handleFinish = useCallback(() => {
    if (xpAwardedRef.current) return;
    xpAwardedRef.current = true;

    endPunchRound();
    setIsComplete(true);
    setIsRunning(false);
    // Marked finished before the XP goes out, so a reload right here can't pay it twice
    if (user?.id) saveSession(snapshotOf(user.id, true));

    const xpEarned = Math.round(accumulatedXP);
    queueMicrotask(() => {
      try {
        addLocalXP(xpEarned, true);
        addProfileXP.mutate(xpEarned);
      } catch (error) {
        console.error('Failed to award XP:', error);
      }
    });
  }, [accumulatedXP, addLocalXP, addProfileXP, user?.id, snapshotOf, endPunchRound]);

  const handleConfirmExit = (saveXP: boolean = true) => {
    endSession();
    if (saveXP && accumulatedXP > 0 && !xpAwardedRef.current) {
      xpAwardedRef.current = true;
      const xpEarned = Math.round(accumulatedXP);
      try {
        addLocalXP(xpEarned, true);
        addProfileXP.mutate(xpEarned);
      } catch (error) {
        console.error('Failed to award XP on exit:', error);
      }
    }
    setShowExitConfirm(false);
    navigate('/');
  };

  const handleLog = () => {
    endSession();
    const xpEarned = Math.round(accumulatedXP);
    addHistoryEntry.mutate({
      workout_id: null,
      workout_name: 'Quick Session',
      completed_at: new Date().toISOString(),
      duration: totalElapsed,
      xp_earned: xpEarned,
      difficulty: difficultyRating || null,
      notes: notes || null,
      punch_log: punchLog.finish() ?? undefined,
      is_manual_entry: false,
      round_feedback: [],
    }, {
      onSuccess: async () => {
        setLogged(true);
        if (user?.id && profile) {
          const stats = await computePostLogStats(profile.user_id, profile, totalElapsed);
          if (stats) {
            updateProfile.mutate(stats);
          }
        }
      },
      onError: (error) => console.error('Failed to log session:', error),
    });
  };

  // Completion screen
  if (isComplete) {
    const xpEarned = Math.round(accumulatedXP);

    return (
      <AppLayout hideNav>
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-background">
          <div className="text-6xl mb-6">⏱️</div>
          <h1 className="text-3xl font-black text-foreground mb-2">SESSION COMPLETE!</h1>
          <p className="text-muted-foreground mb-6">Quick Session</p>

          {!qualifiesForRewards(totalElapsed) && (
            <p className="text-xs text-muted-foreground mb-4 max-w-xs text-center">
              Train for at least {MIN_REWARD_SECONDS / 60} minutes to keep your streak going.
            </p>
          )}

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

          {punchLog.log.tracked && (
            <PunchLogDetails log={punchLog.log} className="card-workout w-full max-w-xs mb-6" />
          )}

          {!logged ? (
            <div className="w-full max-w-xs space-y-4 mb-6">
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">How did it go?</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about your session..."
                  className="w-full h-24 p-3 rounded-xl bg-surface-1 border border-surface-3 text-foreground placeholder:text-muted-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-volt"
                />
              </div>

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
                Log Session
              </Button>
            </div>
          ) : (
            <div className="w-full max-w-xs mb-6">
              <div className="card-workout text-center">
                <p className="text-volt font-semibold">Session Logged!</p>
              </div>
            </div>
          )}

          <Button onClick={() => { endSession(); navigate('/'); }} variant="outline" className="w-full max-w-xs bg-surface-1 border-surface-3">
            Back to Home
          </Button>
        </div>
      </AppLayout>
    );
  }

  // Active timer screen
  return (
    <AppLayout hideNav>
      <div className="min-h-screen flex flex-col bg-background">
        {/* Top Bar */}
        <header className="flex items-start justify-between px-4 py-3 safe-top">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (isRunning && totalElapsed > 0) {
                  setShowExitConfirm(true);
                } else {
                  navigate('/');
                }
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-full bg-surface-1 border border-surface-3"
            >
              <ArrowLeft className="w-4 h-4" />
              <Home className="w-4 h-4" />
            </button>
          </div>

          {/* XP counter */}
          <span className="text-sm font-bold text-volt/60">
            +{Math.round(accumulatedXP)} XP
          </span>

          {/* XP Bar */}
          <div className="flex items-center">
            <VerticalXPBar
              prestige={profile?.prestige || 'beginner'}
              level={liveLevel}
              totalXP={(profile?.total_xp || 0) + accumulatedXP}
            />
          </div>
        </header>

        {/* Level Up Overlay */}
        {levelUpLevel !== null && (
          <LevelUpOverlay level={levelUpLevel} onComplete={() => setLevelUpLevel(null)} />
        )}

        {/* The camera asks for permission here, once the session has started */}
        {cameraOn && isRunning && (
          <Suspense fallback={null}>
            <PunchCameraPanel
              counting={!isPaused}
              onEvent={punchLog.onEvent}
              onTracking={punchLog.onTracking}
              displayCount={punchLog.log.totals.punches}
              className="fixed left-4 top-[4.5rem] z-10"
            />
          </Suspense>
        )}

        {/* Main Timer */}
        {/* Phones need room under the camera picture, since the log makes this column taller */}
        <div className={cn('flex-1 flex flex-col items-center justify-center px-4 pb-6', cameraOn && isRunning && 'pt-32 md:pt-0')}>
          <h2 className="text-2xl font-black text-foreground mb-2 uppercase tracking-wider">
            QUICK SESSION
          </h2>

          {/* Count-up timer */}
          <span className="timer-display text-8xl font-black text-volt text-glow-volt mb-2">
            {formatTime(totalElapsed)}
          </span>

          {/* Label */}
          <div className="flex items-center gap-2 mb-8">
            <div className="h-px w-12 bg-surface-3" />
            <span className="text-xs text-muted-foreground uppercase tracking-widest">
              FREEFORM
            </span>
            <div className="h-px w-12 bg-surface-3" />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-6">
            {!isRunning ? (
              <button
                onClick={handleStart}
                className="w-20 h-20 rounded-full bg-volt flex items-center justify-center shadow-lg shadow-volt/30 active:scale-95 transition-transform"
              >
                <Play className="w-8 h-8 text-primary-foreground ml-1" />
              </button>
            ) : (
              <>
                <button
                  onClick={handlePauseResume}
                  className="w-16 h-16 rounded-full bg-surface-1 border border-surface-3 flex items-center justify-center active:scale-95 transition-transform"
                >
                  {isPaused ? (
                    <Play className="w-6 h-6 text-volt ml-0.5" />
                  ) : (
                    <Pause className="w-6 h-6 text-foreground" />
                  )}
                </button>
                <button
                  onClick={handleFinish}
                  className="w-20 h-20 rounded-full bg-volt flex items-center justify-center shadow-lg shadow-volt/30 active:scale-95 transition-transform"
                >
                  <Square className="w-7 h-7 text-primary-foreground" />
                </button>
              </>
            )}
          </div>

          <label className="flex items-center gap-3 mt-8 px-4 py-2 rounded-full bg-surface-1 border border-surface-3 text-sm text-muted-foreground">
            <Camera className="w-4 h-4 text-volt" />
            Punch camera
            <Switch
              checked={cameraOn}
              onCheckedChange={setCameraOn}
              aria-label="Punch camera"
              className="data-[state=checked]:bg-volt"
            />
          </label>

          {cameraOn && isRunning && <PunchLogLive log={punchLog.log} lastCue={punchLog.lastCue} />}
        </div>
      </div>

      {/* Exit Confirmation */}
      {resumable && (
        <ResumeSessionDialog
          name="Quick Session"
          saved={resumable}
          onResume={() => restoreSession(resumable)}
          onDiscard={() => {
            clearSession();
            setResumable(null);
          }}
        />
      )}

      <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <AlertDialogContent className="bg-surface-1 border-surface-3">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">End Session?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              You've trained for {formatTimeCompact(totalElapsed)}. Your XP will be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="bg-surface-2 border-surface-3 text-foreground">
              Keep Going
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => handleConfirmExit(false)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Leave Without Saving
            </AlertDialogAction>
            <AlertDialogAction onClick={() => handleConfirmExit(true)} className="bg-volt text-primary-foreground">
              End & Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default QuickSession;
