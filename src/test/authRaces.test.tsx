import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthProvider } from '@/contexts/AuthContext';
import { useAuth } from '@/contexts/useAuth';

const api = vi.hoisted(() => ({
  listener: null as null | ((event: string, session: Session | null) => void),
  getSession: vi.fn(), profile: vi.fn(), complete: vi.fn(), signOut: vi.fn(), toast: vi.fn(),
}));
vi.mock('@/hooks/use-toast', () => ({ toast: api.toast }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: {
    getSession: api.getSession, signOut: api.signOut,
    onAuthStateChange: (cb: typeof api.listener) => { api.listener = cb; return { data: { subscription: { unsubscribe: vi.fn() } } }; },
  },
  from: () => ({ select: () => ({ eq: () => ({ single: api.profile }) }) }),
} }));
vi.mock('@/stores/userStore', () => ({ useUserStore: { getState: () => ({ enterAccount: vi.fn(), enterGuest: vi.fn(), clearAccount: vi.fn(), hasCompletedOnboarding: false, completeOnboarding: api.complete }) } }));
vi.mock('@/stores/workoutStore', () => ({ useWorkoutStore: { setState: vi.fn() } }));
vi.mock('@/stores/historyStore', () => ({ useHistoryStore: { setState: vi.fn() } }));
const session = (id: string) => ({ user: { id } }) as Session;
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
function mount() {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><AuthProvider>{children}</AuthProvider></QueryClientProvider>;
  return renderHook(() => useAuth(), { wrapper });
}
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { removeItem: vi.fn() } });
  api.profile.mockResolvedValue({ data: null });
});
it('does not restore an obsolete initial session after a newer sign-out event', async () => {
  const initial = deferred<{ data: { session: Session | null } }>();
  api.getSession.mockReturnValue(initial.promise);
  const { result } = mount();
  await act(async () => { api.listener!('SIGNED_OUT', null); });
  await act(async () => { initial.resolve({ data: { session: session('old') } }); });
  expect(result.current.user).toBeNull();
  expect(result.current.isGuest).toBe(true);
});
it('does not apply a late account profile after signing out', async () => {
  api.getSession.mockResolvedValue({ data: { session: null } });
  const profile = deferred<{ data: { name: string } }>();
  api.profile.mockReturnValue(profile.promise);
  const { result } = mount();
  await act(async () => {});
  await act(async () => { api.listener!('SIGNED_IN', session('old')); });
  await act(async () => { api.listener!('SIGNED_OUT', null); });
  await act(async () => { profile.resolve({ data: { name: 'Old account' } }); });
  expect(result.current.isGuest).toBe(true);
  expect(api.complete).not.toHaveBeenCalled();
});
it('reports a failed sign-out without pretending the account is signed out', async () => {
  api.getSession.mockResolvedValue({ data: { session: session('current') } });
  const error = new Error('Network unavailable');
  api.signOut.mockResolvedValue({ error });
  const { result } = mount();
  await act(async () => {});
  await act(async () => {
    await expect(result.current.signOut()).rejects.toThrow('Network unavailable');
  });
  expect(result.current.user?.id).toBe('current');
});
it('only applies the current account profile when account responses arrive in reverse order', async () => {
  api.getSession.mockResolvedValue({ data: { session: null } });
  const old = deferred<{ data: { name: string } }>();
  const current = deferred<{ data: { name: string } }>();
  api.profile.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  const { result } = mount();
  await act(async () => {});
  await act(async () => { api.listener!('SIGNED_IN', session('old')); });
  await act(async () => { api.listener!('SIGNED_IN', session('current')); });
  await act(async () => { current.resolve({ data: { name: 'Current' } }); });
  await act(async () => { old.resolve({ data: { name: 'Old' } }); });
  expect(result.current.user?.id).toBe('current');
  expect(api.complete).toHaveBeenCalledTimes(1);
  expect(api.complete).toHaveBeenCalledWith(expect.objectContaining({ name: 'Current' }));
});
it('synchronizes INITIAL_SESSION even if the initial session request has not finished', async () => {
  api.getSession.mockReturnValue(new Promise(() => {}));
  api.profile.mockResolvedValue({ data: { name: 'Restored' } });
  const { result } = mount();
  await act(async () => { api.listener!('INITIAL_SESSION', session('restored')); });
  expect(result.current.user?.id).toBe('restored');
  expect(result.current.loading).toBe(false);
  expect(api.complete).toHaveBeenCalledWith(expect.objectContaining({ name: 'Restored' }));
});
it('ignores profile results after the provider unmounts', async () => {
  api.getSession.mockResolvedValue({ data: { session: session('old') } });
  const profile = deferred<{ data: { name: string } }>();
  api.profile.mockReturnValue(profile.promise);
  const { unmount } = mount();
  await act(async () => {});
  unmount();
  await act(async () => { profile.resolve({ data: { name: 'Old' } }); });
  expect(api.complete).not.toHaveBeenCalled();
});
it('does not erase a new sign-in when an earlier sign-out finishes late', async () => {
  api.getSession.mockResolvedValue({ data: { session: session('old') } });
  const signedOut = deferred<{ error: null }>();
  api.signOut.mockReturnValue(signedOut.promise);
  const { result } = mount();
  await act(async () => {});
  let pending!: Promise<void>;
  await act(async () => { pending = result.current.signOut(); });
  await act(async () => { api.listener!('SIGNED_OUT', null); });
  await act(async () => { api.listener!('SIGNED_IN', session('new')); });
  await act(async () => { signedOut.resolve({ error: null }); await pending; });
  expect(result.current.user?.id).toBe('new');
});

it('finishes loading and explains guest mode if the initial session request rejects', async () => {
  api.getSession.mockRejectedValue(new Error('Session storage unavailable'));
  const { result } = mount();
  await act(async () => {});
  expect(result.current.loading).toBe(false);
  expect(result.current.isGuest).toBe(true);
  expect(api.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Couldn't restore your sign-in" }));
});

it('does not replace a newer sign-in when the initial request fails late', async () => {
  let reject!: (error: Error) => void;
  api.getSession.mockReturnValue(new Promise((_resolve, fail) => { reject = fail; }));
  const { result } = mount();
  await act(async () => { api.listener!('SIGNED_IN', session('new')); });
  await act(async () => { reject(new Error('Old failure')); });
  expect(result.current.user?.id).toBe('new');
  expect(api.toast).not.toHaveBeenCalled();
});
