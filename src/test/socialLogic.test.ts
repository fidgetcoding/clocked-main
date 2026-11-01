import { describe, expect, it } from 'vitest';
import { generateLoadoutWorkout } from '@/lib/loadoutGenerator';
import { memberLabel, rankClubMembers, splitClubs } from '@/lib/clubs';
import { functionErrorMessage } from '@/lib/functionError';
import { formatRating } from '@/lib/ratings';
import { isUuid } from '@/lib/uuid';

const club = (id: string, fields: Partial<{ type: 'public' | 'private'; member_cap: number | null }> = {}) => ({
  id,
  name: id,
  icon: '🥊',
  type: 'public' as const,
  member_cap: 10,
  ...fields,
});

describe('splitClubs', () => {
  it('separates yours from the ones you could join, with real counts', () => {
    const { mine, discover } = splitClubs([club('a'), club('b')], ['a'], { a: 3, b: 7 });
    expect(mine.map((c) => [c.id, c.memberCount, c.spotsRemaining])).toEqual([['a', 3, 7]]);
    expect(discover.map((c) => [c.id, c.memberCount, c.spotsRemaining])).toEqual([['b', 7, 3]]);
  });

  it('never offers a private club to join, but keeps one you belong to', () => {
    const clubs = [club('secret', { type: 'private' }), club('mine', { type: 'private' })];
    const { mine, discover } = splitClubs(clubs, ['mine'], {});
    expect(discover).toEqual([]);
    expect(mine.map((c) => c.id)).toEqual(['mine']);
  });

  it('knows full from uncapped', () => {
    const { discover } = splitClubs([club('full', { member_cap: 2 }), club('open', { member_cap: null })], [], { full: 2, open: 500 });
    expect(discover.map((c) => [c.id, c.isFull, c.spotsRemaining])).toEqual([['full', true, 0], ['open', false, null]]);
  });

  it('counts a club with no members as empty, not missing', () => {
    expect(splitClubs([club('new')], [], {}).discover[0].memberCount).toBe(0);
  });
});

describe('memberLabel', () => {
  it('shows the cap only when there is one', () => {
    expect(memberLabel({ memberCount: 3, memberCap: 100 })).toBe('3 / 100 members');
    expect(memberLabel({ memberCount: 3, memberCap: null })).toBe('3 members');
  });
});

describe('rankClubMembers', () => {
  const rows = [
    { user_id: 'low', name: 'Low', avatar_url: null, total_xp: 5 },
    { user_id: 'high', name: 'High', avatar_url: null, total_xp: 900 },
    { user_id: 'tied', name: 'Tied', avatar_url: null, total_xp: 5 },
  ];

  it('ranks best first, keeps the server order on ties, and marks you', () => {
    expect(rankClubMembers(rows, 'tied').map((r) => [r.rank, r.userId, r.isYou])).toEqual([
      [1, 'high', false],
      [2, 'low', false],
      [3, 'tied', true],
    ]);
  });
});

describe('formatRating', () => {
  it('shows real numbers, says when there are none, and shows guests nothing', () => {
    expect(formatRating({ average_rating: 4.5, rating_count: 2 }, true)).toBe('4.5 (2)');
    expect(formatRating({ average_rating: 3, rating_count: 2 }, true)).toBe('3.0 (2)');
    expect(formatRating({ average_rating: 0, rating_count: 0 }, true)).toBe('No ratings yet');
    expect(formatRating(null, true)).toBe('No ratings yet');
    expect(formatRating(undefined, true)).toBe('No ratings yet');
    expect(formatRating({ average_rating: 5, rating_count: 9 }, false)).toBeNull();
  });
});

describe('functionErrorMessage', () => {
  const failed = (body: string) => ({ message: 'Edge Function returned a non-2xx status code', context: new Response(body, { status: 400 }) });

  it("finds the function's own reason", async () => {
    expect(await functionErrorMessage(failed('{"error":"Email already registered"}'))).toBe('Email already registered');
  });

  it('falls back when the body has no reason', async () => {
    expect(await functionErrorMessage(failed('not json'))).toMatch(/non-2xx/);
    expect(await functionErrorMessage(failed('{"other":1}'))).toMatch(/non-2xx/);
    expect(await functionErrorMessage({ message: 'Network down' })).toBe('Network down');
    expect(await functionErrorMessage({})).toBe('Something went wrong');
  });

  it('can be asked twice, since it reads a copy of the body', async () => {
    const error = failed('{"error":"Once"}');
    await functionErrorMessage(error);
    expect(await functionErrorMessage(error)).toBe('Once');
  });
});

describe('isUuid', () => {
  it('tells an ID from a guess', () => {
    expect(isUuid('00000000-0000-4000-8000-000000000000')).toBe(true);
    expect(isUuid('not-a-real-id')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

describe('a loadout labelled 40 minutes', () => {
  const levels = ['rookie', 'complete_beginner', 'beginner', 'intermediate', 'advanced', 'pro'];
  const none = { gloves: false, wraps: false, jumpRope: false, heavyBag: false, doubleEndBag: false, speedBag: false, treadmill: false };
  const everything = { gloves: true, wraps: true, jumpRope: true, heavyBag: true, doubleEndBag: true, speedBag: true, treadmill: true };

  it.each(levels)('%s really runs for 40 minutes, with or without gear', (level) => {
    for (const equipment of [none, everything]) {
      const loadout = generateLoadoutWorkout(level, equipment);
      const seconds = loadout.phases.reduce(
        (total, phase) => total + phase.repeats * phase.segments.reduce((sum, segment) => sum + segment.duration, 0),
        0,
      );
      expect(Math.floor(loadout.duration / 60)).toBe(40);
      expect(seconds).toBeGreaterThanOrEqual(40 * 60);
    }
  });
});
