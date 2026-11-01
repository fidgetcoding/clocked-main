import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { PunchLive, type PunchHud } from '@/components/punch/PunchLive';
import { PunchSetup } from '@/components/punch/PunchSetup';
import { PunchSummary } from '@/components/punch/PunchSummary';
import { drawSkeleton } from '@/components/punch/skeleton';
import { usePunchCamera } from '@/hooks/usePunchCamera';
import { useProfile } from '@/hooks/useProfile';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import { useWorkoutHistory } from '@/hooks/useWorkoutHistory';
import { PunchDetector } from '@/lib/punch/detector';
import { assessFraming, CAMERA_MESSAGES, FRAMING_MESSAGES, FramingMonitor, type FramingStatus } from '@/lib/punch/framing';
import type { PoseResult } from '@/lib/punch/poseModel';
import {
  applyEvent,
  comboReadout,
  CueQueue,
  cueFor,
  newRound,
  PUNCH_LABELS,
  summarize,
  summaryNote,
  type RoundState,
  type RoundSummary,
} from '@/lib/punch/round';
import type { PunchDetected } from '@/lib/punch/types';
import { computePostLogStats } from '@/lib/workoutTracking';
import { usePunchPrefsStore } from '@/stores/punchPrefsStore';

type Screen = 'setup' | 'live' | 'summary';

const EMPTY_HUD: PunchHud = {
  count: 0,
  cue: null,
  combo: '',
  lastLabel: null,
  warning: null,
  fps: 0,
  inferenceMs: 0,
  delegate: null,
  frames: 0,
  clock: 0,
  paused: false,
};

const PunchCheck = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const showDebug = searchParams.get('debug') === '1';
  const { stance, roundSeconds, voiceCues } = usePunchPrefsStore();
  const { addHistoryEntry } = useWorkoutHistory();
  const { profile, updateProfile } = useProfile();
  const { initialize: initializeSpeech, speak, cancel: cancelSpeech } = useSpeechSynthesis();

  const [screen, setScreen] = useState<Screen>('setup');
  const [hud, setHud] = useState<PunchHud>(EMPTY_HUD);
  const [debugPunch, setDebugPunch] = useState<PunchDetected | null>(null);
  const [summary, setSummary] = useState<RoundSummary | null>(null);
  const [roundLength, setRoundLength] = useState(0);
  const [logged, setLogged] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<PunchDetector | null>(null);
  const roundRef = useRef<RoundState>(newRound());
  const cuesRef = useRef(new CueQueue());
  const framingRef = useRef(new FramingMonitor());
  const lumaRef = useRef<number | null>(null);
  const framingStatusRef = useRef<FramingStatus>('ok');
  const lastCueRef = useRef<string | null>(null);
  const lastLabelRef = useRef<string | null>(null);
  // The clock only runs while the camera is on
  const elapsedMsRef = useRef(0);
  const clockStartRef = useRef<number | null>(null);

  const onPose = useCallback(
    (result: PoseResult, t: number, meanLuma: number | null) => {
      if (videoRef.current && canvasRef.current) drawSkeleton(canvasRef.current, videoRef.current, result.image);
      if (meanLuma !== null) lumaRef.current = meanLuma;
      framingStatusRef.current = framingRef.current.push(assessFraming(result.image, lumaRef.current), t);

      for (const event of detectorRef.current?.push({ t, landmarks: result.world }) ?? []) {
        applyEvent(roundRef.current, event);
        if (event.type === 'punch') {
          lastLabelRef.current = PUNCH_LABELS[event.punch];
          setDebugPunch(event);
          // Named for the hand at fault: the other one, when it's the guard that slipped
          const opposite = event.hand === 'lead' ? 'rear' : 'lead';
          for (const issue of event.issues) {
            cuesRef.current.offer(
              cueFor(issue, issue === 'other_hand_left_guard' ? opposite : event.hand),
              t,
            );
          }
        } else {
          cuesRef.current.offer(cueFor(event.issue, event.hand), t);
        }
      }

      const cue = cuesRef.current.read(t);
      if (cue !== lastCueRef.current) {
        lastCueRef.current = cue;
        if (cue && usePunchPrefsStore.getState().voiceCues) speak(cue, { rate: 1.1 });
      }
    },
    [speak],
  );

  const { status, problem, statsRef, start, stop } = usePunchCamera({ videoRef, onPose });

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

  const finish = useCallback(() => {
    stop();
    stopClock();
    cancelSpeech();
    setSummary(summarize(roundRef.current));
    setScreen('summary');
  }, [cancelSpeech, stop, stopClock]);

  const begin = useCallback(() => {
    detectorRef.current = new PunchDetector(stance);
    roundRef.current = newRound();
    cuesRef.current = new CueQueue();
    framingRef.current = new FramingMonitor();
    lumaRef.current = null;
    framingStatusRef.current = 'ok';
    lastCueRef.current = null;
    lastLabelRef.current = null;
    elapsedMsRef.current = 0;
    clockStartRef.current = null;
    setRoundLength(roundSeconds);
    setHud({ ...EMPTY_HUD, clock: roundSeconds });
    setDebugPunch(null);
    setLogged(false);
    addHistoryEntry.reset();
    if (voiceCues) initializeSpeech();
    setScreen('live');
  }, [addHistoryEntry, initializeSpeech, roundSeconds, stance, voiceCues]);

  // The video element only exists on the live screen, so the camera starts once that has rendered
  const [startRequest, setStartRequest] = useState(0);
  useEffect(() => {
    if (startRequest > 0) void start();
  }, [start, startRequest]);

  const handleStart = () => {
    begin();
    setStartRequest((n) => n + 1);
  };

  // Refresh the display a few times a second, reading the clock off the wall like QuickSession does
  useEffect(() => {
    if (screen !== 'live') return;
    const interval = setInterval(() => {
      const running = clockStartRef.current !== null ? performance.now() - clockStartRef.current : 0;
      const elapsed = (elapsedMsRef.current + running) / 1000;
      if (roundLength > 0 && elapsed >= roundLength) {
        finish();
        return;
      }
      const round = roundRef.current;
      const framing = framingStatusRef.current;
      setHud((previous) => ({
        ...previous,
        count: round.total,
        cue: lastCueRef.current,
        combo: comboReadout(round, performance.now()),
        lastLabel: lastLabelRef.current,
        warning: framing === 'ok' ? null : FRAMING_MESSAGES[framing],
        fps: statsRef.current.fps,
        inferenceMs: statsRef.current.inferenceMs,
        delegate: statsRef.current.delegate,
        frames: statsRef.current.frames,
        clock: roundLength > 0 ? roundLength - elapsed : elapsed,
      }));
    }, 100);
    return () => clearInterval(interval);
  }, [finish, roundLength, screen, statsRef]);

  // Never leave the camera on behind a hidden tab. Coming back takes a tap.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'hidden' || screen !== 'live') return;
      stop();
      cancelSpeech();
      setHud((previous) => ({ ...previous, paused: true }));
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handleVisibility);
    };
  }, [cancelSpeech, screen, stop]);

  const handleResume = () => {
    setHud((previous) => ({ ...previous, paused: false }));
    void start();
  };

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
            const stats = await computePostLogStats(profile.user_id, profile);
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
          loading={status !== 'live' && !hud.paused}
          hud={hud}
          debugPunch={debugPunch}
          showDebug={showDebug}
          onExit={() => navigate('/')}
          onFinish={finish}
          onResume={handleResume}
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

export default PunchCheck;
