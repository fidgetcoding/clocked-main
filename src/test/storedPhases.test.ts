import { describe, expect, it } from 'vitest';
import { joinStoredPhases, splitStoredPhases } from '@/lib/storedPhases';
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
