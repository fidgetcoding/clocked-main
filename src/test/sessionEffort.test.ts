import { describe, expect, it } from 'vitest';
import { checkBadges } from '@/data/badges';
import { PER_SESSION_ESTIMATES, TIER_COMBO_STATS } from '@/lib/xpSystem';
import {
  MIN_REWARD_SECONDS,
  buildSessionBadgeStats,
  getSessionCredit,
  getSessionEffort,
  qualifiesForRewards,
} from '@/lib/sessionEffort';

const FORTY_MINUTES = 40 * 60;
const newFighter = {};

describe('reward gate', () => {
  it('a 5-second workout earns nothing but its timer XP', () => {
    const stats = buildSessionBadgeStats(newFighter, 'intermediate', 5, 0);
    expect(stats.totalSessions).toBe(0);
    expect(stats.totalCombos).toBe(0);
    expect(stats.totalPushups).toBe(0);
    // The bug this replaces: the same session used to earn 13 badges worth 1,255 XP
    expect(checkBadges(stats, [])).toEqual([]);
  });

  it('holds just under the minimum and opens exactly at it', () => {
    expect(qualifiesForRewards(MIN_REWARD_SECONDS - 1)).toBe(false);
    expect(getSessionEffort(MIN_REWARD_SECONDS - 1)).toBe(0);
    expect(qualifiesForRewards(MIN_REWARD_SECONDS)).toBe(true);
    expect(getSessionCredit(MIN_REWARD_SECONDS, 'pro').sessions).toBe(1);
  });

  it('a session at the minimum earns session badges without the volume ones', () => {
    const names = checkBadges(buildSessionBadgeStats(newFighter, 'beginner', MIN_REWARD_SECONDS, 1), []).map((b) => b.id);
    expect(names).toContain('first_blood');
    expect(names).toContain('full_send');
    expect(names).not.toContain('combo_regular');
  });
});

describe('the documented math is untouched', () => {
  it.each(Object.keys(TIER_COMBO_STATS) as (keyof typeof TIER_COMBO_STATS)[])(
    'a full 40-minute %s session gets exactly the documented estimates',
    (tier) => {
      expect(getSessionCredit(FORTY_MINUTES, tier)).toEqual({
        sessions: 1,
        combos: PER_SESSION_ESTIMATES.combosLanded,
        pushups: PER_SESSION_ESTIMATES.pushups,
        burpees: PER_SESSION_ESTIMATES.burpees,
        curlups: PER_SESSION_ESTIMATES.curlups,
        jogRunMinutes: PER_SESSION_ESTIMATES.jogRunMinutes,
        complexCombos: TIER_COMBO_STATS[tier].complex,
        defenseCombos: TIER_COMBO_STATS[tier].defense,
        counterCombos: TIER_COMBO_STATS[tier].counter,
      });
    },
  );

  it('keeps the constants the design was built on', () => {
    expect(PER_SESSION_ESTIMATES).toEqual({
      combosLanded: 150,
      pushups: 120,
      burpees: 15,
      curlups: 60,
      jogRunMinutes: 13,
      workoutDurationHours: 0.667,
    });
  });

  it('pro-rates a shorter session and never pays more than one full session', () => {
    expect(getSessionCredit(FORTY_MINUTES / 2, 'pro').combos).toBe(75);
    expect(getSessionCredit(3 * 3600, 'pro').combos).toBe(PER_SESSION_ESTIMATES.combosLanded);
  });

  it('adds credit on top of lifetime stats', () => {
    const stats = buildSessionBadgeStats({ combos_landed: 1000, workouts_completed: 9 }, 'rookie', FORTY_MINUTES, 3);
    expect(stats.totalCombos).toBe(1150);
    expect(stats.totalSessions).toBe(10);
    expect(stats.consecutiveDays).toBe(3);
  });
});
