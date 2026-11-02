import { describe, expect, it } from 'vitest';
import { punchCountIncrements } from '@/lib/workoutTracking';

type ProfileArg = Parameters<typeof punchCountIncrements>[0];
const profile = (fields: Partial<ProfileArg>) => fields as ProfileArg;

describe('real punches into the career counts', () => {
  it('adds each punch to its own count', () => {
    expect(
      punchCountIncrements(profile({ punch_1_count: 10 }), { jab: 3, cross: 2, lead_hook: 1, rear_hook: 4, lead_uppercut: 5, rear_uppercut: 6 }),
    ).toEqual({ punch_1_count: 13, punch_2_count: 2, punch_3_count: 1, punch_4_count: 4, punch_5_count: 5, punch_6_count: 6 });
  });

  it('counts nothing for a punch it could not name, and leaves the other counts alone', () => {
    expect(punchCountIncrements(profile({ punch_7_count: 9 }), { punch: 12 })).toEqual({});
  });
});
