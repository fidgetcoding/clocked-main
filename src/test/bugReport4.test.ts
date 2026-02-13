import { describe, it, expect } from 'vitest';
import { parseComboString } from '@/lib/comboParser';
import { parseWorkoutInput } from '@/lib/aiWorkoutParser';

describe('Bug Report #4', () => {
  it('BUG #1: "body hook" parses as single token → 7', () => {
    const result = parseComboString('double jab cross body hook');
    expect(result).toEqual(['1', '1', '2', '7']);
  });

  it('"rear body hook" parses as single token → 8', () => {
    const result = parseComboString('jab cross rear body hook');
    expect(result).toEqual(['1', '2', '8']);
  });

  it('"body shot" parses as 7', () => {
    const result = parseComboString('jab body shot');
    expect(result).toEqual(['1', '7']);
  });

  it('BUG #2: "Repeat everything twice" sets megasetRepeats=2, no ghost phase', () => {
    const prompt = `3 rounds heavy bag, 2 minutes each, 30 sec rest.

Repeat everything twice.`;
    const result = parseWorkoutInput(prompt);
    expect(result.megasetRepeats).toBe(2);
    // No ghost "Training" phase
    const ghostPhase = result.phases.find(p => p.name === 'Training');
    expect(ghostPhase).toBeUndefined();
  });
});
