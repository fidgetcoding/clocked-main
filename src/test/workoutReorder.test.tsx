import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { useWorkouts } from '@/hooks/useWorkouts';

vi.mock('@/contexts/useAuth', () => ({ useAuth: () => ({ user: { id: 'account' }, isGuest: false }) }));
vi.mock('@/stores/workoutStore', () => ({ useWorkoutStore: (select: (s: { guestWorkouts: never[] }) => unknown) => select({ guestWorkouts: [] }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => {
  const query = {
    select: () => query, eq: () => query, order: () => Promise.resolve({ data: [], error: null }),
    update: () => query,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: new Error('Write denied') }).then(resolve),
  };
  return query;
} } }));

it('reports a failed reorder instead of calling it a successful save', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result, unmount } = renderHook(() => useWorkouts(), { wrapper });
  await act(async () => {
    await expect(result.current.reorderWorkouts.mutateAsync(['first', 'second'])).rejects.toThrow('Write denied');
  });
  unmount();
  client.clear();
});
