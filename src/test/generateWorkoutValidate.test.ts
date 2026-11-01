import { describe, expect, it } from 'vitest';
import {
  MAX_EQUIPMENT_KEYS,
  MAX_LABEL_LENGTH,
  MAX_PROMPT_LENGTH,
  validateGenerateRequest,
} from '../../supabase/functions/generate-workout/validate';

const valid = { prompt: '5 round heavy bag', userTier: 'pro', experienceLevel: 'pro', equipment: { gloves: true } };

describe('validateGenerateRequest', () => {
  it('accepts what the app sends and keeps only known fields', () => {
    const result = validateGenerateRequest({ ...valid, extra: 'x'.repeat(100000) });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).not.toHaveProperty('extra');
      expect(result.value.equipment).toEqual({ gloves: true });
    }
  });

  it.each([
    ['a number', 42],
    ['an object', { text: 'hi' }],
    ['null', null],
    ['missing', undefined],
    ['blank', '   '],
    ['too long', 'x'.repeat(MAX_PROMPT_LENGTH + 1)],
  ])('rejects a prompt that is %s', (_label, prompt) => {
    expect(validateGenerateRequest({ ...valid, prompt }).ok).toBe(false);
  });

  it('allows a prompt at exactly the limit', () => {
    expect(validateGenerateRequest({ ...valid, prompt: 'x'.repeat(MAX_PROMPT_LENGTH) }).ok).toBe(true);
  });

  it('caps equipment keys and their length', () => {
    const tooMany = Object.fromEntries(Array.from({ length: MAX_EQUIPMENT_KEYS + 1 }, (_, i) => [`k${i}`, true]));
    expect(validateGenerateRequest({ ...valid, equipment: tooMany }).ok).toBe(false);
    expect(validateGenerateRequest({ ...valid, equipment: { ['k'.repeat(MAX_LABEL_LENGTH + 1)]: true } }).ok).toBe(false);
    expect(validateGenerateRequest({ ...valid, equipment: ['gloves'] }).ok).toBe(false);
  });

  it('closes the other routes into the AI prompt', () => {
    const long = 'x'.repeat(MAX_LABEL_LENGTH + 1);
    expect(validateGenerateRequest({ ...valid, userTier: long }).ok).toBe(false);
    expect(validateGenerateRequest({ ...valid, experienceLevel: long }).ok).toBe(false);

    const result = validateGenerateRequest({ ...valid, historyInsights: { averageDifficulty: long, recentTrend: 7, totalWorkouts: 'many' } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.historyInsights).toEqual({
        averageDifficulty: null,
        recentTrend: null,
        preferredDuration: 0,
        suggestedDifficultyAdjust: 0,
        totalWorkouts: 0,
      });
    }
  });

  it('rejects a body that is not an object', () => {
    expect(validateGenerateRequest('hi').ok).toBe(false);
    expect(validateGenerateRequest([]).ok).toBe(false);
  });
});
