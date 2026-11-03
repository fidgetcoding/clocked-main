import { useRef, type RefObject } from 'react';
import { CameraIcon, LitNumber, OnAir, Plate, ScoreBug, Ticker } from '@/components/broadcast';
import { PunchStats } from '@/components/broadcast/run/parts';
import { useFreeSide } from '@/components/broadcast/run/useFreeSide';
import { useStageLayout } from '@/components/broadcast/run/useStageLayout';
import { isCalibrating, type CameraFeedState } from '@/components/punch/feedState';
import { Button } from '@/components/ui/button';
import { CalibrationFlow } from '@/components/punch/CalibrationFlow';
import type { TrackingHud } from '@/hooks/usePunchTracking';
import type { CalibrationActions, CalibrationView } from '@/lib/punch/calibration';
import { formatClock, PUNCH_LABELS, PUNCH_ORDER, punchWord } from '@/lib/punch/round';
import type { PunchClass, PunchDetected } from '@/lib/punch/types';

export interface PunchHud extends TrackingHud {
  /** Seconds to show on the clock: time left with a timer, time elapsed without. */
  clock: number;
  paused: boolean;
}

interface PunchLiveProps {
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  loading: boolean;
  hud: PunchHud;
  counts: Record<PunchClass, number>;
  debugPunch: PunchDetected | null;
  showDebug: boolean;
  onExit: () => void;
  onFinish: () => void;
  onResume: () => void;
  /** The latest body the tracker saw, for keeping the panel clear of it. */
  pose: CameraFeedState['pose'];
  calibration: CalibrationView | null;
  calibrationActions: CalibrationActions;
}

const fixed = (value: number, digits = 2) => value.toFixed(digits);

