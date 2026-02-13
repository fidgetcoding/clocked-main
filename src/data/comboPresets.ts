// Combo presets organized by difficulty level
// Now backed by the full 740-combo preset library

import { getPresetsByTier, PresetCategory } from '@/data/presetComboLibrary';

export type ComboDifficulty = 'rookie' | 'beginner' | 'intermediate' | 'advanced' | 'pro';

export interface ComboPreset {
  id: string;
  name: string;
  combo: string[];
  difficulty: ComboDifficulty;
}

/**
 * Get all presets for a difficulty as flat ComboPreset[] (legacy compat).
 */
export const getAllPresets = (difficulty: ComboDifficulty): ComboPreset[] => {
  const { categories } = getPresetsByTier(difficulty);
  let idx = 0;
  return categories.flatMap(cat =>
    cat.combos.map(combo => ({
      id: `${difficulty}-${idx++}`,
      name: combo.join('-'),
      combo,
      difficulty,
    }))
  );
};

/**
 * Get presets grouped by category for the new picker UI.
 */
export const getPresetCategories = (difficulty: ComboDifficulty): PresetCategory[] => {
  return getPresetsByTier(difficulty).categories;
};

// Punch keys available per tier (for the custom combo builder keypad)
// Per the architecture: Rookie/Beginner 1-6, Intermediate/Advanced 1-8, Pro 1-10
export const PUNCH_KEYS_BY_DIFFICULTY: Record<ComboDifficulty, string[]> = {
  rookie: ['1', '2', '3', '4', '5', '6'],
  beginner: ['1', '2', '3', '4', '5', '6'],
  intermediate: ['1', '2', '3', '4', '5', '6', '7', '8'],
  advanced: ['1', '2', '3', '4', '5', '6', '7', '8'],
  pro: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
};

// Defense keys per tier
// Rookie: none. Beginner: Slip L/R. Intermediate: + Roll L/R, Pull. Advanced: same. Pro: + Circle L/R.
export const DEFENSE_KEYS_BY_DIFFICULTY: Record<ComboDifficulty, string[]> = {
  rookie: [],
  beginner: ['SLIP L', 'SLIP R'],
  intermediate: ['SLIP L', 'SLIP R', 'ROLL L', 'ROLL R', 'PULL'],
  advanced: ['SLIP L', 'SLIP R', 'ROLL L', 'ROLL R', 'PULL'],
  pro: ['SLIP L', 'SLIP R', 'ROLL L', 'ROLL R', 'PULL'],
};

export const MOVEMENT_KEYS_BY_DIFFICULTY: Record<ComboDifficulty, string[]> = {
  rookie: [] as string[],
  beginner: [] as string[],
  intermediate: [] as string[],
  advanced: [] as string[],
  pro: ['CIRCLE L', 'CIRCLE R'],
};
