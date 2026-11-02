import { useEffect, useRef, useState, type RefObject } from 'react';
import { bodyBox, initialFreeSide, stepFreeSide, type FreeSideState } from '@/lib/overlay/freeSide';
import type { CameraFeedState } from '@/components/punch/feedState';
import type { StageLayout } from './useStageLayout';

// About five looks a second: it only has to notice a body that has stayed put
const LOOK_MS = 200;
const PANEL_SHARE = 0.32;
const FIXED_TOP = { wide: 88, portrait: 108, landscape: 0 };
const FIXED_BOTTOM = { wide: 136, portrait: 100, landscape: 0 };

export type FreeSide = Pick<FreeSideState, 'mode' | 'side' | 'edge'>;

/** Where the panel stands. Reads the body the tracker already found. Runs no model of its own. */
export function useFreeSide(stageRef: RefObject<HTMLElement>, pose: CameraFeedState['pose'] | undefined, layout: StageLayout): FreeSide {
  const stripOnly = layout === 'portrait';
  const stateRef = useRef(initialFreeSide(stripOnly));
  const [shown, setShown] = useState<FreeSide>(() => stateRef.current);

  useEffect(() => {
    stateRef.current = initialFreeSide(stripOnly);
    setShown(stateRef.current);
    if (!pose || layout === 'landscape') return;
    const look = () => {
      const stage = stageRef.current;
      if (!stage) return;
      const { width, height } = stage.getBoundingClientRect();
      const seen = pose.current;
      const box = seen ? bodyBox(seen.points, seen.aspect, width, height) : null;
      const before = stateRef.current;
      const room = { width, height, panelWidth: width * PANEL_SHARE, top: FIXED_TOP[layout], bottom: height - FIXED_BOTTOM[layout], stripOnly };
      stateRef.current = stepFreeSide(before, box, room, performance.now());
      if (stateRef.current.lastJump !== before.lastJump) setShown(stateRef.current);
    };
    const timer = setInterval(look, LOOK_MS);
    return () => clearInterval(timer);
  }, [pose, layout, stripOnly, stageRef]);

  return shown;
}
