import { useCallback, useEffect, useRef, useState } from 'react';
import { drawSkeleton } from '@/components/punch/skeleton';
import { usePunchCamera } from '@/hooks/usePunchCamera';
import { PunchDetector } from '@/lib/punch/detector';
import { assessFraming, FRAMING_MESSAGES, FramingMonitor, type FramingStatus } from '@/lib/punch/framing';
import type { PoseResult } from '@/lib/punch/poseModel';
import { applyEvent, comboReadout, CueQueue, cuesFor, newRound, PUNCH_LABELS, summarize, type RoundState } from '@/lib/punch/round';
import type { PunchDetected, PunchEvent, Stance } from '@/lib/punch/types';

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
}

/** The whole camera pipeline: camera, pose model, detector, tally, cues and framing checks. */
export function usePunchTracking({ stance, processing = true, onCue, onPoseFrame, onEvent }: Options) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef(new PunchDetector(stance));
  const roundRef = useRef<RoundState>(newRound());
  const cuesRef = useRef(new CueQueue());
  const framingRef = useRef(new FramingMonitor());
  const lumaRef = useRef<number | null>(null);
  const framingStatusRef = useRef<FramingStatus>('ok');
  const lastCueRef = useRef<string | null>(null);
  const lastLabelRef = useRef<string | null>(null);
  const callbacksRef = useRef({ onCue, onPoseFrame, onEvent });
  callbacksRef.current = { onCue, onPoseFrame, onEvent };

  const [hud, setHud] = useState<TrackingHud>(EMPTY_HUD);
  const [lastPunch, setLastPunch] = useState<PunchDetected | null>(null);
  const [paused, setPaused] = useState(false);

  // A stance change, or a profile that loads late, applies from the next punch
  useEffect(() => {
    detectorRef.current = new PunchDetector(stance);
  }, [stance]);

  const onPose = useCallback((result: PoseResult, t: number, meanLuma: number | null) => {
    callbacksRef.current.onPoseFrame?.(result, t);
    if (videoRef.current && canvasRef.current) drawSkeleton(canvasRef.current, videoRef.current, result.image);
    if (meanLuma !== null) lumaRef.current = meanLuma;
    framingStatusRef.current = framingRef.current.push(assessFraming(result.image, lumaRef.current), t);

    for (const event of detectorRef.current.push({ t, landmarks: result.world })) {
      applyEvent(roundRef.current, event);
      callbacksRef.current.onEvent?.(event);
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

  const start = useCallback(() => {
    setPaused(false);
    return startCamera();
  }, [startCamera]);

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

  return { videoRef, canvasRef, status, problem, paused, hud, lastPunch, start, stop, reset, getSummary };
}
