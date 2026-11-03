import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTimesCompleted } from '@/hooks/useTimesCompleted';

const workout = { id: 'w1', times_completed: 4 };

describe('times_completed', () => {
  it('goes up when a run reaches the end', () => {
    const update = vi.fn();
    const { result } = renderHook(() => useTimesCompleted(workout, update));
    result.current.ranToEnd();
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toMatchObject({ id: 'w1', times_completed: 5 });
  });

  it('does not go up for a run left early without saving', () => {
    const update = vi.fn();
    renderHook(() => useTimesCompleted(workout, update));
    // Leave Without Saving calls neither
    expect(update).not.toHaveBeenCalled();
  });

  it('goes up once when a run left early is saved with End & Save', () => {
    const update = vi.fn();
    const { result } = renderHook(() => useTimesCompleted(workout, update));
    result.current.saved();
    result.current.saved();
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toMatchObject({ times_completed: 5 });
  });

  it('counts a full run that is then saved only once', () => {
    const update = vi.fn();
    const { result } = renderHook(() => useTimesCompleted(workout, update));
    result.current.ranToEnd();
    result.current.saved();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('counts again after a restart', () => {
    const update = vi.fn();
    const { result } = renderHook(() => useTimesCompleted(workout, update));
    result.current.ranToEnd();
    result.current.reset();
    result.current.ranToEnd();
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('has nothing to count for a workout that is not saved as a set', () => {
    const update = vi.fn();
    const { result } = renderHook(() => useTimesCompleted(undefined, update));
    result.current.saved();
    expect(update).not.toHaveBeenCalled();
  });
});
