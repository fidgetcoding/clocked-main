import { toast } from 'sonner';
import { lazy, useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ResumeSessionDialog } from '@/components/workout/ResumeSessionDialog';
import { FRESH_SESSION } from '@/lib/sessionEffort';
import { clearSession, findResumableSession, QUICK_SESSION_ID, saveSession, type SessionSnapshot } from '@/lib/sessionRecovery';
import { BroadcastPage, FitText, Plate } from '@/components/broadcast';
import { DifficultyPicker } from '@/components/workout/DifficultyPicker';
import { Textarea } from '@/components/ui/textarea';
import { buttonVariants } from '@/components/ui/button-variants';
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
import { getStreakMultiplier, getLevelFromXP, getLevelProgress, getXPWithinCurrentLevel } from '@/lib/xpSystem';
import { LevelUpOverlay } from '@/components/ui/LevelUpOverlay';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { computePostLogStats, punchCountIncrements } from '@/lib/workoutTracking';
import { wholeSecondsSince } from '@/lib/sessionClock';
import { MIN_REWARD_SECONDS, qualifiesForRewards } from '@/lib/sessionEffort';
import { PunchLogDetails, PunchLogLive } from '@/components/punch/PunchLogView';
import { CameraBoundary } from '@/components/errors/CameraBoundary';
import { useSessionPunchLog } from '@/hooks/useSessionPunchLog';

