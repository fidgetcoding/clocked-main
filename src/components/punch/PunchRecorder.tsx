import { useNavigate } from 'react-router-dom';
import { Download, Lock } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useRecordSession } from '@/hooks/useRecordSession';
import { useStance } from '@/hooks/useStance';
import { CAMERA_MESSAGES } from '@/lib/punch/framing';
import { RECORD_STEPS } from '@/lib/punch/recording';

/** Hidden calibration mode: prompts for each punch and saves the landmarks, never the video, to a file. */
export function PunchRecorder() {
  const navigate = useNavigate();
  const { stance } = useStance();
  const { videoRef, canvasRef, status, problem, paused, hud, start, stage, step, stepIndex, remaining, frameCount, recording, begin, next } =
    useRecordSession({ stance });

  const download = () => {
    if (!recording) return;
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
      <div className="min-h-screen flex flex-col bg-background px-4 py-4 gap-4" data-testid="punch-recorder" data-stage={stage} data-frames={recording?.frames.length ?? frameCount}>
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
              onClick={next}
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
              <p className="text-2xl font-bold text-volt">{recording?.frames.length ?? 0}</p>
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
