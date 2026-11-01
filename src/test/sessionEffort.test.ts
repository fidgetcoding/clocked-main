import { describe, expect, it } from 'vitest';
import { ALL_BADGES, BADGE_CATEGORIES, checkBadges, sumBadgeXP } from '@/data/badges';
import { PER_SESSION_ESTIMATES, TIER_COMBO_STATS } from '@/lib/xpSystem';
import {
  FRESH_SESSION,
  FULL_MIX,
  MIN_REWARD_SECONDS,
  NOTHING_DONE,
  NOTHING_TRAINED,
  SessionFacts,
  buildSessionBadgeStats,
  contentOfSegment,
  getSessionCredit,
  getSessionEffort,
  isComboRound,
  noteTraining,
  qualifiesForRewards,
  toSessionFacts,
} from '@/lib/sessionEffort';

const FORTY_MINUTES = 40 * 60;
const newFighter = {};

describe('reward gate', () => {
  it('a 5-second workout earns nothing but its timer XP', () => {
    const stats = buildSessionBadgeStats(newFighter, 'intermediate', 5, 0, { ...NOTHING_DONE, content: FULL_MIX });
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
    expect(getSessionCredit(MIN_REWARD_SECONDS, 'pro', NOTHING_TRAINED).sessions).toBe(1);
  });

  it('a session at the minimum earns session badges without the volume ones', () => {
    const facts = { ...NOTHING_DONE, content: FULL_MIX };
    const names = checkBadges(buildSessionBadgeStats(newFighter, 'beginner', MIN_REWARD_SECONDS, 1, facts), []).map((b) => b.id);
    expect(names).toContain('first_blood');
    expect(names).not.toContain('combo_regular');
  });
});

