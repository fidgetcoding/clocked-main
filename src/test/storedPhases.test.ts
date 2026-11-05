import { describe, expect, it } from 'vitest';
import { joinStoredPhases, MAX_STORED_REPEATS, normalizeStoredCombos, normalizeStoredPhases, splitStoredPhases } from '@/lib/storedPhases';
import type { WorkoutPhase } from '@/types';

const phase = (name: string): WorkoutPhase => ({ id: name, name, repeats: 1, segments: [] });

describe('stored phases', () => {
  it('keeps every section through a save and a load', () => {
    const sections = { warmup: [phase('a')], grind: [phase('b'), phase('c')], cooldown: [phase('d')] };
    expect(splitStoredPhases(joinStoredPhases(sections)).sections).toEqual(sections);
  });

  it('accepts a workout missing some sections', () => {
    expect(joinStoredPhases({ grind: [phase('b')] })).toEqual([{ ...phase('b'), section: 'grind' }]);
  });

  it('still runs a workout saved before phases had sections', () => {
    const { sections } = splitStoredPhases([phase('a'), phase('b')]);
    expect(sections.grind.map((p) => p.name)).toEqual(['a', 'b']);
    expect(sections.warmup).toEqual([]);
  });
});

describe('damaged saved phases', () => {
  it('reads anything that is not a list as no phases', () => {
    for (const value of [null, undefined, 'phases', 42, { id: 'a' }]) {
      expect(normalizeStoredPhases(value)).toEqual([]);
      expect(splitStoredPhases(value).sections).toEqual({ warmup: [], grind: [], cooldown: [] });
    }
  });

  it('repairs a phase and its segments instead of failing the workout', () => {
    const [repaired] = normalizeStoredPhases([
      { name: 7, repeats: '3', section: 'nowhere', segments: [null, 'jab', { duration: '45', type: 'rest', combo: ['1', 2, '2'] }, { duration: -5, comboIndex: 'x' }] },
    ]);
    expect(repaired).toEqual({
      id: 'phase-0', name: '', repeats: 3,
      segments: [
        { id: 'phase-0-2', name: 'Round', type: 'rest', duration: 45, combo: ['1', '2'] },
        { id: 'phase-0-3', name: 'Round', type: 'active', duration: 0 },
      ],
    });
  });

  it('caps repeats so a damaged number cannot build millions of rounds', () => {
    const [phase, meta] = normalizeStoredPhases([{ id: 'p', name: 'P', repeats: 1e9, segments: [] }, { _meta: true, megasetRepeats: 5e6 }]);
    expect(phase.repeats).toBe(MAX_STORED_REPEATS);
    expect(meta.megasetRepeats).toBe(MAX_STORED_REPEATS);
    expect(normalizeStoredPhases([{ id: 'p', repeats: 0, segments: [] }])[0].repeats).toBe(1);
  });

  it('leaves a healthy phase exactly as saved, extra fields included', () => {
    const healthy = { id: 'h', name: 'Heavy bag', repeats: 3, section: 'grind', comboOrder: 'random', note: 'kept',
      segments: [{ id: 's', name: 'Work', type: 'active', segmentType: 'combo', duration: 180, combo: ['1', '2'], comboIndex: 'cycle' }] };
    expect(normalizeStoredPhases([healthy])).toEqual([healthy]);
  });

  it('keeps only lists of moves in workout combos', () => {
    expect(normalizeStoredCombos([['1', '2'], 'jab', [3, '4'], null])).toEqual([['1', '2'], ['4']]);
    expect(normalizeStoredCombos({})).toEqual([]);
  });
});
