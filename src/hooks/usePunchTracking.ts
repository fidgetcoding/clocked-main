import { useCallback, useEffect, useRef, useState } from 'react';
import { drawSkeleton, type HandMark } from '@/components/punch/skeleton';
import { usePunchCamera } from '@/hooks/usePunchCamera';
import { PunchDetector } from '@/lib/punch/detector';
import { assessFraming, FRAMING_MESSAGES, FramingMonitor, type FramingStatus } from '@/lib/punch/framing';
import type { PoseResult } from '@/lib/punch/poseModel';
import { applyEvent, comboReadout, CueQueue, cuesFor, newRound, PUNCH_LABELS, summarize, type RoundState } from '@/lib/punch/round';
import { StartCheck, type StartCheckResult } from '@/lib/punch/startCheck';
import { usePunchPrefsStore } from '@/stores/punchPrefsStore';
import type { Hand, PunchDetected, PunchEvent, Stance } from '@/lib/punch/types';

export interface TrackingHud {
  count: number;
  cue: string | null;
  combo: string;
  lastLabel: string | null;
  warning: string | null;
  fps: number;
  inferenceMs: number;
  delegate: string | null;
  frames: number;
}

const EMPTY_HUD: TrackingHud = {
  count: 0,
  cue: null,
  combo: '',
  lastLabel: null,
  warning: null,
  fps: 0,
  inferenceMs: 0,
  delegate: null,
  frames: 0,
};

interface Options {
  stance: Stance;
  /** While false the camera stays on but nothing is tracked or counted, for rests and pauses. */
  processing?: boolean;
  /** Called once when a new cue goes up. */
  onCue?: (cue: string) => void;
  /** Called with every frame's pose, for recording landmarks. */
  onPoseFrame?: (result: PoseResult, t: number) => void;
  /** Called with every detector event, for keeping a full log. */
  onEvent?: (event: PunchEvent) => void;
  /** Off for recording mode, where the prompts already say what to do. */
  startCheck?: boolean;
}

// Long enough to catch from across the room
const HAND_MARK_MS = 450;

const sideOf = (hand: Hand, stance: Stance): HandMark['side'] => ((hand === 'lead') === (stance === 'orthodox') ? 'left' : 'right');

export interface StartCheckHud {
  running: boolean;
  secondsLeft: number;
  result: StartCheckResult | null;
}

