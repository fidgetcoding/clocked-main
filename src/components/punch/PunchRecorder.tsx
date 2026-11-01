import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Lock } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { usePunchTracking } from '@/hooks/usePunchTracking';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import { useStance } from '@/hooks/useStance';
import { CAMERA_MESSAGES } from '@/lib/punch/framing';
import type { PoseResult } from '@/lib/punch/poseModel';
import {
  packLandmarks,
  RECORD_STEPS,
  RECORDING_FORMAT,
  type PunchRecording,
  type RecordedFrame,
  type RecordedSegment,
} from '@/lib/punch/recording';

const GET_READY_MS = 4000;
/** One punch per spoken count. */
const COUNT_EVERY_MS = 2500;

type Stage = 'intro' | 'ready' | 'recording' | 'done';

/** Hidden calibration mode: prompts for each punch and saves the landmarks, never the video, to a file. */
export function PunchRecorder() {
  const navigate = useNavigate();
  const { stance } = useStance();
  const { initialize: initializeSpeech, speak } = useSpeechSynthesis();

  const framesRef = useRef<RecordedFrame[]>([]);
  const segmentsRef = useRef<RecordedSegment[]>([]);
  const lastTRef = useRef(0);
  const videoSizeRef = useRef({ width: 0, height: 0 });

  const onPoseFrame = useCallback((result: PoseResult, t: number) => {
    lastTRef.current = t;
    framesRef.current.push({ t, image: packLandmarks(result.image), world: packLandmarks(result.world) });
  }, []);

  const { videoRef, canvasRef, status, problem, paused, hud, start, stop } = usePunchTracking({ stance, onPoseFrame });

  const [stage, setStage] = useState<Stage>('intro');
  const [stepIndex, setStepIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const step = RECORD_STEPS[stepIndex];

  const closeSegment = useCallback(() => {
    const open = segmentsRef.current[segmentsRef.current.length - 1];
    if (open && open.endT === Infinity) open.endT = lastTRef.current;
  }, []);

  const goToStep = useCallback(
    (index: number) => {
      closeSegment();
      if (index >= RECORD_STEPS.length) {
        const video = videoRef.current;
        if (video) videoSizeRef.current = { width: video.videoWidth, height: video.videoHeight };
        stop();
        setStage('done');
        return;
      }
      // The step starts with its prompt, because people start throwing as soon as they see it
      segmentsRef.current.push({
        label: RECORD_STEPS[index].label,
        expected: RECORD_STEPS[index].expected,
        startT: lastTRef.current,
        endT: Infinity,
      });
      setStepIndex(index);
      setStage('ready');
      speak(`Next. ${RECORD_STEPS[index].prompt}`);
    },
    [closeSegment, speak, stop, videoRef],
  );

  // Hold the sequence until the camera is live, then run each step off the wall clock
  useEffect(() => {
    if (status === 'live' && stage === 'intro') goToStep(0);
  }, [goToStep, stage, status]);

  useEffect(() => {
    if (stage !== 'ready') return;
    const timer = setTimeout(() => {
      setRemaining(step.seconds);
      setStage('recording');
      speak('Go');
    }, GET_READY_MS);
    return () => clearTimeout(timer);
  }, [speak, stage, step]);

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

  const begin = () => {
    framesRef.current = [];
    segmentsRef.current = [];
    initializeSpeech();
    void start();
  };

  const download = () => {
    const recording: PunchRecording = {
      format: RECORDING_FORMAT,
      version: 1,
      createdAt: new Date().toISOString(),
      stance,
      video: videoSizeRef.current,
      segments: segmentsRef.current,
      frames: framesRef.current,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(recording)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `punch-landmarks-${stance}-${recording.createdAt.slice(0, 19).replace(/[:T]/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (problem) {
    return (
      <AppLayout hideNav>
        <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background" data-testid="punch-problem">
          <div className="card-workout w-full max-w-sm text-center mb-6">
            <h1 className="text-lg font-bold text-foreground mb-2">{CAMERA_MESSAGES[problem].title}</h1>
            <p className="text-sm text-muted-foreground">{CAMERA_MESSAGES[problem].body}</p>
          </div>
          <Button onClick={() => navigate('/')} variant="secondary" className="w-full max-w-sm">
            Back to Home
          </Button>
        </div>
      </AppLayout>
    );
  }

  const live = stage === 'ready' || stage === 'recording' || status !== 'off';

  return (
    <AppLayout hideNav>
      <div className="min-h-screen flex flex-col bg-background px-4 py-4 gap-4" data-testid="punch-recorder" data-stage={stage} data-frames={framesRef.current.length}>
        <div className="w-full max-w-md mx-auto">
          <h1 className="text-2xl font-black text-foreground uppercase tracking-wider">Record Punches</h1>
          <p className="flex items-start gap-2 text-xs text-muted-foreground mt-1">
            <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-volt" />
            Saves body points only, never video. The file stays on this device unless you send it. Stance: {stance}.
          </p>
        </div>

        {stage === 'intro' && (
          <div className="w-full max-w-md mx-auto space-y-3">
            <p className="text-sm text-muted-foreground">
              Takes about 4 minutes. Turn slightly to the camera, 6 to 8 feet back, with your head, hands and hips in the
              picture. Throw one punch each time you hear a number.
            </p>
            <Button onClick={begin} disabled={status === 'starting'} size="lg" className="w-full">
              {status === 'starting' ? 'Starting' : 'Start'}
            </Button>
          </div>
        )}

        {(live || stage === 'intro') && stage !== 'done' && (
          <div className={stage === 'intro' && status === 'off' ? 'hidden' : 'relative flex-1 min-h-[16rem] rounded-2xl overflow-hidden bg-black border border-surface-3'}>
            <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-contain -scale-x-100" />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-contain -scale-x-100 pointer-events-none" />
            {paused && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 text-center px-6">
                <p className="text-sm text-foreground">Camera off because you left the tab. Frames stopped too.</p>
                <button onClick={() => void start()} className="plate plate-lime fx h-11 px-5 text-xl">
                  Turn it back on
                </button>
              </div>
            )}
            {hud.warning && !paused && (
              <div role="status" className="absolute top-2 inset-x-2 p-2 rounded-xl bg-black/80 border border-surface-3 text-center text-sm text-foreground">
                {hud.warning}
              </div>
            )}
          </div>
        )}

        {(stage === 'ready' || stage === 'recording') && (
          <div className="w-full max-w-md mx-auto text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">
              {stage === 'ready' ? 'Get ready' : `Step ${stepIndex + 1} of ${RECORD_STEPS.length}`}
            </p>
            <p className="text-2xl font-black text-volt" data-testid="record-prompt">{step.prompt}</p>
            {stage === 'recording' && (
              <p className="text-sm text-muted-foreground mb-2">{Math.ceil(remaining)}s left</p>
            )}
            <Button
              onClick={() => goToStep(stepIndex + 1)}
              disabled={stage !== 'recording'}
              variant="secondary"
            >
              Done, next
            </Button>
          </div>
        )}

        {stage === 'done' && (
          <div className="w-full max-w-md mx-auto space-y-3" data-testid="record-done">
            <div className="card-workout text-center">
              <p className="text-2xl font-bold text-volt">{framesRef.current.length}</p>
              <p className="text-sm text-muted-foreground">Frames of body points</p>
            </div>
            <Button onClick={download} size="lg" className="w-full">
              <Download />
              Download file
            </Button>
            <Button onClick={() => navigate('/')} variant="secondary" className="w-full">
              Back to Home
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
