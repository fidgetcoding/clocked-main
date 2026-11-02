import { describe, expect, it } from 'vitest';
import { bodyBox, initialFreeSide, stepFreeSide, type Box, type FreeSideState, type SeenPoint, type StageRoom } from '@/lib/overlay/freeSide';

const LAPTOP: StageRoom = { width: 1280, height: 720, panelWidth: 384, top: 88, bottom: 610, stripOnly: false };
const PHONE: StageRoom = { width: 390, height: 844, panelWidth: 170, top: 120, bottom: 744, stripOnly: true };

const box = (left: number, right: number, top = 120, bottom = 600): Box => ({ left, right, top, bottom });

/** Holds the same picture long enough for the panel to act on it. */
const hold = (state: FreeSideState, seen: Box | null, room: StageRoom, from = 10_000) => {
  let current = state;
  for (let t = from; t <= from + 2000; t += 200) current = stepFreeSide(current, seen, room, t);
  return current;
};

describe('reading the body from what the camera can see', () => {
  const mirrored = (x: number, y: number, visibility = 1): SeenPoint => ({ x, y, visibility });

  it('mirrors the picture, so a fighter on the left of the image is on the right of the screen', () => {
    const seen = bodyBox([mirrored(0.1, 0.2), mirrored(0.2, 0.5), mirrored(0.15, 0.8)], 16 / 9, 1280, 720)!;
    expect(seen.left).toBeGreaterThan(640);
  });

  it('ignores parts it is not sure of, like the arm hidden behind a bag', () => {
    const seen = bodyBox([mirrored(0.5, 0.2), mirrored(0.55, 0.5), mirrored(0.45, 0.7), mirrored(0.95, 0.4, 0.05)], 16 / 9, 1280, 720)!;
    expect(seen.left).toBeGreaterThan(500);
  });

  it('gives up with too little to go on', () => {
    expect(bodyBox([mirrored(0.5, 0.5), mirrored(0.5, 0.2, 0.1)], 16 / 9, 1280, 720)).toBeNull();
  });

  it('crops a 4:3 picture to a wide stage the way the video does', () => {
    const seen = bodyBox([mirrored(0.5, 0), mirrored(0.5, 0.5), mirrored(0.5, 1)], 4 / 3, 1280, 720)!;
    expect(seen.top).toBeLessThan(0);
    expect(seen.bottom).toBeGreaterThan(720);
  });
});

describe('where the panel goes', () => {
  it('stays put while the body leaves it room', () => {
    expect(hold(initialFreeSide(false), box(300, 600), LAPTOP)).toMatchObject({ mode: 'side', side: 'right' });
  });

  it('jumps to the emptier side when the body crowds it', () => {
    expect(hold(initialFreeSide(false), box(700, 1100), LAPTOP)).toMatchObject({ mode: 'side', side: 'left' });
  });

  it('does not move for a punch that passes through its space', () => {
    let state = initialFreeSide(false);
    state = stepFreeSide(state, box(300, 1000), LAPTOP, 10_000);
    state = stepFreeSide(state, box(300, 1000), LAPTOP, 10_200);
    state = stepFreeSide(state, box(300, 600), LAPTOP, 10_400);
    state = hold(state, box(300, 600), LAPTOP, 10_600);
    expect(state).toMatchObject({ mode: 'side', side: 'right' });
  });

  it('folds into a strip when the fighter comes close, above or below whichever is emptier', () => {
    expect(hold(initialFreeSide(false), box(200, 1100, 300, 700), LAPTOP)).toMatchObject({ mode: 'strip', edge: 'top' });
    expect(hold(initialFreeSide(false), box(200, 1100, 90, 300), LAPTOP)).toMatchObject({ mode: 'strip', edge: 'bottom' });
  });

  it('unfolds once there is room again', () => {
    const close = hold(initialFreeSide(false), box(200, 1100), LAPTOP);
    expect(hold(close, box(100, 500), LAPTOP, 20_000)).toMatchObject({ mode: 'side', side: 'right' });
  });

  it('does not flap on the boundary between strip and side', () => {
    const close = hold(initialFreeSide(false), box(200, 1100), LAPTOP);
    expect(hold(close, box(100, 880), LAPTOP, 20_000).mode).toBe('strip');
  });

  it('holds still when nobody can be seen', () => {
    const left = hold(initialFreeSide(false), box(700, 1100), LAPTOP);
    expect(hold(left, null, LAPTOP, 20_000)).toMatchObject({ mode: 'side', side: 'left' });
  });

  it('is always the strip on an upright phone, moving out of the way of the body', () => {
    const state = hold(initialFreeSide(true), box(100, 300, 400, 740), PHONE);
    expect(state).toMatchObject({ mode: 'strip', edge: 'top' });
  });

  const views: [string, Box][] = [
    ['side on: a narrow body', box(560, 700)],
    ['from behind', box(300, 620)],
    ['from low down: legs huge, head small and high', box(250, 640, 100, 720)],
    ['half behind a bag: only one arm and the head', box(100, 320, 100, 300)],
  ];
  for (const [name, seen] of views) {
    it(`leaves the panel clear of the body ${name}`, () => {
      const state = hold(initialFreeSide(false), seen, LAPTOP);
      expect(state.mode).toBe('side');
      const panel = state.side === 'right' ? [1280 - 384, 1280] : [0, 384];
      expect(panel[0] < seen.right && seen.left < panel[1]).toBe(false);
    });
  }
});
