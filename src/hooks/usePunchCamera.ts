import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { cameraProblemFrom, checkSupport, meanLumaOf, type CameraProblem } from '@/lib/punch/framing';
import {
  acquirePoseModel,
  PoseUnsupportedError,
  releasePoseModel,
  replacePoseModelWithCpu,
  type PoseDelegate,
  type PoseModel,
  type PoseResult,
} from '@/lib/punch/poseModel';

export type CameraStatus = 'off' | 'starting' | 'live';

export interface PoseStats {
  fps: number;
  inferenceMs: number;
  delegate: PoseDelegate | null;
  frames: number;
}

interface Options {
  videoRef: RefObject<HTMLVideoElement>;
  /** Called for every processed video frame. meanLuma updates about once a second. */
  onPose: (result: PoseResult, t: number, meanLuma: number | null) => void;
  /** While false the preview stays on but no frames go to the model. Defaults to true. */
  processing?: boolean;
}

const VIDEO_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
};

const LUMA_INTERVAL_MS = 1000;

/**
 * Runs the camera and pose model. The camera only starts from start(), and stops on stop() and on
 * unmount. Frames go to the model on this device and nowhere else.
 */
export function usePunchCamera({ videoRef, onPose, processing = true }: Options) {
  const [status, setStatus] = useState<CameraStatus>('off');
  const [problem, setProblem] = useState<CameraProblem | null>(null);
  const statsRef = useRef<PoseStats>({ fps: 0, inferenceMs: 0, delegate: null, frames: 0 });

  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<PoseModel | null>(null);
  const mountedRef = useRef(true);
  // Bumped by every start and stop, so that anything still pending from an older run gives up
  const runRef = useRef(0);
  const onPoseRef = useRef(onPose);
  onPoseRef.current = onPose;
  const processingRef = useRef(processing);
  processingRef.current = processing;

  const stop = useCallback(() => {
    runRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
    setStatus('off');
  }, [videoRef]);

  const fail = useCallback(
    (reason: CameraProblem) => {
      stop();
      setProblem(reason);
    },
    [stop],
  );

  const loop = useCallback(
    (run: number, video: HTMLVideoElement) => {
      const lumaCanvas = document.createElement('canvas');
      lumaCanvas.width = 32;
      lumaCanvas.height = 18;
      const lumaContext = lumaCanvas.getContext('2d', { willReadFrequently: true });
      let lastVideoTime = -1;
      let lastT = 0;
      let lastLumaT = -Infinity;
      let windowStart = performance.now();
      let windowFrames = 0;
      let windowInference = 0;
      let retriedOnCpu = false;

      const schedule = () => {
        if (run !== runRef.current) return;
        if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(() => void tick());
        else requestAnimationFrame(() => void tick());
      };

      const tick = async () => {
        if (run !== runRef.current) return;
        const model = modelRef.current;
        if (processingRef.current && model && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          // The model requires strictly increasing timestamps
          const t = Math.max(performance.now(), lastT + 1);
          lastT = t;
          try {
            const before = performance.now();
            const result = model.detect(video, t);
            windowInference += performance.now() - before;
            windowFrames += 1;
            statsRef.current.frames += 1;

            let meanLuma: number | null = null;
            if (lumaContext && t - lastLumaT >= LUMA_INTERVAL_MS) {
              lastLumaT = t;
              lumaContext.drawImage(video, 0, 0, lumaCanvas.width, lumaCanvas.height);
              meanLuma = meanLumaOf(lumaContext.getImageData(0, 0, lumaCanvas.width, lumaCanvas.height).data);
            }
            onPoseRef.current(result, t, meanLuma);
          } catch (error) {
            console.error('Pose detection failed:', error);
            if (model.delegate === 'GPU' && !retriedOnCpu) {
              retriedOnCpu = true;
              modelRef.current = null;
              try {
                modelRef.current = await replacePoseModelWithCpu();
                statsRef.current.delegate = 'CPU';
              } catch (cpuError) {
                console.error('Pose model failed on the CPU too:', cpuError);
                if (run === runRef.current) fail('model_failed');
                return;
              }
            } else {
              fail('model_failed');
              return;
            }
          }

          const elapsed = performance.now() - windowStart;
          if (elapsed >= 1000) {
            statsRef.current.fps = (windowFrames * 1000) / elapsed;
            statsRef.current.inferenceMs = windowInference / Math.max(1, windowFrames);
            windowStart = performance.now();
            windowFrames = 0;
            windowInference = 0;
          }
        }
        schedule();
      };

      schedule();
    },
    [fail],
  );

  const start = useCallback(async () => {
    const run = ++runRef.current;
    setProblem(null);

    const unsupported = checkSupport({
      hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
      hasWebAssembly: typeof WebAssembly === 'object',
      hasWebGL2: !!document.createElement('canvas').getContext('webgl2'),
      isSecureContext: window.isSecureContext,
    });
    if (unsupported) {
      setProblem(unsupported);
      return;
    }

    setStatus('starting');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS);
    } catch (error) {
      let reason = cameraProblemFrom(error);
      // A block set in the browser doesn't always come back as a permission error, so ask it directly
      if (reason === 'unknown') {
        const permission = await navigator.permissions?.query({ name: 'camera' as PermissionName }).catch(() => null);
        if (permission?.state === 'denied') reason = 'denied';
      }
      if (run === runRef.current) fail(reason);
      return;
    }
    // They may have left while the permission prompt was up
    if (run !== runRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    streamRef.current = stream;

    const video = videoRef.current;
    if (!video) {
      fail('unknown');
      return;
    }
    // Safari only autoplays with these set as attributes, and React sets muted as a property
    video.muted = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.srcObject = stream;
    try {
      await video.play();
    } catch (error) {
      // Interrupted by a stop() is expected. Anything else isn't a camera permission problem,
      // because by now the camera has already been granted.
      console.error('Camera picture would not play:', error);
      if (run === runRef.current) fail('unknown');
      return;
    }

    // Only now, so that someone who says no to the camera never downloads the model
    let model = modelRef.current;
    if (!model) {
      try {
        model = await acquirePoseModel();
      } catch (error) {
        releasePoseModel();
        console.error('Pose model failed to load:', error);
        if (run === runRef.current) fail(error instanceof PoseUnsupportedError ? 'unsupported' : 'model_failed');
        return;
      }
      // They may have left while it loaded, with nothing now to give it back
      if (!mountedRef.current) {
        releasePoseModel();
        return;
      }
      modelRef.current = model;
    }
    if (run !== runRef.current) return;

    statsRef.current = { fps: 0, inferenceMs: 0, delegate: model.delegate, frames: 0 };
    setStatus('live');
    loop(run, video);
  }, [fail, loop, videoRef]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runRef.current += 1;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (modelRef.current) releasePoseModel();
      modelRef.current = null;
    };
  }, []);

  return { status, problem, statsRef, start, stop };
}
