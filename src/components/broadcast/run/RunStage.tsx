import { useEffect, useRef, useState } from 'react';
import { RunLandscape } from './RunLandscape';
import { RunPortrait } from './RunPortrait';
import { RunWide } from './RunWide';
import { RoundWipe } from './RoundWipe';
import { StartCheckStatus } from '@/components/punch/StartCheckStatus';
import type { RunStageProps, RunView } from './types';
import { useFreeSide } from './useFreeSide';
import { useStageLayout } from './useStageLayout';
import { isRest } from './view';

// Long enough to be a moment, short enough to be gone before the next combo
const BELL_MS = 4000;
const LAST_TEN_MIN_DURATION = 15;
// The conditioning segments go full white when the camera's off. False keeps them on the dark stage.
const WHITE_CONDITIONING = true;

const isLastTen = (view: RunView) =>
  !view.paused &&
  !view.idle &&
  view.kind !== 'prep' &&
  view.kind !== 'rest' &&
  view.kind !== 'freeform' &&
  view.remaining <= 10 &&
  view.remaining > 0 &&
  view.duration > LAST_TEN_MIN_DURATION;

function stageTone(view: RunView, showFeed: boolean) {
  if (view.kind === 'prep' || view.idle) return 'prep';
  if (isRest(view) || view.cooldown) return 'rest';
  if (view.championship) return 'gold';
  if (isLastTen(view)) return showFeed ? 'live-urgent' : 'last10';
  if (WHITE_CONDITIONING && view.kind === 'exercise' && !showFeed) return 'white';
  return 'live';
}

/** What the last round earned, for the bell as the rest starts. Real numbers from this run, or nothing. */
function useRoundBell(view: RunView) {
  const roundStartXP = useRef(view.sessionXP);
  const lastKind = useRef(view.kind);
  const [bellXP, setBellXP] = useState<number | null>(null);

  useEffect(() => {
    const wasRest = lastKind.current === 'rest';
    const nowRest = view.kind === 'rest';
    lastKind.current = view.kind;
    if (nowRest && !wasRest && view.round && !view.paused) {
      setBellXP(Math.max(0, Math.round(view.sessionXP - roundStartXP.current)));
      const timer = setTimeout(() => setBellXP(null), BELL_MS);
      return () => clearTimeout(timer);
    }
    if (!nowRest && wasRest) {
      roundStartXP.current = view.sessionXP;
      setBellXP(null);
    }
    // Runs when the segment changes, not on every tick of the XP counter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.kind, view.round]);

  return bellXP;
}

/**
 * The whole running-a-workout screen. The camera sits behind the graphics in one spot in the tree, so turning
 * the phone or resizing the window never restarts it.
 */
export function RunStage(props: RunStageProps) {
  const { view, cameraOn, camera, feed, children } = props;
  const layout = useStageLayout();
  const showFeed = cameraOn && !!camera && !feed?.problem;
  const bellXP = useRoundBell(view);
  const tone = stageTone(view, showFeed);
  const stageRef = useRef<HTMLDivElement>(null);
  const free = useFreeSide(stageRef, showFeed ? feed?.pose : undefined, layout);
  const shared = { ...props, showFeed, bellXP, free };

  return (
    <div ref={stageRef} className="stage" data-panel-mode={free.mode} data-panel-side={free.side} data-panel-edge={free.edge} data-layout={layout} data-camera={showFeed ? 'on' : 'off'} data-tone={tone} data-testid="run-stage">
      <div className="stage-feed">{camera}</div>
      {showFeed && feed?.status !== 'live' && !feed?.paused && (
        <div className="stage-incoming" aria-live="polite">
          <span className="fx text-5xl text-volt">Feed incoming</span>
          <span className="lab lab-w">Stays on this device. Not recorded or uploaded.</span>
        </div>
      )}
      {layout === 'wide' ? <RunWide {...shared} /> : layout === 'landscape' ? <RunLandscape {...shared} /> : <RunPortrait {...shared} />}
      {showFeed && feed?.status === 'live' && !feed.paused && props.counting && (
        <StartCheckStatus check={feed.check} onSkip={feed.skipCheck} onRerun={feed.rerunCheck} className="stage-check" />
      )}
      <RoundWipe view={view} />
      {children}
    </div>
  );
}