// Lazy so the camera pipeline stays out of the main bundle
const CAMERA_FAILED = "The camera couldn't load. Your session carries on without it. Reload to try again.";
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
  const { profile, addXP: addProfileXP, creditSession } = useProfile();
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
  const [cameraFailed, setCameraFailed] = useState(false);
  const onCameraFailed = useCallback(() => {
    setCameraFailed(true);
    toast.error(CAMERA_FAILED);
  }, []);
  const punchLog = useSessionPunchLog(totalElapsed);
  const { snapshot: punchSnapshot, restore: restorePunchLog, endRound: endPunchRound } = punchLog;
  // Every session starts with the camera on, so calibration comes first. Turning it off lasts this session only
  const [cameraOn, setCameraOn] = useState(true);
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

  // One id per run, kept with the saved run, so its history row is only ever added once
  const historyId = useRef<string>(crypto.randomUUID());
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
    historyId: historyId.current,
  }), [totalElapsed, accumulatedXP, punchSnapshot]);

  useEffect(() => {
    if (!isRunning || isComplete || sessionEnded.current || !user?.id) return;
    saveSession(snapshotOf(user.id, false));
  }, [isRunning, isComplete, user?.id, snapshotOf]);

  // Comes back paused. A finished run already paid out its XP, so it stays marked as paid.
  const restoreSession = useCallback((saved: SessionSnapshot) => {
    if (saved.historyId) historyId.current = saved.historyId;
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

  // mutateAsync, because leaving unmounts this page and a callback passed to mutate would never run
  const historySaved = useRef(false);
  const saveToHistory = async () => {
    const finishedLog = punchLog.finish();
    // A retry after the stats failed doesn't put the session in the history twice
    if (!historySaved.current) {
      await addHistoryEntry.mutateAsync({
        id: historyId.current,
        workout_id: null,
        workout_name: 'Quick Session',
        completed_at: new Date().toISOString(),
        duration: totalElapsed,
        xp_earned: Math.round(accumulatedXP),
        difficulty: difficultyRating || null,
        notes: notes || null,
        punch_log: finishedLog ?? undefined,
        is_manual_entry: false,
        round_feedback: [],
      });
      historySaved.current = true;
    }
    if (user?.id && profile) {
      const stats = await computePostLogStats(profile.user_id, profile, totalElapsed);
      // Real punches count however short the session was. The minimum is only for streaks and session counts.
      const counts = finishedLog ? punchCountIncrements(profile, finishedLog.totals.byType) : {};
      if (stats || Object.keys(counts).length > 0) {
        await creditSession.mutateAsync({ historyId: historyId.current, base: profile, update: { ...stats, ...counts } });
      }
    }
    // Only now: the streak and totals are saved too
    setLogged(true);
  };

  const onLogFailed = (error: unknown) => {
    console.error('Failed to log session:', error);
    toast.error("Couldn't save your session. Check your connection and try again.");
    // Still in this browser until it's really saved, so a reload can pick it back up
    sessionEnded.current = false;
    if (user?.id) saveSession(snapshotOf(user.id, true));
  };

  const handleConfirmExit = (save: boolean = true) => {
    endSession();
    if (save && accumulatedXP > 0 && !xpAwardedRef.current) {
      xpAwardedRef.current = true;
      const xpEarned = Math.round(accumulatedXP);
      try {
        addLocalXP(xpEarned, true);
        addProfileXP.mutate(xpEarned);
      } catch (error) {
        console.error('Failed to award XP on exit:', error);
      }
    }
    // Nothing trained, nothing to put in the history
    if (save && totalElapsed > 0) {
      saveToHistory().catch(onLogFailed);
    }
    setShowExitConfirm(false);
    navigate('/');
  };

  const handleLog = () => {
    endSession();
    saveToHistory().catch(onLogFailed);
  };

  // Completion screen
  if (isComplete) {
    const xpEarned = Math.round(accumulatedXP);

    return (
      <AppLayout hideNav>
        <BroadcastPage show="Quick Session" className="pb-6">
          <div className="px-4 pt-3">
            <div role="heading" aria-level={1} className="fx h-16">
              <FitText className="h-full" max={72}>SESSION COMPLETE!</FitText>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-5">
            <Plate tone="lime" bleed="left" className="h-28 justify-start pl-4 pr-9 text-[6.5rem]">
              +{xpEarned}
            </Plate>
            <div>
              <p className="lab">XP Earned</p>
              <p className="fx mt-1 text-4xl">{formatTimeCompact(totalElapsed)}</p>
              <p className="lab">Duration</p>
            </div>
          </div>

          {!qualifiesForRewards(totalElapsed) && (
            <p className="mt-3 px-4 text-base text-muted-foreground">
              Train for at least {MIN_REWARD_SECONDS / 60} minutes to keep your streak going.
            </p>
          )}

          {punchLog.log.tracked && <PunchLogDetails log={punchLog.log} className="mt-4 bg-surface-1 px-4 py-3" />}

          <div className="mt-5 space-y-4 px-4">
            {!logged ? (
              <>
                <div>
                  <label htmlFor="session-notes" className="fx mb-2 block text-3xl">How did it go?</label>
                  <Textarea
                    id="session-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about your session..."
                    className="h-24 resize-none"
                  />
                </div>
                <DifficultyPicker value={difficultyRating} onChange={setDifficultyRating} />
                <Button size="lg" onClick={handleLog} className="w-full">Log Session</Button>
              </>
            ) : (
              <p className="fx text-center text-3xl text-volt">Session Logged!</p>
            )}
            <Button onClick={() => { endSession(); navigate('/'); }} variant="secondary" className="w-full">
              Back to Home
            </Button>
          </div>
        </BroadcastPage>
      </AppLayout>
    );
  }

  const totalXP = (profile?.total_xp || 0) + accumulatedXP;
  const prestige = profile?.prestige || 'beginner';
  const within = getXPWithinCurrentLevel(prestige, totalXP);

  const runView: RunView = {
    workoutName: 'QUICK SESSION',
    phaseName: 'No timer, no plan',
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
        cameraOn={cameraOn && !cameraFailed}
        camera={
          // The camera asks for permission here, once the session has started
          cameraOn && !cameraFailed ? (
            <CameraBoundary onFailed={onCameraFailed}>
              <PunchCameraPanel
                counting={isRunning && !isPaused}
                preview={!isRunning}
                onEvent={punchLog.onEvent}
                onTracking={punchLog.onTracking}
                displayCount={punchLog.log.totals.punches}
                onFeed={setFeed}
              />
            </CameraBoundary>
          ) : undefined
        }
        feed={cameraOn ? feed : null}
        startLabel="Start session"
        counting={isRunning && !isPaused}
        problemDismissed={feedProblemDismissed}
        onDismissProblem={() => setFeedProblemDismissed(true)}
        liveLog={cameraOn && isRunning ? <PunchLogLive log={punchLog.log} lastCue={punchLog.lastCue} /> : undefined}
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End Session?</AlertDialogTitle>
            <AlertDialogDescription>
              You've trained for {formatTimeCompact(totalElapsed)}. Your XP, history and punch log will be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              Keep Going
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => handleConfirmExit(false)} className={buttonVariants({ variant: 'destructive' })}>
              Leave Without Saving
            </AlertDialogAction>
            <AlertDialogAction onClick={() => handleConfirmExit(true)} >
              End & Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default QuickSession;
