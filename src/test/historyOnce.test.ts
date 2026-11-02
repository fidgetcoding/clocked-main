import { beforeEach, describe, expect, it, vi } from 'vitest';

// The store keeps itself in localStorage, which this test environment doesn't have
const memory = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
});

const { useHistoryStore } = await import('@/stores/historyStore');

const entry = {
  workout_id: null,
  workout_name: 'Quick Session',
  completed_at: '2026-11-02T10:00:00.000Z',
  duration: 300,
  xp_earned: 50,
  difficulty: null,
  notes: null,
  is_manual_entry: false,
  round_feedback: [],
};

describe("a guest's run logged twice", () => {
  beforeEach(() => useHistoryStore.setState({ guestHistory: [] }));

  it('keeps one row when the same run is logged again', () => {
    const first = useHistoryStore.getState().addGuestEntry({ ...entry, id: 'run-1' });
    const again = useHistoryStore.getState().addGuestEntry({ ...entry, id: 'run-1' });
    expect(again).toEqual(first);
    expect(useHistoryStore.getState().guestHistory).toHaveLength(1);
  });

  it('still adds runs without an id as new rows', () => {
    useHistoryStore.getState().addGuestEntry(entry);
    useHistoryStore.getState().addGuestEntry(entry);
    expect(useHistoryStore.getState().guestHistory).toHaveLength(2);
  });
});
