import { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ResumeSessionDialog } from '@/components/workout/ResumeSessionDialog';
import { FRESH_SESSION } from '@/lib/sessionEffort';
import { clearSession, findResumableSession, QUICK_SESSION_ID, saveSession, type SessionSnapshot } from '@/lib/sessionRecovery';
import { RunStage } from '@/components/broadcast/run/RunStage';
import type { RunView } from '@/components/broadcast/run/types';
import type { CameraFeedState } from '@/components/punch/feedState';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
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
import { getStreakMultiplier, getLevelFromXP, getLevelProgress, getXPWithinCurrentLevel } from '@/lib/xpSystem';
import { LevelUpOverlay } from '@/components/ui/LevelUpOverlay';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { computePostLogStats } from '@/lib/workoutTracking';
import { wholeSecondsSince } from '@/lib/sessionClock';
import { MIN_REWARD_SECONDS, qualifiesForRewards } from '@/lib/sessionEffort';
import { usePunchPrefsStore } from '@/stores/punchPrefsStore';
import type { PunchSessionReport } from '@/lib/punch/round';

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
  const [punchSummary, setPunchSummary] = useState<PunchSessionReport | null>(null);
  const cameraOn = usePunchPrefsStore((state) => state.quickSessionCamera);
  const setCameraOn = usePunchPrefsStore((state) => state.setQuickSessionCamera);
  const [feed, setFeed] = useState<CameraFeedState | null>(null);
  const [feedProblemDismissed, setFeedProblemDismissed] = useState(false);

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
    isComplete: complete,
  }), [totalElapsed, accumulatedXP]);

  useEffect(() => {
    if (!isRunning || isComplete || sessionEnded.current || !user?.id) return;
    saveSession(snapshotOf(user.id, false));
  }, [isRunning, isComplete, user?.id, snapshotOf]);

  // Comes back paused. A finished run already paid out its XP, so it stays marked as paid.
  const restoreSession = useCallback((saved: SessionSnapshot) => {
    setTotalElapsed(saved.totalElapsed);
    setAccumulatedXP(saved.timerXP);
    setIsPaused(true);
    setIsRunning(!saved.isComplete);
    setIsComplete(saved.isComplete);
    xpAwardedRef.current = saved.isComplete;
    setResumable(null);
  }, []);

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
  };

  const handlePauseResume = () => {
    setIsPaused(prev => !prev);
  };

  const handleFinish = useCallback(() => {
    if (xpAwardedRef.current) return;
    xpAwardedRef.current = true;

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
  }, [accumulatedXP, addLocalXP, addProfileXP, user?.id, snapshotOf]);

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
      notes: [notes, punchSummary?.total ? punchSummary.note : ''].filter(Boolean).join('\n') || null,
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
        <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
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

          {!!punchSummary?.total && (
            <div className="card-workout w-full max-w-xs text-center mb-6" data-testid="quick-punches">
              <p className="text-2xl font-bold text-volt">{punchSummary.total}</p>
              <p className="text-sm text-muted-foreground">
                {punchSummary.total === 1 ? 'Punch' : 'Punches'} seen, {punchSummary.cleanPercent}% clean
              </p>
              {punchSummary.topFix && <p className="text-xs text-muted-foreground mt-1">{punchSummary.topFix.advice}</p>}
            </div>
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

  const totalXP = (profile?.total_xp || 0) + accumulatedXP;
  const prestige = profile?.prestige || 'beginner';
  const within = getXPWithinCurrentLevel(prestige, totalXP);

  const runView: RunView = {
    workoutName: 'QUICK SESSION',
    phaseName: 'QUICK SESSION',
    segmentName: 'FREEFORM',
    kind: 'freeform',
    idle: !isRunning,
    paused: isPaused,
    clock: formatTime(totalElapsed),
    remaining: 0,
    duration: 0,
    round: null,
    roundLabel: null,
    championship: false,
    cooldown: false,
    comboLabel: null,
    combo: [],
    nextCombo: null,
    upNext: '',
    upNextSeconds: null,
    segmentIndex: 0,
    segmentCount: 0,
    elapsed: formatTimeCompact(totalElapsed),
    sessionXP: Math.round(accumulatedXP),
    streak: profile?.current_streak || 0,
    multiplier: streakMultiplier,
    level: liveLevel,
    levelPercent: getLevelProgress(prestige, liveLevel, totalXP),
    xpToNext: liveLevel >= 100 ? null : Math.max(0, Math.ceil(within.required - within.current)),
  };

  // Active timer screen
  return (
    <AppLayout hideNav>
      {/* Level Up Overlay */}
      {levelUpLevel !== null && (
        <LevelUpOverlay level={levelUpLevel} onComplete={() => setLevelUpLevel(null)} />
      )}

      <RunStage
        view={runView}
        actions={{
          onPlay: isRunning ? handlePauseResume : handleStart,
          onPause: handlePauseResume,
          onFinish: handleFinish,
          onLeave: () => {
            if (isRunning && totalElapsed > 0) {
              setShowExitConfirm(true);
            } else {
              navigate('/');
            }
          },
          onToggleCamera: () => {
            setFeed(null);
            setFeedProblemDismissed(false);
            setCameraOn(!cameraOn);
          },
        }}
        cameraOn={cameraOn}
        camera={
          // The camera asks for permission here, once the session has started
          cameraOn && isRunning ? (
            <Suspense fallback={null}>
              <PunchCameraPanel counting={!isPaused} onSummary={setPunchSummary} onFeed={setFeed} />
            </Suspense>
          ) : undefined
        }
        feed={cameraOn ? feed : null}
        counting={!isPaused}
        problemDismissed={feedProblemDismissed}
        onDismissProblem={() => setFeedProblemDismissed(true)}
      />

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
