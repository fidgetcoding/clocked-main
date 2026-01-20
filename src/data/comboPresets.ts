// Combo presets organized by difficulty level

export interface ComboPreset {
  id: string;
  name: string;
  combo: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

// Beginner presets - only 1-4, SLIP L/R, ROLL L/R
export const BEGINNER_COMBOS: ComboPreset[] = [
  { id: 'b1', name: 'Jab Cross', combo: ['1', '2'], difficulty: 'beginner' },
  { id: 'b2', name: 'Triple Jab', combo: ['1', '1', '1'], difficulty: 'beginner' },
  { id: 'b3', name: 'Jab Cross Hook', combo: ['1', '2', '3'], difficulty: 'beginner' },
  { id: 'b4', name: 'Basic Four', combo: ['1', '2', '3', '4'], difficulty: 'beginner' },
  { id: 'b5', name: 'Jab Slip Jab', combo: ['1', 'SLIP L', '1'], difficulty: 'beginner' },
  { id: 'b6', name: 'Double Jab Cross', combo: ['1', '1', '2'], difficulty: 'beginner' },
  { id: 'b7', name: 'Cross Hook Cross', combo: ['2', '3', '2'], difficulty: 'beginner' },
  { id: 'b8', name: 'Jab Cross Slip Roll', combo: ['1', '2', 'SLIP L', 'ROLL L'], difficulty: 'beginner' },
  { id: 'b9', name: 'Hook Hook', combo: ['3', '4'], difficulty: 'beginner' },
  { id: 'b10', name: 'Jab Body Jab', combo: ['1', '2', '1'], difficulty: 'beginner' },
];

// Intermediate presets - 1-6, all defense
export const INTERMEDIATE_COMBOS: ComboPreset[] = [
  { id: 'i1', name: 'Six Punch Flow', combo: ['1', '2', '3', '4', '5', '6'], difficulty: 'intermediate' },
  { id: 'i2', name: 'Jab Cross Uppercut', combo: ['1', '2', '5'], difficulty: 'intermediate' },
  { id: 'i3', name: 'Body Rip Combo', combo: ['1', '2', '5', '6', '3'], difficulty: 'intermediate' },
  { id: 'i4', name: 'Slip Counter', combo: ['SLIP R', '2', '3', '2'], difficulty: 'intermediate' },
  { id: 'i5', name: 'Roll Under Hook', combo: ['ROLL L', '3', '2', '3'], difficulty: 'intermediate' },
  { id: 'i6', name: 'Defensive Flow', combo: ['1', '2', 'SLIP L', 'ROLL R', '3', '2'], difficulty: 'intermediate' },
  { id: 'i7', name: 'Uppercut Sandwich', combo: ['1', '5', '2', '6', '3'], difficulty: 'intermediate' },
  { id: 'i8', name: 'Pull Counter', combo: ['PULL', '2', '3', '2'], difficulty: 'intermediate' },
  { id: 'i9', name: 'Double Hook Body', combo: ['3', '4', '5', '6'], difficulty: 'intermediate' },
  { id: 'i10', name: 'Block Counter', combo: ['BLOCK', '2', '5', '3', '2'], difficulty: 'intermediate' },
];

// Advanced presets - all 1-8, all movements
export const ADVANCED_COMBOS: ComboPreset[] = [
  { id: 'a1', name: 'Full Arsenal', combo: ['1', '2', '3', '4', '5', '6', '7', '8'], difficulty: 'advanced' },
  { id: 'a2', name: 'Circle Jab', combo: ['CIRCLE L', '1', '1', '2', 'CIRCLE R', '2', '3', '2'], difficulty: 'advanced' },
  { id: 'a3', name: 'Step In Power', combo: ['STEP IN', '1', '2', '5', '3', '2', 'STEP OUT'], difficulty: 'advanced' },
  { id: 'a4', name: 'Philly Shell Counter', combo: ['SLIP R', 'ROLL L', '7', '8', '3', '2'], difficulty: 'advanced' },
  { id: 'a5', name: 'Pressure Fighter', combo: ['STEP IN', '1', '2', '5', '6', '3', '4', '7', '8'], difficulty: 'advanced' },
  { id: 'a6', name: 'Pivot Attack', combo: ['1', '2', 'CIRCLE L', '3', '2', 'CIRCLE R', '2', '3'], difficulty: 'advanced' },
  { id: 'a7', name: 'Body Snatcher', combo: ['1', '5', '7', '6', '8', '3', '2'], difficulty: 'advanced' },
  { id: 'a8', name: 'Ring General', combo: ['STEP OUT', '1', '1', 'STEP IN', '2', '5', '3', 'STEP OUT'], difficulty: 'advanced' },
  { id: 'a9', name: 'Elite Defense', combo: ['SLIP L', 'SLIP R', 'ROLL L', '7', '8', 'PULL', '2', '3', '2'], difficulty: 'advanced' },
  { id: 'a10', name: 'Championship Round', combo: ['1', '2', '3', '4', 'SLIP L', '5', '6', '7', '8', 'CIRCLE L'], difficulty: 'advanced' },
];

export const getAllPresets = (difficulty: 'beginner' | 'intermediate' | 'advanced'): ComboPreset[] => {
  switch (difficulty) {
    case 'beginner':
      return BEGINNER_COMBOS;
    case 'intermediate':
      return [...BEGINNER_COMBOS, ...INTERMEDIATE_COMBOS];
    case 'advanced':
      return [...BEGINNER_COMBOS, ...INTERMEDIATE_COMBOS, ...ADVANCED_COMBOS];
  }
};

// Keys available by difficulty
export const PUNCH_KEYS_BY_DIFFICULTY = {
  beginner: ['1', '2', '3', '4'],
  intermediate: ['1', '2', '3', '4', '5', '6'],
  advanced: ['1', '2', '3', '4', '5', '6', '7', '8'],
};

export const DEFENSE_KEYS_BY_DIFFICULTY = {
  beginner: ['SLIP L', 'SLIP R', 'ROLL L', 'ROLL R'],
  intermediate: ['SLIP L', 'SLIP R', 'ROLL L', 'ROLL R', 'PULL', 'BLOCK'],
  advanced: ['SLIP L', 'SLIP R', 'ROLL L', 'ROLL R', 'PULL', 'BLOCK'],
};

export const MOVEMENT_KEYS_BY_DIFFICULTY = {
  beginner: [] as string[],
  intermediate: ['CIRCLE L', 'CIRCLE R'],
  advanced: ['CIRCLE L', 'CIRCLE R', 'STEP IN', 'STEP OUT'],
};
