import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// The stores capture localStorage when they're created, so it has to exist before the imports run
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

const profileApi = vi.hoisted(() => ({ updateProfile: vi.fn(), addXP: vi.fn() }));

vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({
    profile: { user_id: 'guest', last_workout_date: null, current_streak: 0, longest_streak: 0, workouts_completed: 0 },
    addXP: { mutate: profileApi.addXP },
    updateProfile: { mutate: profileApi.updateProfile },
  }),
}));

// Logging goes straight into the guest history, the way it does for a guest
vi.mock('@/hooks/useWorkoutHistory', async () => {
  const { useHistoryStore } = await import('@/stores/historyStore');
  return {
    useWorkoutHistory: () => ({
      addHistoryEntry: {
        mutate: (entry: Parameters<ReturnType<typeof useHistoryStore.getState>['addGuestEntry']>[0], options?: { onSuccess?: () => void }) => {
          useHistoryStore.getState().addGuestEntry(entry);
          options?.onSuccess?.();
        },
      },
    }),
  };
});

vi.mock('@/hooks/useDictation', () => ({ useDictation: () => ({ supported: false, listening: false, start: vi.fn(), stop: vi.fn(), toggle: vi.fn() }) }));

import { AddWorkoutModal } from '@/components/AddWorkoutModal';
import { countWorkoutTotals } from '@/lib/workoutTracking';
import { useHistoryStore } from '@/stores/historyStore';

describe('a hand-logged workout', () => {
  beforeEach(() => {
    useHistoryStore.setState({ guestHistory: [] });
    profileApi.updateProfile.mockClear();
  });

  it('counts toward the Workouts total', async () => {
    render(<AddWorkoutModal isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Log Workout/ }));
    await waitFor(() => expect(profileApi.updateProfile).toHaveBeenCalled());
    expect(profileApi.updateProfile).toHaveBeenCalledWith({ workouts_completed: 1, total_training_seconds: 30 * 60 });
    // A past workout leaves the streak alone
    expect(profileApi.updateProfile.mock.calls[0][0]).not.toHaveProperty('current_streak');
  });

  it('is counted from the history like every other session', async () => {
    const entry = { workout_id: null, workout_name: 'Bag work', completed_at: new Date().toISOString(), xp_earned: 0, difficulty: null, notes: null, round_feedback: [] };
    useHistoryStore.getState().addGuestEntry({ ...entry, duration: 1800, is_manual_entry: true });
    useHistoryStore.getState().addGuestEntry({ ...entry, duration: 1200, is_manual_entry: false });
    // Under the five minutes every session needs to count
    useHistoryStore.getState().addGuestEntry({ ...entry, duration: 60, is_manual_entry: true });
    expect(await countWorkoutTotals('guest', { user_id: 'guest' })).toEqual({ workouts_completed: 2, total_training_seconds: 3060 });
  });
});