/** The whole camera pipeline: camera, pose model, detector, tally, cues and framing checks. */
export function usePunchTracking({ stance, processing = true, onCue, onPoseFrame, onEvent, startCheck = true }: Options) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef(new PunchDetector(stance));
  const roundRef = useRef<RoundState>(newRound());
  const handMarkRef = useRef<HandMark | null>(null);
  const stanceRef = useRef(stance);
  stanceRef.current = stance;
  const startCheckRef = useRef<StartCheck | null>(null);
  const [check, setCheck] = useState<StartCheckHud>({ running: false, secondsLeft: 0, result: null });
  const setLastStartCheck = usePunchPrefsStore((state) => state.setLastStartCheck);
  const cuesRef = useRef(new CueQueue());
  const framingRef = useRef(new FramingMonitor());
  const lumaRef = useRef<number | null>(null);
  const framingStatusRef = useRef<FramingStatus>('ok');
  const lastCueRef = useRef<string | null>(null);
  const lastLabelRef = useRef<string | null>(null);
  const callbacksRef = useRef({ onCue, onPoseFrame, onEvent, setLastStartCheck });
  callbacksRef.current = { onCue, onPoseFrame, onEvent, setLastStartCheck };

  const [hud, setHud] = useState<TrackingHud>(EMPTY_HUD);
  const [lastPunch, setLastPunch] = useState<PunchDetected | null>(null);
  const [paused, setPaused] = useState(false);

  // A stance change, or a profile that loads late, applies from the next punch
  useEffect(() => {
    detectorRef.current = new PunchDetector(stance);
  }, [stance]);

  const onPose = useCallback((result: PoseResult, t: number, meanLuma: number | null) => {
    callbacksRef.current.onPoseFrame?.(result, t);
    const mark = handMarkRef.current && t < handMarkRef.current.until ? handMarkRef.current : null;
    if (videoRef.current && canvasRef.current) drawSkeleton(canvasRef.current, videoRef.current, result.image, mark);
    if (meanLuma !== null) lumaRef.current = meanLuma;
    const video = videoRef.current;
    const aspect = video?.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : undefined;
    framingStatusRef.current = framingRef.current.push(assessFraming(result.image, lumaRef.current, undefined, aspect), t);

    const running = startCheckRef.current;
    if (running) {
      running.push(t, result.world, result.image);
      if (running.isDone(t)) {
        const seen = running.result();
        startCheckRef.current = null;
        if (seen.guard) detectorRef.current.applyGuard(seen.guard);
        callbacksRef.current.setLastStartCheck(seen);
        setCheck({ running: false, secondsLeft: 0, result: seen });
      } else {
        const secondsLeft = Math.ceil(running.remaining(t));
        setCheck((current) => (current.secondsLeft === secondsLeft && current.running ? current : { running: true, secondsLeft, result: null }));
      }
    }

    for (const event of detectorRef.current.push({ t, landmarks: result.world })) {
      applyEvent(roundRef.current, event);
      callbacksRef.current.onEvent?.(event);
      // A punch gets a marker at the hand, a correction gets the telestrator. Not when the hand is a guess.
      if (event.type !== 'punch') handMarkRef.current = { side: sideOf(event.hand, stanceRef.current), tone: 'fix', until: t + HAND_MARK_MS };
      else if (!event.handUnsure) handMarkRef.current = { side: sideOf(event.hand, stanceRef.current), tone: 'punch', until: t + HAND_MARK_MS };
      if (event.type === 'punch') {
        lastLabelRef.current = PUNCH_LABELS[event.punch];
        setLastPunch(event);
      }
      for (const cue of cuesFor(event)) cuesRef.current.offer(cue, t);
    }

    const cue = cuesRef.current.read(t);
    if (cue !== lastCueRef.current) {
      lastCueRef.current = cue;
      if (cue) callbacksRef.current.onCue?.(cue);
    }
  }, []);

  const { status, problem, statsRef, start: startCamera, stop: stopCamera } = usePunchCamera({
    videoRef,
    onPose,
    processing,
  });

  const runStartCheck = useCallback(() => {
    startCheckRef.current = new StartCheck();
    setCheck({ running: true, secondsLeft: Math.ceil(new StartCheck().remaining(0)), result: null });
  }, []);

  /** Skipping falls back to what the last check saw, if anything. */
  const skipStartCheck = useCallback(() => {
    startCheckRef.current = null;
    const last = usePunchPrefsStore.getState().lastStartCheck;
    if (last?.guard) detectorRef.current.applyGuard(last.guard);
    setCheck({ running: false, secondsLeft: 0, result: null });
  }, []);

  const start = useCallback(() => {
    setPaused(false);
    if (startCheck) runStartCheck();
    return startCamera();
  }, [startCamera, startCheck, runStartCheck]);

  const stop = useCallback(() => {
    setPaused(false);
    stopCamera();
  }, [stopCamera]);

  const reset = useCallback(() => {
    detectorRef.current = new PunchDetector(stance);
    roundRef.current = newRound();
    cuesRef.current = new CueQueue();
    framingRef.current = new FramingMonitor();
    lumaRef.current = null;
    framingStatusRef.current = 'ok';
    lastCueRef.current = null;
    lastLabelRef.current = null;
    setHud(EMPTY_HUD);
    setLastPunch(null);
    setPaused(false);
  }, [stance]);

  // Nothing tracked means no skeleton left frozen on the picture and no stale warning or cue
  useEffect(() => {
    if (processing) return;
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    framingStatusRef.current = 'ok';
    framingRef.current = new FramingMonitor();
    lastCueRef.current = null;
  }, [processing]);

  useEffect(() => {
    if (status !== 'live') return;
    const refresh = () => {
      const round = roundRef.current;
      const framing = framingStatusRef.current;
      setHud({
        count: round.total,
        cue: lastCueRef.current,
        combo: comboReadout(round, performance.now()),
        lastLabel: lastLabelRef.current,
        warning: framing === 'ok' ? null : FRAMING_MESSAGES[framing],
        fps: statsRef.current.fps,
        inferenceMs: statsRef.current.inferenceMs,
        delegate: statsRef.current.delegate,
        frames: statsRef.current.frames,
      });
    };
    const interval = setInterval(refresh, 100);
    return () => clearInterval(interval);
  }, [status, statsRef]);

  // Never leave the camera on behind a hidden tab. Coming back takes a tap.
  useEffect(() => {
    if (status === 'off') return;
    const handleVisibility = () => {
      if (document.visibilityState !== 'hidden') return;
      stopCamera();
      setPaused(true);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handleVisibility);
    };
  }, [status, stopCamera]);

  const getSummary = useCallback(() => summarize(roundRef.current), []);

  return { videoRef, canvasRef, status, problem, paused, hud, lastPunch, start, stop, reset, getSummary, check, runStartCheck, skipStartCheck };
}
