// Free Side: where the one camera panel sits. Works from whatever body parts the camera can see, so a fighter
// side on, from behind, from low down or half behind a bag all give it something to go on. Knows nothing about punches.

export interface SeenPoint {
  x: number;
  y: number;
  visibility?: number;
}

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface FreeSideState {
  mode: 'side' | 'strip';
  side: 'left' | 'right';
  edge: 'top' | 'bottom';
  /** What it would rather be, and since when. Null when it's happy. */
  wanted: { key: string; since: number } | null;
  lastJump: number;
}

export interface StageRoom {
  width: number;
  height: number;
  /** How wide the panel is when it stands to one side. */
  panelWidth: number;
  /** Where the fixed graphics stop, top and bottom. */
  top: number;
  bottom: number;
  /** A phone held up has no side wide enough for the clock, so it's always the strip. */
  stripOnly: boolean;
}

const MIN_VISIBILITY = 0.35;
const MIN_POINTS = 3;
// A punch through the panel's space shouldn't move it, only staying crowded
const CROWDED_MS = 500;
const MIN_BETWEEN_JUMPS_MS = 1500;
// Unfolding asks for a little more room than folding, so it can't flap at the boundary
const UNFOLD_ROOM = 1.1;
const EDGE_MARGIN = 0.12;

export const initialFreeSide = (stripOnly: boolean): FreeSideState => ({
  mode: stripOnly ? 'strip' : 'side',
  side: 'right',
  edge: 'bottom',
  wanted: null,
  lastJump: -Infinity,
});

/** The box round the body parts the model is sure of, on the stage: the picture covers it and is mirrored. */
export function bodyBox(points: SeenPoint[], aspect: number, width: number, height: number): Box | null {
  const seen = points.filter((point) => (point.visibility ?? 1) >= MIN_VISIBILITY);
  if (seen.length < MIN_POINTS) return null;
  const scale = Math.max(width / aspect, height);
  const shownWidth = scale * aspect;
  const xs = seen.map((point) => width / 2 - (point.x - 0.5) * shownWidth);
  const ys = seen.map((point) => height / 2 + (point.y - 0.5) * scale);
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
}

const keyOf = (state: Pick<FreeSideState, 'mode' | 'side' | 'edge'>) => `${state.mode}:${state.side}:${state.edge}`;

/** One step. Nobody in the picture means nothing changes: the panel holds still rather than guessing. */
export function stepFreeSide(state: FreeSideState, box: Box | null, room: StageRoom, now: number): FreeSideState {
  if (!box) return state.wanted ? { ...state, wanted: null } : state;

  const free = { left: box.left, right: room.width - box.right };
  const emptier = free.left >= free.right ? 'left' : 'right';
  const edgeRoom = { top: box.top - room.top, bottom: room.bottom - box.bottom };

  let edge = state.edge;
  const otherEdge = edge === 'top' ? 'bottom' : 'top';
  if (edgeRoom[otherEdge] > edgeRoom[edge] + room.height * EDGE_MARGIN) edge = otherEdge;

  let next: Pick<FreeSideState, 'mode' | 'side' | 'edge'>;
  if (room.stripOnly) {
    next = { mode: 'strip', side: state.side, edge };
  } else if (state.mode === 'side') {
    if (free[state.side] >= room.panelWidth) next = { mode: 'side', side: state.side, edge: state.edge };
    else if (free[emptier] >= room.panelWidth) next = { mode: 'side', side: emptier, edge: state.edge };
    else next = { mode: 'strip', side: state.side, edge };
  } else {
    next = free[emptier] >= room.panelWidth * UNFOLD_ROOM ? { mode: 'side', side: emptier, edge: state.edge } : { mode: 'strip', side: state.side, edge };
  }

  if (keyOf(next) === keyOf(state)) return state.wanted ? { ...state, wanted: null } : state;
  const key = keyOf(next);
  const wanted = state.wanted?.key === key ? state.wanted : { key, since: now };
  if (now - wanted.since < CROWDED_MS || now - state.lastJump < MIN_BETWEEN_JUMPS_MS) {
    return wanted === state.wanted ? state : { ...state, wanted };
  }
  return { ...next, wanted: null, lastJump: now };
}
