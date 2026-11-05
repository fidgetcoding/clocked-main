import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { useWorkouts } from '@/hooks/useWorkouts';

const rpc = vi.fn();
const update = vi.fn();
vi.mock('@/contexts/useAuth', () => ({ useAuth: () => ({ user: { id: 'account' }, isGuest: false }) }));
vi.mock('@/stores/workoutStore', () => ({ useWorkoutStore: (select: (s: { guestWorkouts: never[] }) => unknown) => select({ guestWorkouts: [] }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  rpc: (...args: unknown[]) => rpc(...args),
  from: () => {
    const query = { select: () => query, eq: () => query, update: (...args: unknown[]) => { update(...args); return query; }, order: () => Promise.resolve({ data: [], error: null }) };
    return query;
  },
} }));

beforeEach(() => { rpc.mockReset(); update.mockReset(); });

const reorder = async (ids: string[]) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result, unmount } = renderHook(() => useWorkouts(), { wrapper });
  try {
    await act(async () => { await result.current.reorderWorkouts.mutateAsync(ids); });
  } finally {
    unmount();
    client.clear();
  }
};

it('saves the whole new order in one server call, not one write per workout', async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  await reorder(['first', 'second', 'third']);
  expect(rpc).toHaveBeenCalledWith('reorder_workouts', { ordered_ids: ['first', 'second', 'third'] });
  expect(update).not.toHaveBeenCalled();
});

it('reports a failed reorder instead of calling it a successful save', async () => {
  rpc.mockResolvedValue({ data: null, error: new Error('Write denied') });
  await expect(reorder(['first', 'second'])).rejects.toThrow('Write denied');
});