describe('the documented math is untouched', () => {
  it.each(Object.keys(TIER_COMBO_STATS) as (keyof typeof TIER_COMBO_STATS)[])(
    'a full 40-minute %s session gets exactly the documented estimates',
    (tier) => {
      expect(getSessionCredit(FORTY_MINUTES, tier, FULL_MIX)).toEqual({
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
    expect(getSessionCredit(FORTY_MINUTES / 2, 'pro', FULL_MIX).combos).toBe(75);
    expect(getSessionCredit(3 * 3600, 'pro', FULL_MIX).combos).toBe(PER_SESSION_ESTIMATES.combosLanded);
  });

  it('adds credit on top of lifetime stats', () => {
    const stats = buildSessionBadgeStats({ combos_landed: 1000, workouts_completed: 9 }, 'rookie', FORTY_MINUTES, 3, { ...NOTHING_DONE, content: FULL_MIX });
    expect(stats.totalCombos).toBe(1150);
    expect(stats.totalSessions).toBe(10);
    expect(stats.consecutiveDays).toBe(3);
  });
});

describe('badges reflect what the session did', () => {
  const earned = (seconds: number, facts: SessionFacts, profile = newFighter) =>
    checkBadges(buildSessionBadgeStats(profile, 'beginner', seconds, 1, facts), []).map((b) => b.id);
  const finished: SessionFacts = { ...NOTHING_DONE, finished: true };

  it('a 6-minute run that finished nothing and trained no kind of work earns only showing up', () => {
    // The bug this replaces: the same run earned 7 badges worth 430 XP, Beast Mode and Rapid Fire included
    expect(earned(6 * 60, NOTHING_DONE)).toEqual(['day_one', 'first_blood']);
  });

  it('Full Send needs a whole workout, nothing skipped', () => {
    expect(earned(MIN_REWARD_SECONDS, finished)).toContain('full_send');
    expect(earned(MIN_REWARD_SECONDS, NOTHING_DONE)).not.toContain('full_send');
  });

  it('Push Through also needs no pauses', () => {
    expect(earned(MIN_REWARD_SECONDS, { ...finished, unpaused: true })).toContain('push_through');
    expect(earned(MIN_REWARD_SECONDS, finished)).not.toContain('push_through');
  });

  it('Beast Mode needs 40 minutes in one workout', () => {
    expect(earned(FORTY_MINUTES, NOTHING_DONE)).toContain('beast_mode_achiever');
    expect(earned(FORTY_MINUTES - 1, finished)).not.toContain('beast_mode_achiever');
  });

  it('Rapid Fire needs a finished workout with 10 combo rounds', () => {
    expect(earned(MIN_REWARD_SECONDS, { ...finished, comboRounds: 10 })).toContain('rapid_fire');
    expect(earned(MIN_REWARD_SECONDS, { ...finished, comboRounds: 9 })).not.toContain('rapid_fire');
  });

  it('finishing a workout under the minimum earns none of them', () => {
    const facts = { ...finished, unpaused: true, comboRounds: 50 };
    expect(checkBadges(buildSessionBadgeStats(newFighter, 'beginner', MIN_REWARD_SECONDS - 1, 0, facts), [])).toEqual([]);
  });

  it('credits only the kinds of training the session had', () => {
    const pushupsOnly = getSessionCredit(FORTY_MINUTES, 'pro', { ...NOTHING_TRAINED, pushups: true });
    expect(pushupsOnly.pushups).toBe(PER_SESSION_ESTIMATES.pushups);
    expect(pushupsOnly.combos).toBe(0);
    expect(pushupsOnly.defenseCombos).toBe(0);
    expect(pushupsOnly.burpees).toBe(0);
    expect(pushupsOnly.jogRunMinutes).toBe(0);
    expect(getSessionCredit(FORTY_MINUTES, 'pro', NOTHING_TRAINED).sessions).toBe(1);
  });

  it('First Combo needs combo rounds, and Push-up Starter needs push-ups', () => {
    const combos = { ...NOTHING_DONE, content: { ...NOTHING_TRAINED, combos: true } };
    const pushups = { ...NOTHING_DONE, content: { ...NOTHING_TRAINED, pushups: true } };
    expect(earned(FORTY_MINUTES, combos)).toContain('first_combo');
    expect(earned(FORTY_MINUTES, pushups)).not.toContain('first_combo');
    expect(earned(FORTY_MINUTES, pushups)).toContain('pushup_starter');
    expect(earned(FORTY_MINUTES, combos)).not.toContain('pushup_starter');
  });

  it('leaves every XP reward and the badge count alone', () => {
    expect(ALL_BADGES).toHaveLength(88);
    expect(sumBadgeXP(ALL_BADGES)).toBe(346_715);
    const inWorkout = BADGE_CATEGORIES.find((c) => c.category === 'in_workout')!.badges;
    expect(inWorkout.map((b) => [b.id, b.xpReward])).toEqual([
      ['full_send', 200],
      ['push_through', 50],
      ['beast_mode_achiever', 100],
      ['rapid_fire', 40],
    ]);
  });
});

describe('what a segment counts as', () => {
  const round = (fields: object) => ({ name: 'Round', type: 'active' as const, ...fields });

  it('knows a combo round from freestyle, drills and rest', () => {
    expect(isComboRound(round({ segmentType: 'combo', combo: ['1', '2'] }))).toBe(true);
    expect(isComboRound(round({ segmentType: 'shadowboxing', combo: ['1', '2'] }))).toBe(true);
    expect(isComboRound(round({ segmentType: 'doubleend', drill: ['1', '2'] }))).toBe(true);
    expect(isComboRound(round({ segmentType: 'shadowboxing', combo: ['FREESTYLE'] }))).toBe(false);
    expect(isComboRound(round({ segmentType: 'shadowboxing' }))).toBe(false);
    expect(isComboRound(round({ segmentType: 'speedbag', drill: ['Doubles'] }))).toBe(false);
    expect(isComboRound({ name: 'Rest', type: 'rest', segmentType: 'rest', combo: ['1'] })).toBe(false);
  });

  it('reads conditioning from the name', () => {
    expect(contentOfSegment(round({ name: 'Push-Ups', segmentType: 'exercise' }))).toBe('pushups');
    expect(contentOfSegment(round({ name: 'Burpees', segmentType: 'exercise' }))).toBe('burpees');
    expect(contentOfSegment(round({ name: 'Sit-Ups', segmentType: 'exercise' }))).toBe('curlups');
    expect(contentOfSegment(round({ name: 'Light Jogging', segmentType: 'exercise' }))).toBe('jogRun');
    expect(contentOfSegment(round({ name: 'Treadmill', segmentType: 'exercise' }))).toBe('jogRun');
    expect(contentOfSegment(round({ name: 'Plank Hold', segmentType: 'exercise' }))).toBeNull();
    expect(contentOfSegment({ name: 'Rest', type: 'rest', segmentType: 'rest' })).toBeNull();
  });
});

describe('the session log', () => {
  const combo = { name: 'Heavy Bag', type: 'active' as const, segmentType: 'combo', combo: ['1', '2'] };
  const freestyle = { name: 'Heavy Bag', type: 'active' as const, segmentType: 'combo' };

  it('notes each kind of training once, and keeps the same object when nothing changed', () => {
    const once = noteTraining(FRESH_SESSION, combo);
    expect(once.content.combos).toBe(true);
    expect(noteTraining(once, combo)).toBe(once);
    expect(noteTraining(FRESH_SESSION, freestyle)).toBe(FRESH_SESSION);
  });

  it('counts a workout as finished only when it ran to its end uncut', () => {
    const ran = { ...FRESH_SESSION, ranToEnd: true };
    expect(toSessionFacts(FRESH_SESSION, [combo])).toMatchObject({ finished: false, unpaused: false, comboRounds: 0 });
    expect(toSessionFacts(ran, [combo, freestyle, combo])).toMatchObject({ finished: true, unpaused: true, comboRounds: 2 });
    expect(toSessionFacts({ ...ran, paused: true }, [combo])).toMatchObject({ finished: true, unpaused: false, comboRounds: 1 });
    expect(toSessionFacts({ ...ran, cutShort: true }, [combo])).toMatchObject({ finished: false, unpaused: false, comboRounds: 0 });
  });
});
