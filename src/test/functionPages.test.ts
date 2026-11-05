import { describe, expect, it, vi } from 'vitest';
import { PAGE_SIZE, readAllPages } from '../../supabase/functions/_shared/pages';

const rowsFrom = (total: number) => (index: number, from: number, to: number) =>
  Promise.resolve({ rows: Array.from({ length: Math.max(0, Math.min(to, total - 1) - from + 1) }, (_, at) => from + at), error: null });

describe('reading every page', () => {
  it('keeps reading past the first 1,000 rows', async () => {
    const all = await readAllPages(rowsFrom(2500));
    expect(all).toHaveLength(2500);
    expect(all[2499]).toBe(2499);
  });

  it('asks once more after an exactly full last page, and stops at the empty one', async () => {
    const fetchPage = vi.fn(rowsFrom(PAGE_SIZE * 2));
    expect(await readAllPages(fetchPage)).toHaveLength(PAGE_SIZE * 2);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage.mock.calls.map(([index, from, to]) => [index, from, to])).toEqual([[0, 0, 999], [1, 1000, 1999], [2, 2000, 2999]]);
  });

  it('fails on a failed page instead of returning a shorter list', async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce({ rows: Array(PAGE_SIZE).fill(1), error: null })
      .mockResolvedValueOnce({ rows: null, error: { message: 'timeout' } });
    await expect(readAllPages(fetchPage)).rejects.toThrow('timeout');
  });

  it('gives up instead of looping forever on a server that keeps sending full pages', async () => {
    await expect(readAllPages(() => Promise.resolve({ rows: Array(PAGE_SIZE).fill(0), error: null }))).rejects.toThrow('Stopped after');
  });
});
