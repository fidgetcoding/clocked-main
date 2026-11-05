import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PROFILE_COUNTERS, PROFILE_FIELDS, toSessionCredit } from '@/lib/profileCredit';
import { computePostL100Increments, punchCountIncrements } from '@/lib/workoutTracking';
import type { Profile } from '@/hooks/useProfile';

const MIGRATION = readFileSync('supabase/migrations/20261105090000_atomic_reorder_and_session_credit.sql', 'utf8');
const sqlList = (name: string) =>
  [...MIGRATION.match(new RegExp(`${name} text\\[\\] := ARRAY\\[([^\\]]+)\\]`))![1].matchAll(/'([a-z0-9_]+)'/g)].map((match) => match[1]);

describe('session credit', () => {
  it('lists the same counters and fields as the database function', () => {
    expect(sqlList('counters')).toEqual([...PROFILE_COUNTERS]);
    expect(sqlList('settable')).toEqual([...PROFILE_FIELDS]);
  });

  it('sends only what this session added, so another tab’s save is kept', () => {
    const stale = { total_xp: 1000, total_pushups: 40, current_streak: 3 };
    const credit = toSessionCredit(stale, { total_xp: 1250.4, total_pushups: 40, current_streak: 4, last_workout_date: '2026-11-05' });
    expect(credit).toEqual({ totals: { total_xp: 250 }, fields: { current_streak: 4, last_workout_date: '2026-11-05' } });
  });

  it('never sends a negative amount', () => {
    expect(toSessionCredit({ total_xp: 500 }, { total_xp: 100 }).totals).toEqual({});
  });

  it('refuses a field the server would reject, instead of failing the save later', () => {
    expect(() => toSessionCredit({}, { prestige: 'pro' })).toThrow("prestige can't be credited");
  });

  it('accepts every stat a logged session produces', () => {
    const profile = { prestige: 'pro', current_level: 100, last_workout_date: '2020-01-01', current_streak: 9, best_session_xp: 0 } as unknown as Profile;
    const segments = [{ name: 'Combo', segmentType: 'combo', duration: 30, combo: ['1', '2', '3', '4', '5', '6', '7', '8', 'slip', 'roll', 'pull', 'circle'] }];
    const increments = {
      ...computePostL100Increments(profile, 400, segments, 1),
      ...punchCountIncrements(profile, { jab: 3, cross: 2, lead_hook: 1, rear_hook: 1, lead_uppercut: 1, rear_uppercut: 1 }),
      new_years_workout: true,
    };
    expect(() => toSessionCredit(profile, increments)).not.toThrow();
    expect(toSessionCredit(profile, increments).totals.post_l100_sessions).toBe(1);
  });
});
