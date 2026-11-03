import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { drawSkeleton, type HandMark } from '@/components/punch/skeleton';
import { usePunchCamera } from '@/hooks/usePunchCamera';
import { PunchDetector } from '@/lib/punch/detector';
import { assessFraming, FRAMING_MESSAGES, FramingMonitor, type FramingStatus } from '@/lib/punch/framing';
import type { PoseResult } from '@/lib/punch/poseModel';
import { applyEvent, comboReadout, CueQueue, cuesFor, newRound, PUNCH_LABELS, summarize, type RoundState } from '@/lib/punch/round';
import { Calibration, type CalibrationActions, type CalibrationView } from '@/lib/punch/calibration';
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
  /** False watches the body without counting anything: the screen before a session starts. */
  counting?: boolean;
  /** Off for recording mode, where the prompts already say what to do. */
  calibrate?: boolean;
}

// Long enough to catch from across the room
const HAND_MARK_MS = 450;

const sideOf = (hand: Hand, stance: Stance): HandMark['side'] => ((hand === 'lead') === (stance === 'orthodox') ? 'left' : 'right');

/** The whole camera pipeline: camera, pose model, detector, tally, cues and framing checks. */
export function usePunchTracking({ stance, processing = true, onCue, onPoseFrame, onEvent, counting = true, calibrate = true }: Options) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef(new PunchDetector(stance));
  const roundRef = useRef<RoundState>(newRound());
  const handMarkRef = useRef<HandMark | null>(null);
  const stanceRef = useRef(stance);
  stanceRef.current = stance;
  const countingRef = useRef(counting);
  countingRef.current = counting;
  const calibrationRef = useRef<Calibration | null>(null);
  const calibrationKeyRef = useRef('');
  const [calibration, setCalibration] = useState<CalibrationView | null>(null);
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

  // Redraws only when something on screen would change, not every frame
  const publishCalibration = useCallback((force = false) => {
    const current = calibrationRef.current;
    const key = current ? current.key() : '';
    if (!force && key === calibrationKeyRef.current) return;
    calibrationKeyRef.current = key;
    setCalibration(current ? current.view() : null);
  }, []);
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

    const calibrating = calibrationRef.current && !calibrationRef.current.done ? calibrationRef.current : null;
    if (calibrating) {
      if (calibrating.push(t, framingStatusRef.current, result.world, result.image)) {
        const seen = calibrating.checkResult!;
        if (seen.guard) detectorRef.current.applyGuard(seen.guard);
        callbacksRef.current.setLastStartCheck(seen);
      }
      // The detector watches all through calibration, since it needs a moment to settle before the first punch.
      // Punches thrown for the walkthrough are read the usual way, but never counted.
      if (!countingRef.current) {
        for (const event of detectorRef.current.push({ t, landmarks: result.world })) {
          if (event.type !== 'punch' || !calibrating.listening) continue;
          calibrating.onPunch(event);
          if (!event.handUnsure) handMarkRef.current = { side: sideOf(event.hand, stanceRef.current), tone: 'punch', until: t + HAND_MARK_MS };
        }
      }
      publishCalibration();
    }

    for (const event of countingRef.current ? detectorRef.current.push({ t, landmarks: result.world }) : []) {
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
  }, [publishCalibration]);

  const { status, problem, statsRef, start: startCamera, stop: stopCamera } = usePunchCamera({
    videoRef,
    onPose,
    processing,
  });

  /** Without a guard hold this time, where the hands rested last time is the best guess. */
  const applyLastGuard = useCallback(() => {
    if (calibrationRef.current?.checkResult?.guard) return;
    const last = usePunchPrefsStore.getState().lastStartCheck;
    if (last?.guard) detectorRef.current.applyGuard(last.guard);
  }, []);

  const calibrationActions = useMemo<CalibrationActions>(() => {
    const act = (change: (current: Calibration) => void) => () => {
      const current = calibrationRef.current;
      if (!current) return;
      const wasDone = current.done;
      change(current);
      if (current.done && !wasDone) applyLastGuard();
      publishCalibration(true);
    };
    return {
      begin: act((current) => current.begin()),
      skip: act((current) => current.skip()),
      skipStep: act((current) => current.skipStep()),
      retryPunch: act((current) => current.retryPunch()),
      skipPunch: act((current) => current.skipPunch()),
      finish: act((current) => current.finish()),
      restart: act((current) => current.restart()),
    };
  }, [applyLastGuard, publishCalibration]);

  const start = useCallback(() => {
    setPaused(false);
    // Once per session: coming back to the tab carries on where it was. A session already counting goes without.
    if (calibrate && !calibrationRef.current) {
      calibrationRef.current = new Calibration();
      if (countingRef.current) calibrationRef.current.skip();
      if (calibrationRef.current.done) applyLastGuard();
      publishCalibration(true);
    }
    return startCamera();
  }, [calibrate, applyLastGuard, publishCalibration, startCamera]);

  // Starting the session while calibration is still up skips the rest of it
  useEffect(() => {
    if (counting && calibrationRef.current && !calibrationRef.current.done) calibrationActions.skip();
  }, [counting, calibrationActions]);

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
    calibrationRef.current = null;
    publishCalibration(true);
    setHud(EMPTY_HUD);
    setLastPunch(null);
    setPaused(false);
  }, [stance, publishCalibration]);

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

  return { videoRef, canvasRef, status, problem, paused, hud, lastPunch, start, stop, reset, getSummary, calibration, calibrationActions };
}
