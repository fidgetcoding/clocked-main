import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { usePunchTracking } from '@/hooks/usePunchTracking';
import { useStance } from '@/hooks/useStance';
import { CAMERA_MESSAGES } from '@/lib/punch/framing';
import { summaryNote, type PunchSessionReport } from '@/lib/punch/round';
import { cn } from '@/lib/utils';

interface PunchCameraPanelProps {
  /** While false the preview stays on, but nothing is tracked or counted. */
  counting: boolean;
  onSummary?: (report: PunchSessionReport) => void;
  onCue?: (cue: string) => void;
  className?: string;
}

/** A small camera picture that counts and cues inside another screen. Failing never affects that screen. */
const PunchCameraPanel = ({ counting, onSummary, onCue, className }: PunchCameraPanelProps) => {
  const { stance } = useStance();
  const { videoRef, canvasRef, status, problem, paused, hud, start, getSummary } = usePunchTracking({
    stance,
    processing: counting,
    onCue,
  });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    void start();
    // Asked for once, when the panel first appears
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once a second, and a last time on the way out, since form flags can land after a punch
  const onSummaryRef = useRef(onSummary);
  onSummaryRef.current = onSummary;
  useEffect(() => {
    let lastNote = '';
    const report = () => {
      const summary = getSummary();
      const note = summaryNote(summary);
      if (note === lastNote) return;
      lastNote = note;
      onSummaryRef.current?.({ ...summary, note });
    };
    const interval = setInterval(report, 1000);
    return () => {
      clearInterval(interval);
      report();
    };
  }, [getSummary]);

  if (problem) {
    if (dismissed) return null;
    return (
      <div
        data-testid="camera-panel-problem"
        className={cn('w-44 p-2 rounded-xl bg-surface-1 border border-surface-3 flex items-start gap-1', className)}
      >
        <p className="flex-1 text-[11px] leading-snug text-muted-foreground">
          <span className="block font-bold text-foreground">{CAMERA_MESSAGES[problem].title}</span>
          Your session carries on without it.
        </p>
        <button onClick={() => setDismissed(true)} aria-label="Dismiss camera message" className="p-0.5">
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
    );
  }

  const message = counting ? hud.cue ?? hud.warning : null;

  return (
    <div
      // Narrower on short screens, where the timer comes up beside it
      className={cn('w-24 [@media(max-height:700px)]:w-14', className)}
      data-testid="camera-panel"
      data-frames={hud.frames}
      data-fps={hud.fps.toFixed(1)}
      data-delegate={hud.delegate ?? ''}
      data-counting={counting}
    >
      <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-black border border-surface-3">
        {/* Both layers are flipped together so the picture acts like a mirror */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={cn('absolute inset-0 w-full h-full object-cover -scale-x-100', !counting && 'opacity-50')}
        />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover -scale-x-100 pointer-events-none" />

        {status === 'starting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <Loader2 className="w-5 h-5 text-volt animate-spin" />
          </div>
        )}

        {paused && (
          <button
            onClick={() => void start()}
            className="absolute inset-0 flex items-center justify-center bg-black/90 px-1 text-[11px] font-bold text-volt"
          >
            Turn camera back on
          </button>
        )}

        {status === 'live' && (
          <span
            data-testid="camera-panel-count"
            className="absolute bottom-1 left-1 px-1.5 rounded-md bg-black/70 text-sm font-black text-volt"
          >
            {hud.count}
          </span>
        )}
      </div>

      {!paused && status === 'live' && !counting && (
        <p className="mt-1 text-[10px] text-center text-muted-foreground">Not counting</p>
      )}

      {message && (
        <p
          role="status"
          data-testid="camera-panel-message"
          className={cn(
            'mt-1 w-max max-w-[11rem] [@media(max-height:700px)]:max-w-[3.5rem] px-2 py-1 rounded-lg text-[11px] font-bold leading-tight',
            hud.cue ? 'bg-volt text-primary-foreground' : 'bg-surface-1 border border-surface-3 text-foreground',
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
};

export default PunchCameraPanel;
