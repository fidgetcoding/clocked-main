import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

vi.hoisted(() => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) },
  });
});

const who = vi.hoisted(() => ({ user: null as { id: string } | null, isGuest: true, profile: { experience_level: 'beginner', equipment: {} } as object }));
const rpc = vi.fn();
vi.mock('@/contexts/useAuth', () => ({ useAuth: () => ({ user: who.user, isGuest: who.isGuest }) }));
vi.mock('@/hooks/useProfile', () => ({ useProfile: () => ({ profile: who.profile }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

const { usePresetSeeding } = await import('@/hooks/usePresetSeeding');
const { useUserStore } = await import('@/stores/userStore');
const { useWorkoutStore } = await import('@/stores/workoutStore');

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);
const signIn = (id: string) => { who.user = { id }; who.isGuest = false; who.profile = { ...who.profile }; };
const seedCalls = () => rpc.mock.calls.filter(([name]) => name === 'seed_first_workout');

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: true, error: null });
  who.user = null; who.isGuest = true; who.profile = { experience_level: 'beginner', equipment: {} };
  useUserStore.setState({ hasCompletedOnboarding: true });
  useWorkoutStore.setState({ guestWorkouts: [] });
});

it('seeds the account a guest signs into, after seeding the guest', async () => {
  const { rerender } = renderHook(() => usePresetSeeding(), { wrapper });
  expect(useWorkoutStore.getState().guestWorkouts).toHaveLength(1);
  signIn('account-a');
  await act(async () => { rerender(); });
  expect(seedCalls()).toHaveLength(1);
});

it('seeds once per account, even when the profile refreshes mid-seed, and again for a new account', async () => {
  let finish: (value: unknown) => void = () => {};
  rpc.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  signIn('account-a');
  const { rerender } = renderHook(() => usePresetSeeding(), { wrapper });
  who.profile = { ...who.profile };
  await act(async () => { rerender(); });
  await act(async () => { finish({ data: true, error: null }); });
  expect(seedCalls()).toHaveLength(1);
  signIn('account-b');
  await act(async () => { rerender(); });
  expect(seedCalls()).toHaveLength(2);
});

it('tries again after a failed seed', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  rpc.mockResolvedValueOnce({ data: null, error: new Error('offline') });
  signIn('account-a');
  const { rerender } = renderHook(() => usePresetSeeding(), { wrapper });
  await act(async () => {});
  who.profile = { ...who.profile };
  await act(async () => { rerender(); });
  expect(seedCalls()).toHaveLength(2);
});
