import { describe, expect, it } from 'vitest';
import { flattenWorkout, segmentAnnouncement, segmentCallout, type SessionWorkout } from '@/lib/session/flattenWorkout';
import type { WorkoutPhase } from '@/types';

const phase = (id: string, repeats: number, segments: WorkoutPhase['segments'], combos?: string[][]): WorkoutPhase =>
  ({ id, name: id, repeats, segments, combos, comboOrder: 'sequential' });
const workout = (sections: Partial<SessionWorkout['sections']>, megasetRepeats = 1): SessionWorkout => ({
  id: 'w', name: 'W', duration: 0, difficulty: 'beginner', is_preset: false, combos: undefined, megasetRepeats,
  sections: { warmup: [], grind: [], cooldown: [], ...sections },
});

describe('flattening a workout', () => {
  it('runs warmup, Get Ready, the rounds, Recovery and cooldown in order', () => {
    const flat = flattenWorkout(workout({
      warmup: [phase('jog', 1, [{ id: 'j', name: 'Jog', type: 'active', duration: 60 }])],
      grind: [phase('bag', 2, [
        { id: 'r', name: 'Heavy Bag', type: 'active', segmentType: 'combo', duration: 180 },
        { id: 'x', name: 'Rest', type: 'rest', segmentType: 'rest', duration: 60 },
      ], [['1', '2'], ['1', '2', '3']])],
      cooldown: [phase('stretch', 1, [{ id: 's', name: 'Stretch', type: 'active', duration: 120 }])],
    }));
    expect(flat.map((segment) => segment.name)).toEqual(['Jog', 'Get Ready', 'Heavy Bag', 'Rest', 'Heavy Bag', 'Rest', 'Recovery', 'Stretch']);
    expect(flat.map((segment) => segment.cumulativeRound)).toEqual([undefined, undefined, 1, 1, 2, 2, undefined, undefined]);
    expect(flat[2].combo).toEqual(['1', '2']);
    expect(flat[4].combo).toEqual(['1', '2', '3']);
    expect(new Set(flat.map((segment) => segment.id)).size).toBe(flat.length);
  });

  it('repeats the rounds once per megaset and numbers rounds straight through', () => {
    const flat = flattenWorkout(workout({ grind: [phase('bag', 1, [{ id: 'r', name: 'Round', type: 'active', duration: 60 }])] }, 3));
    expect(flat.map((segment) => [segment.megasetIndex, segment.cumulativeRound])).toEqual([[0, 1], [1, 2], [2, 3]]);
  });

  it('keeps warmup and cooldown freestyle when only the workout has combos', () => {
    const flat = flattenWorkout({ ...workout({
      warmup: [phase('shadow', 1, [{ id: 'sh', name: 'Shadow', type: 'active', segmentType: 'shadowboxing', duration: 60 }])],
      grind: [phase('bag', 1, [{ id: 'r', name: 'Bag', type: 'active', segmentType: 'combo', duration: 60 }])],
    }), combos: [['1', '1', '2']] });
    expect(flat.find((segment) => segment.name === 'Shadow')?.combo).toBeUndefined();
    expect(flat.find((segment) => segment.name === 'Bag')?.combo).toEqual(['1', '1', '2']);
  });

  it('announces and calls out segments the way the session speaks them', () => {
    const [bag] = flattenWorkout(workout({ grind: [phase('bag', 1, [{ id: 'r', name: 'Heavy Bag Combos', type: 'active', segmentType: 'combo', duration: 60 }], [['1', '2']])] }));
    expect(segmentAnnouncement(bag)).toBe('Heavy Bag');
    expect(segmentCallout(bag)).toEqual(['1', '2']);
    expect(segmentAnnouncement({ ...bag, type: 'rest' })).toBe('Rest');
  });
});
