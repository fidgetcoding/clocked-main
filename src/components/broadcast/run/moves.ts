export type MoveType = 'punch' | 'defense' | 'movement' | 'drill';

export interface ComboMove {
  /** What goes on the plate: 1, SL, a drill name. */
  display: string;
  /** What it's called, under the plate. */
  name: string;
  type: MoveType;
}

const NAMES: Record<string, string> = {
  '1': 'Jab',
  '2': 'Cross',
  '3': 'Lead hook',
  '4': 'Rear hook',
  '5': 'Lead upper',
  '6': 'Rear upper',
  '7': 'Lead body',
  '8': 'Rear body',
  SL: 'Slip left',
  SR: 'Slip right',
  RL: 'Roll left',
  RR: 'Roll right',
  PL: 'Pull',
  BK: 'Block',
  '↺': 'Circle left',
  '↻': 'Circle right',
  '→': 'Step in',
  '←': 'Step out',
};

const WORDS: [string | RegExp, string][] = [
  ['JAB', '1'],
  ['CROSS', '2'],
  ['STRAIGHT', '2'],
  ['LEAD HOOK', '3'],
  ['LEFT HOOK', '3'],
  ['REAR HOOK', '4'],
  ['RIGHT HOOK', '4'],
  ['LEAD UPPERCUT', '5'],
  ['LEFT UPPERCUT', '5'],
  ['REAR UPPERCUT', '6'],
  ['RIGHT UPPERCUT', '6'],
  ['LEAD BODY HOOK', '7'],
  ['LEFT BODY', '7'],
  ['REAR BODY HOOK', '8'],
  ['RIGHT BODY', '8'],
  ['PULL', 'PL'],
  ['BLOCK', 'BK'],
  [/SLIP L/, 'SL'],
  [/SLIP R/, 'SR'],
  [/ROLL L/, 'RL'],
  [/ROLL R/, 'RR'],
  [/CIRCLE L/, '↺'],
  [/CIRCLE R/, '↻'],
  [/STEP IN/, '→'],
  [/STEP OUT/, '←'],
];

const DEFENSE = new Set(['SL', 'SR', 'RL', 'RR', 'PL', 'BK']);
const MOVEMENT = new Set(['↺', '↻', '→', '←']);

/** Turns a stored move into its plate. Anything unknown, like a speed bag drill, keeps its own words. */
export function toComboMove(move: string): ComboMove {
  const upper = move.toUpperCase();
  const match = WORDS.find(([word]) => (typeof word === 'string' ? word === upper : word.test(upper)));
  const display = match ? match[1] : upper in NAMES ? upper : move;
  if (DEFENSE.has(display)) return { display, name: NAMES[display], type: 'defense' };
  if (MOVEMENT.has(display)) return { display, name: NAMES[display], type: 'movement' };
  if (/^\d+$/.test(display)) return { display, name: NAMES[display] ?? '', type: 'punch' };
  return { display, name: '', type: 'drill' };
}

export const comboText = (moves: ComboMove[]) => moves.map((move) => move.display).join('-');