export function PunchLive({
  videoRef,
  canvasRef,
  loading,
  hud,
  counts,
  debugPunch,
  showDebug,
  onExit,
  onFinish,
  onResume,
  pose,
  calibration,
  calibrationActions,
}: PunchLiveProps) {
  const layout = useStageLayout();
  const wide = layout === 'wide';
  const stageRef = useRef<HTMLDivElement>(null);
  const free = useFreeSide(stageRef, pose, layout);
  const fps = hud.fps > 0 ? `${Math.round(hud.fps)} fps` : '';
  const calibrating = isCalibrating(calibration);
  // Calibration shows its own framing advice
  const warning = calibrating ? null : hud.warning;

  return (
    <div
      ref={stageRef}
      className="stage"
      data-panel-mode={free.mode}
      data-panel-side={free.side}
      data-panel-edge={free.edge}
      data-layout={layout === 'landscape' ? 'wide-short' : layout}
      data-camera="on"
      data-tone="live"
      data-testid="punch-live"
      data-fps={hud.fps.toFixed(1)}
      data-inference-ms={hud.inferenceMs.toFixed(1)}
      data-delegate={hud.delegate ?? ''}
      data-frames={hud.frames}
    >
      <div className="stage-feed bg-black">
        {/* Both layers are flipped together so the picture acts like a mirror */}
        <video ref={videoRef} playsInline muted className="feed-graded absolute inset-0 h-full w-full object-cover -scale-x-100" />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full object-cover -scale-x-100" />
      </div>

      <div className="stage-col">
        <div className="stage-toprow">
          <ScoreBug mid="Punch Check" className="min-w-0" />
          <div className="flex shrink-0 items-center gap-3 pr-3">
            <span className="lab lab-w hidden bg-background/70 px-1.5 py-0.5 sm:inline">Stays on this device</span>
            <span className="lab lab-w bg-background/70 px-1.5 py-0.5" data-testid="punch-fps">{fps}</span>
            <button type="button" onClick={onExit} aria-label="Leave Punch Check" className="plate plate-graphite fx h-11 px-4 text-lg">
              Leave
            </button>
          </div>
        </div>

        {layout === 'landscape' ? (
          <>
          <div className="mt-2 flex items-start justify-between px-3">
            <span className="fx timer-display stage-shadow text-[4.5rem]" data-testid="punch-clock" role="timer">
              <LitNumber value={formatClock(hud.clock)} />
            </span>
            <OnAir state={hud.paused ? 'off' : 'grind'} className="mt-2 bg-background/70 px-1.5 py-0.5">
              {hud.paused ? 'Paused' : 'Grind'}
            </OnAir>
          </div>
  
          {warning && !hud.paused && !loading && (
            <div role="status" data-testid="punch-warning" className="pointer-events-none mx-3 mt-1">
              <span className="fx inline-block bg-background/85 px-3 py-1.5 text-2xl leading-none">{warning}</span>
            </div>
          )}
  
          {showDebug && debugPunch && (
            <pre data-testid="punch-debug" className="mx-3 mt-2 w-fit bg-background/80 p-2 text-[13px] leading-tight text-foreground">
              {[
                `${debugPunch.punch} ${debugPunch.hand} conf ${fixed(debugPunch.confidence)}`,
                `dist ${fixed(debugPunch.metrics.distance)} speed ${fixed(debugPunch.metrics.peakSpeed, 1)} ${Math.round(debugPunch.metrics.durationMs)}ms`,
                `reach ${fixed(debugPunch.metrics.reach)} elbow ${Math.round(debugPunch.metrics.elbow)}`,
                `held ${Math.round(debugPunch.metrics.elbowHeldMax)} opened ${Math.round(debugPunch.metrics.elbowOpening)}`,
                `fwd ${fixed(debugPunch.metrics.forwardShare)} across ${fixed(debugPunch.metrics.armAcross)} rise ${fixed(debugPunch.metrics.rise)}`,
                `start ${fixed(debugPunch.metrics.startBelowShoulder)} below shoulder`,
                `forearm ${Math.round(debugPunch.metrics.forearmFromVertical)} off vert, ${Math.round(debugPunch.metrics.forearmFromLevel)} off level`,
                `upper arm ${Math.round(debugPunch.metrics.upperArmBelowLevel)} below level`,
                `S ${fixed(debugPunch.metrics.scores.straight)} H ${fixed(debugPunch.metrics.scores.hook)} U ${fixed(debugPunch.metrics.scores.uppercut)}`,
                `rot sh ${Math.round(debugPunch.metrics.shoulderRotation)} hip ${Math.round(debugPunch.metrics.hipRotation)}`,
                debugPunch.issues.join(', ') || 'clean at peak',
              ].join('\n')}
            </pre>
          )}
  
          <div className="stage-floor mt-auto pt-8">
            {hud.cue && !hud.paused && !loading && (
              <div role="status" data-testid="punch-cue" className="plate-slap pointer-events-none mb-2">
                <Plate tone="red" bleed="left" className={`flex w-fit justify-start py-2 pl-3 pr-8 leading-[.86] ${wide ? 'text-[7rem]' : 'text-[3.25rem]'}`}>
                  {hud.cue}
                </Plate>
              </div>
            )}
            <div className={`flex items-end gap-3 px-4 ${wide ? 'gap-8' : ''}`}>
              <p className={`fx shrink-0 ${wide ? 'text-[7rem]' : 'text-[4.5rem] [@media(max-height:480px)]:text-[3rem]'}`} data-testid="punch-count">
                <LitNumber value={hud.count} />
              </p>
              <div className="min-w-0 pb-1">
                <p className="lab">{punchWord(hud.count)}, last combo</p>
                <p className="fx truncate text-4xl" data-testid="punch-combo">{hud.combo || ' '}</p>
                <p className="lab truncate" data-testid="punch-last">Last: {hud.lastLabel ?? 'Combo'}</p>
              </div>
              {wide && <PunchStats counts={counts} large className="ml-auto w-[26rem]" />}
            </div>
            {!wide && <PunchStats counts={counts} className="mt-2 px-4 [@media(max-height:620px)]:hidden" />}
            <div className={calibrating ? 'hidden' : 'px-5 py-2.5'}>
              <button type="button" onClick={onFinish} aria-label="End round" className="plate plate-white fx h-14 w-full text-3xl">
                End round
              </button>
            </div>
          </div>
          </>
        ) : (
          <>
            <section className="free-panel" data-testid="free-panel" data-mode={free.mode} data-side={free.side} data-edge={free.edge}>
              <div className="free-head flex items-center gap-3">
                <OnAir state={hud.paused ? 'off' : 'grind'}>{hud.paused ? 'Paused' : 'Grind'}</OnAir>
                <p className="lab truncate" data-testid="punch-last">Last: {hud.lastLabel ?? 'Combo'}</p>
              </div>
              {warning && !hud.paused && !loading && (
                <div role="status" data-testid="punch-warning" className="pointer-events-none">
                  <span className="fx inline-block bg-background/85 px-3 py-1.5 text-2xl leading-none">{warning}</span>
                </div>
              )}
              {hud.cue && !hud.paused && !loading && (
                <div role="status" data-testid="punch-cue" className="plate-slap pointer-events-none">
                  <Plate tone="red" bleed="left" className="flex w-fit justify-start whitespace-normal py-2 pl-3 pr-8 text-[2.75rem] leading-[.86]">
                    {hud.cue}
                  </Plate>
                </div>
              )}
              <div className="free-clock" data-testid="punch-clock" role="timer">
                <LitNumber value={formatClock(hud.clock)} fill />
              </div>
              <p className="fx truncate text-4xl" data-testid="punch-combo">{hud.combo || ' '}</p>
              <div className="free-count min-w-0">
                <div className="flex items-end gap-2.5">
                  <p className="fx text-[3rem]" data-testid="punch-count"><LitNumber value={hud.count} /></p>
                  <p className="lab pb-1">{punchWord(hud.count)}</p>
                </div>
                <PunchStats counts={counts} large={wide} className="mt-1 [@media(max-height:620px)]:hidden" />
              </div>
            </section>
            <div className={calibrating ? 'hidden' : wide ? 'stage-controls-wide' : 'mt-auto px-5 py-2.5'}>
              <button type="button" onClick={onFinish} aria-label="End round" className="plate plate-white fx h-14 w-full text-3xl">
                End round
              </button>
            </div>
          </>
        )}
        {calibration && calibrating && !hud.paused && !loading && (
          <CalibrationFlow calibration={calibration} actions={calibrationActions} onStart={() => undefined} startLabel="Start round" />
        )}
        <Ticker
          tone="lime"
          lit
          paused={hud.paused}
          items={PUNCH_ORDER.filter((punch) => punch !== 'punch' && counts[punch] > 0).map((punch) => `${PUNCH_LABELS[punch]} ${counts[punch]}`).concat('Stays on this device')}
          className={wide ? 'ticker-wide mt-auto' : undefined}
        />
      </div>

      {loading && (
        <div className="stage-incoming z-20">
          <span className="fx text-5xl text-volt">Camera starting</span>
          <span className="lab lab-w">Starting the camera and pose tracker</span>
        </div>
      )}

      {hud.paused && (
        <div data-testid="punch-paused" className="absolute inset-0 z-20 flex flex-col justify-center gap-3 bg-background/95">
          <Plate tone="white" bleed="both" className="flex h-24 justify-start px-4 text-7xl">Camera off</Plate>
          <p className="fx px-4 text-4xl">Camera off because you left the tab.</p>
          <div className="px-5">
            <Button size="lg" onClick={onResume} className="w-full gap-3">
              <CameraIcon className="size-6" />
              Turn it back on
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
