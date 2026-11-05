import { act, renderHook, waitFor } from '@testing-library/react';
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

const rpc = vi.fn();
const update = vi.fn();
// What the server holds now: another tab has already added XP since this one computed its stats
const saved = { user_id: 'acct', prestige: 'beginner', total_xp: 5000, total_pushups: 90 };
const auth = vi.hoisted(() => ({ isGuest: false }));
vi.mock('@/contexts/useAuth', () => ({ useAuth: () => ({ user: { id: auth.isGuest ? 'guest' : 'acct' }, isGuest: auth.isGuest }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  rpc: (...args: unknown[]) => rpc(...args),
  from: () => {
    const query = {
      select: () => query, eq: () => query,
      update: (...args: unknown[]) => { update(...args); return query; },
      maybeSingle: () => Promise.resolve({ data: saved, error: null }),
    };
    return query;
  },
} }));

const { useProfile } = await import('@/hooks/useProfile');
const { useUserStore } = await import('@/stores/userStore');

const renderProfile = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useProfile(), { wrapper });
};

beforeEach(() => { auth.isGuest = false; rpc.mockReset(); update.mockReset(); rpc.mockResolvedValue({ data: true, error: null }); });

it('credits only what the session added to the profile it was computed from', async () => {
  const { result } = renderProfile();
  await waitFor(() => expect(result.current.profile.total_xp).toBe(5000));
  const base = { ...result.current.profile, total_xp: 1000, total_pushups: 40 };
  await act(async () => {
    await result.current.creditSession.mutateAsync({ historyId: 'h1', base, update: { total_xp: 1150, total_pushups: 55, current_streak: 3 } });
  });
  expect(rpc).toHaveBeenCalledWith('credit_session_to_profile', {
    history_id: 'h1', totals: { total_xp: 150, total_pushups: 15 }, fields: { current_streak: 3 },
  });
  expect(update).not.toHaveBeenCalled();
});

it('adds XP on the server instead of writing a total from this tab', async () => {
  const { result } = renderProfile();
  await act(async () => { await result.current.addXP.mutateAsync(24.6); });
  expect(rpc).toHaveBeenCalledWith('add_profile_xp', { amount: 25 });
  expect(update).not.toHaveBeenCalled();
});

it("saves a guest's session in this browser, without the server", async () => {
  auth.isGuest = true;
  const { result } = renderProfile();
  await act(async () => {
    await result.current.creditSession.mutateAsync({ historyId: 'h2', base: result.current.profile, update: { total_pushups: 12, current_streak: 1 } });
  });
  expect(rpc).not.toHaveBeenCalled();
  expect(useUserStore.getState().guestProfile).toMatchObject({ total_pushups: 12, current_streak: 1 });
});
