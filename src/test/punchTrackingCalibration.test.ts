import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePunchTracking } from '@/hooks/usePunchTracking';
import type { PoseResult } from '@/lib/punch/poseModel';
import { simulate } from './punchSynth';

// The prefs store captures localStorage when it's created, so it has to exist before the imports run
vi.hoisted(() => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    },
  });
});

// The camera is replaced by a hand that feeds poses straight to the tracker
const camera = vi.hoisted(() => ({ onPose: null as null | ((result: PoseResult, t: number, luma: number | null) => void) }));

vi.mock('@/hooks/usePunchCamera', () => ({
  usePunchCamera: ({ onPose }: { onPose: (result: PoseResult, t: number, luma: number | null) => void }) => {
    camera.onPose = onPose;
    return { status: 'live', problem: null, statsRef: { current: { fps: 30, inferenceMs: 5, delegate: 'GPU', frames: 0 } }, start: vi.fn(async () => undefined), stop: vi.fn() };
  },
}));

function feed(frames: ReturnType<typeof simulate>) {
  act(() => {
    for (const frame of frames) camera.onPose!({ image: frame.landmarks, world: frame.landmarks } as PoseResult, frame.t, null);
  });
}

describe('calibration in the tracker', () => {
  beforeEach(() => {
    camera.onPose = null;
  });

  it('runs before the session, and the punches thrown for it are never counted', () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => usePunchTracking({ stance: 'orthodox', counting: false, onEvent }));
    act(() => void result.current.start());
    expect(result.current.calibration?.phase).toBe('choose');

    act(() => result.current.calibrationActions.begin());
    act(() => result.current.calibrationActions.skipStep());
    expect(result.current.calibration?.phase).toBe('guard');
    feed(simulate({ durationMs: 6000 }));
    expect(result.current.calibration?.phase).toBe('punches');
    expect(result.current.calibration?.result?.gaveUp).toBe(false);

    feed(simulate({ startMs: 6100, durationMs: 4000, punches: [{ hand: 'lead', shape: 'straight', at: 7000 }] }));
    const steps = result.current.calibration!.steps;
    expect(steps[0].status).toBe('seen');
    expect(result.current.calibration?.stepIndex).toBe(1);
    expect(onEvent).not.toHaveBeenCalled();
    expect(result.current.getSummary().total).toBe(0);
  });

  it('skips what is left of calibration once the session starts counting', () => {
    const { result, rerender } = renderHook(({ counting }) => usePunchTracking({ stance: 'orthodox', counting }), { initialProps: { counting: false } });
    act(() => void result.current.start());
    act(() => result.current.calibrationActions.begin());
    rerender({ counting: true });
    expect(result.current.calibration?.phase).toBe('done');
    expect(result.current.calibration?.skipped).toBe(true);
  });

  it('goes without calibration when the camera comes on mid-session', () => {
    const { result } = renderHook(() => usePunchTracking({ stance: 'orthodox', counting: true }));
    act(() => void result.current.start());
    expect(result.current.calibration?.phase).toBe('done');
  });

  it('carries on where it was when the camera comes back, and starts over after a reset', () => {
    const { result } = renderHook(() => usePunchTracking({ stance: 'orthodox', counting: false }));
    act(() => void result.current.start());
    act(() => result.current.calibrationActions.begin());
    act(() => void result.current.start());
    expect(result.current.calibration?.phase).toBe('setup');
    act(() => result.current.reset());
    expect(result.current.calibration).toBeNull();
    act(() => void result.current.start());
    expect(result.current.calibration?.phase).toBe('choose');
  });

  it('has no calibration in recording mode', () => {
    const { result } = renderHook(() => usePunchTracking({ stance: 'orthodox', calibrate: false }));
    act(() => void result.current.start());
    expect(result.current.calibration).toBeNull();
  });
});
