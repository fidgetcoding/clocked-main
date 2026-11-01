import type { RefObject } from 'react';
import { ArrowLeft, Home, Loader2, Lock, Square } from 'lucide-react';
import { formatClock } from '@/lib/punch/round';
import type { PunchDetected } from '@/lib/punch/types';

export interface PunchHud {
  count: number;
  cue: string | null;
  combo: string;
  lastLabel: string | null;
  warning: string | null;
  fps: number;
  inferenceMs: number;
  delegate: string | null;
  frames: number;
  /** Seconds to show on the clock: time left with a timer, time elapsed without. */
  clock: number;
  paused: boolean;
}

interface PunchLiveProps {
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  loading: boolean;
  hud: PunchHud;
  debugPunch: PunchDetected | null;
  showDebug: boolean;
  onExit: () => void;
  onFinish: () => void;
  onResume: () => void;
}

const fixed = (value: number, digits = 2) => value.toFixed(digits);

export function PunchLive({
  videoRef,
  canvasRef,
  loading,
  hud,
  debugPunch,
  showDebug,
  onExit,
  onFinish,
  onResume,
}: PunchLiveProps) {
  return (
    <div
      className="h-[100dvh] flex flex-col bg-background"
      data-testid="punch-live"
      data-fps={hud.fps.toFixed(1)}
      data-inference-ms={hud.inferenceMs.toFixed(1)}
      data-delegate={hud.delegate ?? ''}
      data-frames={hud.frames}
    >
      <header className="flex items-center justify-between px-4 py-3 safe-top">
        <button
          onClick={onExit}
          aria-label="Leave Punch Check"
          className="flex items-center gap-2 px-3 py-2 rounded-full bg-surface-1 border border-surface-3"
        >
          <ArrowLeft className="w-4 h-4" />
          <Home className="w-4 h-4" />
        </button>
        <span className="timer-display text-2xl font-black text-volt" data-testid="punch-clock">
          {formatClock(hud.clock)}
        </span>
        <span className="text-xs font-bold text-muted-foreground w-[4.5rem] text-right" data-testid="punch-fps">
          {hud.fps > 0 ? `${Math.round(hud.fps)} fps` : ''}
        </span>
      </header>

      <div className="relative flex-1 min-h-0 mx-4 rounded-2xl overflow-hidden bg-black border border-surface-3">
        {/* Both layers are flipped together so the picture acts like a mirror */}
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-contain -scale-x-100"
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-contain -scale-x-100 pointer-events-none"
        />

        <span className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 text-[11px] text-foreground">
          <Lock className="w-3 h-3 text-volt" />
          Stays on this device
        </span>

        {hud.warning && !hud.paused && !loading && (
          <div
            role="status"
            data-testid="punch-warning"
            className="absolute top-10 inset-x-2 p-2 rounded-xl bg-black/80 border border-surface-3 text-center text-sm font-medium text-foreground"
          >
            {hud.warning}
          </div>
        )}

        {hud.cue && !hud.paused && !loading && (
          <div
            role="status"
            data-testid="punch-cue"
            className="absolute bottom-3 inset-x-0 mx-auto w-fit max-w-[90%] px-4 py-2 rounded-full bg-volt text-primary-foreground text-lg font-black uppercase tracking-wide"
          >
            {hud.cue}
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-center px-6">
            <Loader2 className="w-8 h-8 text-volt animate-spin" />
            <p className="text-sm text-foreground">Starting the camera and pose tracker</p>
          </div>
        )}

        {hud.paused && (
          <div
            data-testid="punch-paused"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 text-center px-6"
          >
            <p className="text-sm text-foreground">Camera off because you left the tab.</p>
            <button
              onClick={onResume}
              className="px-4 py-2 rounded-full bg-volt text-primary-foreground text-sm font-bold"
            >
              Turn it back on
            </button>
          </div>
        )}

        {showDebug && debugPunch && (
          <pre
            data-testid="punch-debug"
            className="absolute bottom-16 left-2 p-2 rounded-lg bg-black/80 text-[10px] leading-tight text-foreground whitespace-pre"
          >
            {[
              `${debugPunch.punch} ${debugPunch.hand} conf ${fixed(debugPunch.confidence)}`,
              `dist ${fixed(debugPunch.metrics.distance)} speed ${fixed(debugPunch.metrics.peakSpeed, 1)} ${Math.round(debugPunch.metrics.durationMs)}ms`,
              `reach ${fixed(debugPunch.metrics.reach)} elbow ${Math.round(debugPunch.metrics.elbow)}`,
              `fwd ${fixed(debugPunch.metrics.forwardShare)} across ${fixed(debugPunch.metrics.acrossShare)} up ${fixed(debugPunch.metrics.upShare)}`,
              `S ${fixed(debugPunch.metrics.scores.straight)} H ${fixed(debugPunch.metrics.scores.hook)} U ${fixed(debugPunch.metrics.scores.uppercut)}`,
              `rot sh ${Math.round(debugPunch.metrics.shoulderRotation)} hip ${Math.round(debugPunch.metrics.hipRotation)}`,
              debugPunch.issues.join(', ') || 'clean at peak',
            ].join('\n')}
          </pre>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 px-4 py-4 safe-bottom">
        <div className="min-w-[5rem]">
          <p className="timer-display text-5xl font-black text-volt text-glow-volt leading-none" data-testid="punch-count">
            {hud.count}
          </p>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Punches</p>
        </div>

        <div className="flex-1 min-w-0 text-center">
          <p className="text-2xl font-black text-foreground truncate" data-testid="punch-combo">
            {hud.combo || ' '}
          </p>
          <p className="text-xs text-muted-foreground truncate" data-testid="punch-last">
            {hud.lastLabel ?? 'Combo'}
          </p>
        </div>

        <button
          onClick={onFinish}
          aria-label="End round"
          className="w-16 h-16 shrink-0 rounded-full bg-volt flex items-center justify-center shadow-lg shadow-volt/30 active:scale-95 transition-transform"
        >
          <Square className="w-6 h-6 text-primary-foreground" />
        </button>
      </div>
    </div>
  );
}
