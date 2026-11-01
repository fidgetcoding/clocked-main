import { useEffect, useRef } from 'react';
import { usePunchTracking } from '@/hooks/usePunchTracking';
import { useStance } from '@/hooks/useStance';
import { summaryNote, type PunchSessionReport } from '@/lib/punch/round';
import { cn } from '@/lib/utils';
import type { CameraFeedState } from './feedState';

interface PunchCameraPanelProps {
  /** While false the preview stays on, but nothing is tracked or counted. */
  counting: boolean;
  onSummary?: (report: PunchSessionReport) => void;
  onCue?: (cue: string) => void;
  /** Called when something the graphics show has changed. */
  onFeed?: (feed: CameraFeedState) => void;
  className?: string;
}

/** The camera picture and its tracker, filling whatever it sits in. Failing never affects the screen around it. */
const PunchCameraPanel = ({ counting, onSummary, onCue, onFeed, className }: PunchCameraPanelProps) => {
  const { stance } = useStance();
  const { videoRef, canvasRef, status, problem, paused, hud, start, getSummary } = usePunchTracking({
    stance,
    processing: counting,
    onCue,
  });

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

  // Only passed up when something on screen would change, so the page doesn't redraw ten times a second
  const onFeedRef = useRef(onFeed);
  onFeedRef.current = onFeed;
  const startRef = useRef(start);
  startRef.current = start;
  const message = counting ? hud.cue ?? hud.warning : null;
  const signature = [status, paused, problem, hud.count, hud.cue, hud.warning, hud.combo, hud.lastLabel, counting].join('|');
  useEffect(() => {
    const summary = getSummary();
    onFeedRef.current?.({
      status,
      paused,
      problem,
      count: hud.count,
      cue: counting ? hud.cue : null,
      warning: counting ? hud.warning : null,
      combo: hud.combo,
      lastLabel: hud.lastLabel,
      counts: summary.counts,
      cleanPercent: summary.cleanPercent,
      resume: () => void startRef.current(),
    });
    // The signature covers everything read here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return (
    <div
      className={cn('absolute inset-0 overflow-hidden bg-black', className)}
      data-testid="camera-panel"
      data-frames={hud.frames}
      data-fps={hud.fps.toFixed(1)}
      data-delegate={hud.delegate ?? ''}
      data-counting={counting}
      data-message={message ?? ''}
    >
      {/* Both layers are flipped together so the picture acts like a mirror */}
      <video
        ref={videoRef}
        playsInline
        muted
        className={cn(
          'absolute inset-0 h-full w-full object-cover -scale-x-100 transition-[filter] duration-300',
          !counting && 'saturate-[.35] brightness-[.72]',
        )}
      />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full object-cover -scale-x-100" />
    </div>
  );
};

export default PunchCameraPanel;
