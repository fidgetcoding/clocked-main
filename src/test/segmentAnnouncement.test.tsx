import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useSegmentAnnouncement } from '@/hooks/useSegmentAnnouncement';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('announces the first segment when preparation ends, exactly once', () => {
  const previousIndex = { current: -1 };
  const announce = vi.fn(() => undefined);
  const { rerender } = renderHook(({ active }) => useSegmentAnnouncement({ index: 0, active, voiceOn: true, comboOn: true, previousIndex, announce }), { initialProps: { active: false } });
  expect(announce).not.toHaveBeenCalled();
  rerender({ active: true });
  expect(announce).toHaveBeenCalledTimes(1);
  rerender({ active: true });
  expect(announce).toHaveBeenCalledTimes(1);
});

it('cancels a pending combo on pause and does not replay the segment on resume', () => {
  const previousIndex = { current: -1 };
  const combo = vi.fn();
  const announce = vi.fn(() => {
    const timer = setTimeout(combo, 1200);
    return () => clearTimeout(timer);
  });
  const { rerender } = renderHook(({ active }) => useSegmentAnnouncement({ index: 0, active, voiceOn: true, comboOn: true, previousIndex, announce }), { initialProps: { active: true } });
  act(() => vi.advanceTimersByTime(500));
  rerender({ active: false });
  act(() => vi.advanceTimersByTime(1200));
  expect(combo).not.toHaveBeenCalled();
  rerender({ active: true });
  expect(announce).toHaveBeenCalledTimes(1);
});

it.each(['mute', 'combo off', 'unmount', 'skip'] as const)('cancels obsolete combos on %s', (change) => {
  const previousIndex = { current: -1 };
  const combo = vi.fn();
  const initialProps = { index: 0, active: true, voiceOn: true, comboOn: true };
  const { rerender, unmount } = renderHook((props) => useSegmentAnnouncement({
    ...props, previousIndex,
    announce: () => {
      const timer = setTimeout(() => combo(props.index), 1200);
      return () => clearTimeout(timer);
    },
  }), { initialProps });
  act(() => vi.advanceTimersByTime(500));
  if (change === 'unmount') unmount();
  else rerender({ ...initialProps, voiceOn: change !== 'mute', comboOn: change !== 'combo off', index: change === 'skip' ? 1 : 0 });
  act(() => vi.advanceTimersByTime(1200));
  expect(combo.mock.calls).toEqual(change === 'skip' ? [[1]] : []);
});

it('keeps a pending combo through ordinary renders and uses the next segment callback', () => {
  const previousIndex = { current: -1 };
  const combo = vi.fn();
  const announce = vi.fn();
  const { rerender } = renderHook(({ index, label }) => useSegmentAnnouncement({
    index, active: true, voiceOn: true, comboOn: true, previousIndex,
    announce: () => {
      announce(label);
      const timer = setTimeout(() => combo(label), 1200);
      return () => clearTimeout(timer);
    },
  }), { initialProps: { index: 0, label: 'first' } });
  act(() => vi.advanceTimersByTime(600));
  rerender({ index: 0, label: 'render' });
  act(() => vi.advanceTimersByTime(600));
  expect(combo.mock.calls).toEqual([['first']]);
  rerender({ index: 1, label: 'next' });
  act(() => vi.advanceTimersByTime(1200));
  expect(combo.mock.calls).toEqual([['first'], ['next']]);
  expect(announce.mock.calls).toEqual([['first'], ['next']]);
});

it('does not replay a recovered segment or a segment that started muted', () => {
  const previousIndex = { current: 3 };
  const announce = vi.fn(() => undefined);
  const { rerender } = renderHook(({ index, voiceOn }) => useSegmentAnnouncement({ index, active: true, voiceOn, comboOn: true, previousIndex, announce }), { initialProps: { index: 3, voiceOn: true } });
  expect(announce).not.toHaveBeenCalled();
  rerender({ index: 4, voiceOn: false });
  rerender({ index: 4, voiceOn: true });
  expect(announce).not.toHaveBeenCalled();
  rerender({ index: 5, voiceOn: true });
  expect(announce).toHaveBeenCalledTimes(1);
});
