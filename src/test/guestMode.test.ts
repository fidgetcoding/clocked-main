import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  functions: { invoke: vi.fn() },
  storage: { from: vi.fn() },
  auth: {
    getSession: vi.fn(async () => ({ data: { session: null } })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signOut: vi.fn(async () => ({ error: null })),
  },
}));

vi.mock('@/integrations/supabase/client', () => ({ supabase: supabaseMock }));

import { AuthProvider } from '@/contexts/AuthContext';
import { useUserStore } from '@/stores/userStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useHistoryStore } from '@/stores/historyStore';
import { useWorkouts } from '@/hooks/useWorkouts';
import { useWorkoutHistory } from '@/hooks/useWorkoutHistory';
import { buildGuestProfile, hasFinishedOnboarding, useProfile } from '@/hooks/useProfile';
import { useBadges } from '@/hooks/useBadges';
import { useGloves } from '@/hooks/useGloves';
import { useCustomExercises } from '@/hooks/useCustomExercises';
import { computePostLogStats } from '@/lib/workoutTracking';
import { GUEST_USER_ID } from '@/lib/guest';

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(
    QueryClientProvider,
    { client: new QueryClient() },
    createElement(AuthProvider, null, children)
  );

const workoutInput = {
  name: 'Bag Work',
  description: null,
  duration: 600,
  difficulty: 'beginner',
  phases: [{ _meta: true, megasetRepeats: 2 }],
  combos: [],
  tags: [],
  is_preset: false,
  is_archived: false,
  times_completed: 0,
  last_used_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  useUserStore.setState({
    user: null,
    hasCompletedOnboarding: false,
    userIsGuest: false,
    stashedGuest: null,
    guestProfile: null,
    guestBadges: [],
  });
  useWorkoutStore.setState({ guestWorkouts: [], guestExercises: [] });
  useHistoryStore.setState({ guestHistory: [] });
});

describe('guest hooks', () => {
  it('saves, edits, archives and reorders workouts in the browser', async () => {
    const { result } = renderHook(() => useWorkouts(), { wrapper });
    await waitFor(() => expect(useUserStore.getState().userIsGuest).toBe(true));

    let first: any;
    let second: any;
    await act(async () => {
      first = await result.current.addWorkout.mutateAsync(workoutInput);
      second = await result.current.addWorkout.mutateAsync({ ...workoutInput, name: 'Roadwork' });
    });
    await waitFor(() => expect(result.current.workouts.map((w) => w.name)).toEqual(['Bag Work', 'Roadwork']));
    expect(first.phases).toEqual(workoutInput.phases);

    await act(async () => {
      await result.current.reorderWorkouts.mutateAsync([second.id, first.id]);
    });
    await waitFor(() => expect(result.current.workouts[0].id).toBe(second.id));

    await act(async () => {
      await result.current.updateWorkout.mutateAsync({ id: first.id, times_completed: 3 });
      await result.current.archiveWorkout.mutateAsync(second.id);
    });
    await waitFor(() => expect(result.current.workouts.map((w) => w.id)).toEqual([first.id]));
    expect(result.current.workouts[0].times_completed).toBe(3);
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('logs history and derives post-session totals without touching the database', async () => {
    const { result } = renderHook(() => useWorkoutHistory(), { wrapper });
    await waitFor(() => expect(useUserStore.getState().userIsGuest).toBe(true));

    await act(async () => {
      await result.current.addHistoryEntry.mutateAsync({
        workout_id: null,
        workout_name: 'Quick Session',
        completed_at: new Date().toISOString(),
        duration: 120,
        xp_earned: 30,
        difficulty: null,
        notes: null,
        is_manual_entry: false,
        round_feedback: [],
      });
    });
    await waitFor(() => expect(result.current.history).toHaveLength(1));

    const stats = await computePostLogStats('local-id', buildGuestProfile(null));
    expect(stats).toMatchObject({ workouts_completed: 1, total_training_seconds: 120, current_streak: 1 });
    expect(supabaseMock.from).not.toHaveBeenCalled();
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('keeps XP, gloves, badges and custom exercises on the device', async () => {
    const { result } = renderHook(
      () => ({ profile: useProfile(), gloves: useGloves(), badges: useBadges(), exercises: useCustomExercises() }),
      { wrapper }
    );
    await waitFor(() => expect(useUserStore.getState().userIsGuest).toBe(true));
    await waitFor(() => expect(result.current.profile.profile?.user_id).toBe(GUEST_USER_ID));

    await act(async () => {
      await result.current.profile.updateProfile.mutateAsync({ name: 'Rocky', experience_level: 'pro', prestige: 'pro' });
      await result.current.profile.addXP.mutateAsync(50);
      await result.current.profile.addXP.mutateAsync(50);
      await result.current.gloves.equipGlove.mutateAsync('golden');
      await result.current.badges.awardBadges.mutateAsync([{ id: 'b1', xpReward: 10 } as any]);
      await result.current.badges.awardBadges.mutateAsync([{ id: 'b1', xpReward: 10 } as any]);
      await result.current.exercises.addExercise.mutateAsync({ name: 'Burpees' });
      await result.current.exercises.addExercise.mutateAsync({ name: 'burpees' });
    });

    await waitFor(() => expect(result.current.profile.profile?.total_xp).toBe(100));
    expect(result.current.profile.profile?.name).toBe('Rocky');
    expect(result.current.gloves.equippedGlove).toBe('golden');
    expect(result.current.badges.earnedCount).toBe(1);
    expect(result.current.exercises.exercises).toHaveLength(1);
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });
});

describe('guest and account separation', () => {
  it('does not wipe a guest on a stale-session SIGNED_OUT during an anonymous load', async () => {
    useUserStore.getState().enterGuest();
    useUserStore.getState().completeOnboarding({ name: 'Rocky' });
    useUserStore.getState().updateGuestProfile({ total_xp: 40 });
    useWorkoutStore.getState().addGuestWorkout(workoutInput);

    renderHook(() => useProfile(), { wrapper });
    const calls = supabaseMock.auth.onAuthStateChange.mock.calls as unknown as [[(event: string, session: null) => void]];
    const listener = calls[0][0];
    act(() => listener('SIGNED_OUT', null));

    const state = useUserStore.getState();
    expect(state.user?.name).toBe('Rocky');
    expect(state.hasCompletedOnboarding).toBe(true);
    expect(state.guestProfile?.total_xp).toBe(40);
    expect(useWorkoutStore.getState().guestWorkouts).toHaveLength(1);
  });

  it('sets the guest aside on sign-in and clears only account data on sign-out', () => {
    const store = useUserStore.getState();
    store.enterGuest();
    store.completeOnboarding({ name: 'Rocky' });

    store.enterAccount();
    expect(useUserStore.getState().user).toBeNull();
    expect(useUserStore.getState().hasCompletedOnboarding).toBe(false);

    store.completeOnboarding({ name: 'Account Name' });
    store.clearAccount();
    expect(useUserStore.getState().user).toBeNull();

    store.enterGuest();
    expect(useUserStore.getState().user?.name).toBe('Rocky');
    expect(useUserStore.getState().hasCompletedOnboarding).toBe(true);
  });
});

describe('hasFinishedOnboarding', () => {
  it('treats a bare trigger-created profile as new and a used one as returning', () => {
    expect(hasFinishedOnboarding(buildGuestProfile(null))).toBe(false);
    expect(hasFinishedOnboarding(buildGuestProfile({ equipment: { primaryBag: 'none' } }))).toBe(true);
    expect(hasFinishedOnboarding(buildGuestProfile({ total_xp: 10 }))).toBe(true);
  });
});
