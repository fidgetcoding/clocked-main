import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { PunchLive } from '@/components/punch/PunchLive';
import { PunchRecorder } from '@/components/punch/PunchRecorder';
import { PunchSetup } from '@/components/punch/PunchSetup';
import { PunchSummary } from '@/components/punch/PunchSummary';
import { usePunchTracking } from '@/hooks/usePunchTracking';
import { useProfile } from '@/hooks/useProfile';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import { useStance } from '@/hooks/useStance';
import { useWorkoutHistory } from '@/hooks/useWorkoutHistory';
import { CAMERA_MESSAGES } from '@/lib/punch/framing';
import { summaryNote, type RoundSummary } from '@/lib/punch/round';
import { computePostLogStats } from '@/lib/workoutTracking';
import { usePunchPrefsStore } from '@/stores/punchPrefsStore';

type Screen = 'setup' | 'live' | 'summary';

const PunchRound = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const showDebug = searchParams.get('debug') === '1';
  const { stance } = useStance();
  const { roundSeconds, voiceCues } = usePunchPrefsStore();
  const { addHistoryEntry } = useWorkoutHistory();
  const { profile, updateProfile } = useProfile();
  const { initialize: initializeSpeech, speak, cancel: cancelSpeech } = useSpeechSynthesis();

  const [screen, setScreen] = useState<Screen>('setup');
  const [summary, setSummary] = useState<RoundSummary | null>(null);
  const [roundLength, setRoundLength] = useState(0);
  const [clock, setClock] = useState(0);
  const [logged, setLogged] = useState(false);

  const onCue = useCallback(
    (cue: string) => {
      if (usePunchPrefsStore.getState().voiceCues) speak(cue, { rate: 1.1 });
    },
    [speak],
  );

  const { videoRef, canvasRef, status, problem, paused, hud, lastPunch, start, stop, reset, getSummary, check, runStartCheck, skipStartCheck } =
    usePunchTracking({ stance, onCue });

  // The clock only runs while the camera is on
  const elapsedMsRef = useRef(0);
  const clockStartRef = useRef<number | null>(null);

  const stopClock = useCallback(() => {
    if (clockStartRef.current !== null) {
      elapsedMsRef.current += performance.now() - clockStartRef.current;
      clockStartRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (status === 'live') clockStartRef.current = performance.now();
    else stopClock();
  }, [status, stopClock]);

  useEffect(() => {
    if (paused) cancelSpeech();
  }, [cancelSpeech, paused]);

  const finish = useCallback(() => {
    stop();
    stopClock();
    cancelSpeech();
    setSummary(getSummary());
    setScreen('summary');
  }, [cancelSpeech, getSummary, stop, stopClock]);

  // The video element only exists on the live screen, so the camera starts once that has rendered
  const [startRequest, setStartRequest] = useState(0);
  useEffect(() => {
    if (startRequest > 0) void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startRequest]);

  const handleStart = () => {
    reset();
    elapsedMsRef.current = 0;
    clockStartRef.current = null;
    setRoundLength(roundSeconds);
    setClock(roundSeconds);
    setLogged(false);
    addHistoryEntry.reset();
    if (voiceCues) initializeSpeech();
    setScreen('live');
    setStartRequest((n) => n + 1);
  };

  // Reads the clock off the wall like QuickSession does
  useEffect(() => {
    if (screen !== 'live') return;
    const interval = setInterval(() => {
      const running = clockStartRef.current !== null ? performance.now() - clockStartRef.current : 0;
      const elapsed = (elapsedMsRef.current + running) / 1000;
      if (roundLength > 0 && elapsed >= roundLength) {
        finish();
        return;
      }
      setClock(roundLength > 0 ? roundLength - elapsed : elapsed);
    }, 100);
    return () => clearInterval(interval);
  }, [finish, roundLength, screen]);

  const handleLog = () => {
    if (!summary) return;
    addHistoryEntry.mutate(
      {
        workout_id: null,
        workout_name: 'Punch Check',
        completed_at: new Date().toISOString(),
        duration: Math.round(elapsedMsRef.current / 1000),
        xp_earned: 0,
        difficulty: null,
        notes: summaryNote(summary),
        is_manual_entry: false,
        round_feedback: [],
      },
      {
        onSuccess: async () => {
          setLogged(true);
          if (profile) {
            const stats = await computePostLogStats(profile.user_id, profile, Math.round(elapsedMsRef.current / 1000));
            if (stats) updateProfile.mutate(stats);
          }
        },
        onError: (error) => console.error('Failed to log Punch Check:', error),
      },
    );
  };

  if (problem) {
    const message = CAMERA_MESSAGES[problem];
    return (
      <AppLayout hideNav>
        <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background" data-testid="punch-problem">
          <div className="card-workout w-full max-w-sm text-center mb-6">
            <h1 className="text-lg font-bold text-foreground mb-2">{message.title}</h1>
            <p className="text-sm text-muted-foreground">{message.body}</p>
          </div>
          <div className="w-full max-w-sm space-y-3">
            <Button onClick={handleStart} className="btn-primary-glow w-full">
              Try again
            </Button>
            <Button onClick={() => navigate('/')} variant="outline" className="w-full bg-surface-1 border-surface-3">
              Back to Home
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout hideNav>
      {screen === 'setup' && <PunchSetup onStart={handleStart} onBack={() => navigate('/')} />}
      {screen === 'live' && (
        <PunchLive
          videoRef={videoRef}
          canvasRef={canvasRef}
          loading={status !== 'live' && !paused}
          hud={{ ...hud, clock, paused }}
          debugPunch={lastPunch}
          showDebug={showDebug}
          onExit={() => navigate('/')}
          onFinish={finish}
          onResume={() => void start()}
          check={check}
          onSkipCheck={skipStartCheck}
          onRerunCheck={runStartCheck}
        />
      )}
      {screen === 'summary' && summary && (
        <PunchSummary
          summary={summary}
          seconds={elapsedMsRef.current / 1000}
          logged={logged}
          logging={addHistoryEntry.isPending}
          logFailed={addHistoryEntry.isError}
          onLog={handleLog}
          onAgain={() => setScreen('setup')}
          onHome={() => navigate('/')}
        />
      )}
    </AppLayout>
  );
};

/** ?record=1 is the hidden calibration mode. */
const PunchCheck = () => {
  const [searchParams] = useSearchParams();
  return searchParams.get('record') === '1' ? <PunchRecorder /> : <PunchRound />;
};

export default PunchCheck;
