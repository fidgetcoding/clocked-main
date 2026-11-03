import { useCallback, useEffect, useRef, useState } from 'react';
import { usePunchTracking } from '@/hooks/usePunchTracking';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import type { PoseResult } from '@/lib/punch/poseModel';
import {
  packLandmarks,
  RECORD_STEPS,
  RECORDING_FORMAT,
  type PunchRecording,
  type RecordedFrame,
  type RecordedSegment,
  type RecordStep,
} from '@/lib/punch/recording';
import type { Stance } from '@/lib/punch/types';

export const GET_READY_MS = 4000;
/** One punch per spoken count. */
const COUNT_EVERY_MS = 2500;

export type RecordStage = 'intro' | 'countdown' | 'ready' | 'recording' | 'done';

interface Options {
  stance: Stance;
  steps?: RecordStep[];
  getReadyMs?: number;
  /** Seconds counted down out loud once the camera is live, before the first step. 0 goes straight in. */
  countdownSeconds?: number;
  /** Said as the countdown starts. */
  countdownLine?: string;
}

/**
 * Runs the prompted punch steps against the camera and keeps the landmarks, never the video.
 * The hidden recorder and the angle lab both use it, so they ask for the same things in the same voice.
 */
export function useRecordSession({ stance, steps = RECORD_STEPS, getReadyMs = GET_READY_MS, countdownSeconds = 0, countdownLine = 'Get ready' }: Options) {
  const { initialize: initializeSpeech, speak } = useSpeechSynthesis();

  const framesRef = useRef<RecordedFrame[]>([]);
  const segmentsRef = useRef<RecordedSegment[]>([]);
  const lastTRef = useRef(0);

  const onPoseFrame = useCallback((result: PoseResult, t: number) => {
    lastTRef.current = t;
    framesRef.current.push({ t, image: packLandmarks(result.image), world: packLandmarks(result.world) });
  }, []);

  const { videoRef, canvasRef, status, problem, paused, hud, start, stop } = usePunchTracking({ stance, calibrate: false, onPoseFrame });

  const [stage, setStage] = useState<RecordStage>('intro');
  const [stepIndex, setStepIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [recording, setRecording] = useState<PunchRecording | null>(null);
  const step = steps[Math.min(stepIndex, steps.length - 1)];

  const closeSegment = useCallback(() => {
    const open = segmentsRef.current[segmentsRef.current.length - 1];
    if (open && open.endT === Infinity) open.endT = lastTRef.current;
  }, []);

  const goToStep = useCallback(
    (index: number) => {
      closeSegment();
      if (index >= steps.length) {
        const video = videoRef.current;
        setRecording({
          format: RECORDING_FORMAT,
          version: 1,
          createdAt: new Date().toISOString(),
          stance,
          video: video ? { width: video.videoWidth, height: video.videoHeight } : { width: 0, height: 0 },
          segments: segmentsRef.current,
          frames: framesRef.current,
        });
        stop();
        setStage('done');
        return;
      }
      // The step starts with its prompt, because people start throwing as soon as they see it
      segmentsRef.current.push({
        label: steps[index].label,
        expected: steps[index].expected,
        startT: lastTRef.current,
        endT: Infinity,
      });
      setStepIndex(index);
      setStage('ready');
      speak(`Next. ${steps[index].prompt}`);
    },
    [closeSegment, speak, stance, steps, stop, videoRef],
  );

  // Hold the sequence until the camera is live, then run each step off the wall clock
  useEffect(() => {
    if (status !== 'live' || stage !== 'intro') return;
    if (countdownSeconds > 0) {
      setRemaining(countdownSeconds);
      setStage('countdown');
    } else {
      goToStep(0);
    }
  }, [countdownSeconds, goToStep, stage, status]);

  useEffect(() => {
    if (stage !== 'countdown') return;
    const startedAt = performance.now();
    let said = Infinity;
    speak(countdownLine);
    const interval = setInterval(() => {
      const left = countdownSeconds - (performance.now() - startedAt) / 1000;
      setRemaining(Math.max(0, left));
      if (left <= 0) {
        clearInterval(interval);
        // The recording starts at the first step, so what happened while getting ready isn't scored
        framesRef.current = [];
        goToStep(0);
        return;
      }
      const whole = Math.ceil(left);
      if (whole <= 3 && whole < said) {
        said = whole;
        speak(String(whole), { rate: 1.2 });
      }
    }, 100);
    return () => clearInterval(interval);
  }, [countdownLine, countdownSeconds, goToStep, speak, stage]);

  useEffect(() => {
    if (stage !== 'ready') return;
    const timer = setTimeout(() => {
      setRemaining(step.seconds);
      setStage('recording');
      speak('Go');
    }, getReadyMs);
    return () => clearTimeout(timer);
  }, [getReadyMs, speak, stage, step]);

  useEffect(() => {
    if (stage !== 'recording') return;
    const startedAt = performance.now();
    let said = 0;
    const interval = setInterval(() => {
      const elapsed = performance.now() - startedAt;
      setRemaining(Math.max(0, step.seconds - elapsed / 1000));
      if (elapsed >= step.seconds * 1000) {
        clearInterval(interval);
        goToStep(stepIndex + 1);
        return;
      }
      const due = Math.floor(elapsed / COUNT_EVERY_MS) + 1;
      if (step.expected > 0 && due > said && due <= step.expected) {
        said = due;
        speak(String(due), { rate: 1.2 });
      }
    }, 100);
    return () => clearInterval(interval);
  }, [goToStep, speak, stage, step, stepIndex]);

  /** Starts a fresh recording. Safe to call again after one finishes. */
  const begin = useCallback(() => {
    framesRef.current = [];
    segmentsRef.current = [];
    setRecording(null);
    setStepIndex(0);
    setStage('intro');
    initializeSpeech();
    void start();
  }, [initializeSpeech, start]);

  /** Drops the recording in progress and turns the camera off. */
  const cancel = useCallback(() => {
    stop();
    framesRef.current = [];
    segmentsRef.current = [];
    setRecording(null);
    setStage('intro');
  }, [stop]);

  const next = useCallback(() => goToStep(stepIndex + 1), [goToStep, stepIndex]);

  return {
    videoRef,
    canvasRef,
    status,
    problem,
    paused,
    hud,
    start,
    stage,
    step,
    stepIndex,
    steps,
    remaining,
    frameCount: framesRef.current.length,
    recording,
    begin,
    cancel,
    next,
    speak,
  };
}
