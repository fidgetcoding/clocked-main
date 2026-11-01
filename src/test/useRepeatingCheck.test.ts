import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRepeatingCheck } from '@/hooks/useRepeatingCheck';

describe('useRepeatingCheck', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps its beat and reads the newest value when a clock re-renders it every second', () => {
    const seen: number[] = [];
    const { rerender } = renderHook(
      ({ elapsed }) => useRepeatingCheck(() => seen.push(elapsed), 5000, true),
      { initialProps: { elapsed: 0 } },
    );

    for (let elapsed = 1; elapsed <= 10; elapsed++) {
      vi.advanceTimersByTime(1000);
      rerender({ elapsed });
    }

    // The tick at each 5 seconds lands before that second's render, so it reads the second before
    expect(seen).toEqual([4, 9]);
  });

  it('does nothing while inactive, and stops when it goes inactive or unmounts', () => {
    const check = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ active }) => useRepeatingCheck(check, 5000, active),
      { initialProps: { active: false } },
    );

    vi.advanceTimersByTime(20_000);
    expect(check).not.toHaveBeenCalled();

    rerender({ active: true });
    vi.advanceTimersByTime(5000);
    expect(check).toHaveBeenCalledTimes(1);

    rerender({ active: false });
    vi.advanceTimersByTime(20_000);
    expect(check).toHaveBeenCalledTimes(1);

    rerender({ active: true });
    unmount();
    vi.advanceTimersByTime(20_000);
    expect(check).toHaveBeenCalledTimes(1);
  });
});
