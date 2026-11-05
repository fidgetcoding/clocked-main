import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTimesCompleted } from '@/hooks/useTimesCompleted';

const workout = { id: 'w1' };
const saving = () => vi.fn().mockResolvedValue(undefined);

describe('times_completed', () => {
  it('goes up when a run reaches the end', async () => {
    const countRun = saving();
    const { result } = renderHook(() => useTimesCompleted(workout, countRun));
    await act(() => result.current.ranToEnd());
    expect(countRun).toHaveBeenCalledTimes(1);
    expect(countRun).toHaveBeenCalledWith('w1');
  });

  it('does not go up for a run left early without saving', () => {
    const countRun = saving();
    renderHook(() => useTimesCompleted(workout, countRun));
    // Leave Without Saving calls neither
    expect(countRun).not.toHaveBeenCalled();
  });

  it('goes up once when a run left early is saved with End & Save', async () => {
    const countRun = saving();
    const { result } = renderHook(() => useTimesCompleted(workout, countRun));
    await act(() => result.current.saved());
    await act(() => result.current.saved());
    expect(countRun).toHaveBeenCalledTimes(1);
  });

  it('counts a full run that is then saved only once', async () => {
    const countRun = saving();
    const { result } = renderHook(() => useTimesCompleted(workout, countRun));
    await act(() => result.current.ranToEnd());
    await act(() => result.current.saved());
    expect(countRun).toHaveBeenCalledTimes(1);
  });

  it('counts once even when the end and the save land together', async () => {
    const countRun = saving();
    const { result } = renderHook(() => useTimesCompleted(workout, countRun));
    await act(() => Promise.all([result.current.ranToEnd(), result.current.saved()]));
    expect(countRun).toHaveBeenCalledTimes(1);
  });

  it('tries again on save when counting at the end failed', async () => {
    const countRun = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useTimesCompleted(workout, countRun));
    await act(() => result.current.ranToEnd());
    await act(() => result.current.saved());
    await act(() => result.current.saved());
    expect(countRun).toHaveBeenCalledTimes(2);
  });

  it('counts again after a restart', async () => {
    const countRun = saving();
    const { result } = renderHook(() => useTimesCompleted(workout, countRun));
    await act(() => result.current.ranToEnd());
    act(() => result.current.reset());
    await act(() => result.current.ranToEnd());
    expect(countRun).toHaveBeenCalledTimes(2);
  });

  it('has nothing to count for a workout that is not saved as a set', async () => {
    const countRun = saving();
    const { result } = renderHook(() => useTimesCompleted(undefined, countRun));
    await act(() => result.current.saved());
    expect(countRun).not.toHaveBeenCalled();
  });
});
