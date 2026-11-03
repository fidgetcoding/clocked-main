import { toComboMove } from '@/components/broadcast/run/moves';
import { EXERCISE_CATEGORIES } from '@/data/exerciseCategories';
import { SPEED_BAG_DRILLS } from '@/data/speedBagDrills';
import {
  CALIBRATION_PUNCHES,
  voiceLine as calibrationSays,
  type CalibrationStep,
  type CalibrationStepStatus,
  type CalibrationView,
} from '@/lib/punch/calibration';
import { RECORD_STEPS } from '@/lib/punch/recording';
import { cueFor, PUNCH_ORDER } from '@/lib/punch/round';
import type { FormIssue, PunchClass } from '@/lib/punch/types';

/**
 * Every line the app says out loud, each with an id that names its recorded clip.
 * The recording script and the import script are both built from this list.
 */
export type VoiceSection = 'calibration' | 'record' | 'numbers' | 'moves' | 'clock' | 'segments' | 'drills' | 'exercises' | 'cues';

export interface VoiceLineDef {
  id: string;
  /** What gets said, and what the browser voice reads when there's no clip. */
  text: string;
  section: VoiceSection;
}

/** One stretch of a spoken line. A null id has no clip and is always read by the browser voice. */
export interface VoicePiece {
  id: string | null;
  text: string;
}

export type VoiceLine = VoicePiece[];

export const VOICE_SECTIONS: { section: VoiceSection; title: string; about: string }[] = [
  { section: 'calibration', title: 'Calibration', about: 'Before a camera session: hold your guard, then one of each punch, with a word on how each one read.' },
  { section: 'record', title: 'Record mode', about: 'The hidden landmark recorder (/punch-check?record=1). Each step is "Next." then the step, then a count of one to ten.' },
  { section: 'numbers', title: 'Numbers', about: 'Record mode counts and punch numbers in combos. A combo is stitched from these and the moves.' },
  { section: 'moves', title: 'Combo moves', about: 'Defense and footwork inside a combo, said between the punch numbers.' },
  { section: 'clock', title: 'Clock', about: 'Said near the end of a segment.' },
  { section: 'segments', title: 'Segments', about: 'Said when a new segment starts.' },
  { section: 'drills', title: 'Speed bag drills', about: 'Said as a segment name or as a drill in a speed bag round.' },
  { section: 'exercises', title: 'Exercises', about: 'Said when an exercise segment starts. Exercise names someone types in themselves use the browser voice.' },
  { section: 'cues', title: 'Punch Check form cues', about: 'One at a time while the camera watches.' },
];

export const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const NUMBER_WORDS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

const MOVE_LINES: Record<string, string> = {
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

const FORM_ISSUES: FormIssue[] = ['other_hand_left_guard', 'slow_return', 'chin_exposed', 'arm_not_extended', 'elbow_flare', 'no_rotation'];

/** Exercises the workout generator names that aren't in the exercise picker. */
const GENERATED_EXERCISES = ['Pushups', 'Curlups', 'Jog in Place', 'Jog', 'Treadmill'];

/** What calibration says at each point, worked out by calibration itself so the two can't drift apart. */
function calibrationLines(): string[] {
  const at = (phase: CalibrationView['phase'], step?: Partial<CalibrationStep>) =>
    calibrationSays({ phase, stepIndex: 0, steps: [{ punch: 'jab', status: 'waiting', seenAs: null, tip: null, ...step }] } as CalibrationView);
  const step = (status: CalibrationStepStatus, punch: PunchClass = 'jab', seenAs: PunchClass | null = null) => at('punches', { status, punch, seenAs });
  return [
    at('guard'),
    ...CALIBRATION_PUNCHES.map((punch) => step('waiting', punch)),
    step('seen'),
    step('unnamed'),
    ...PUNCH_ORDER.map((seenAs) => step('wrong', 'jab', seenAs)),
    step('missed'),
    at('result'),
  ].filter((line): line is string => !!line);
}

const unique = (lines: VoiceLineDef[]) => {
  const seen = new Set<string>();
  return lines.filter((line) => {
    const key = normal(line.text);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const normal = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

export const VOICE_LINES: VoiceLineDef[] = [
  ...unique(calibrationLines().map((text) => ({ id: `cal-${slug(text)}`, text, section: 'calibration' as const }))),
  { id: 'rec-next', text: 'Next.', section: 'record' },
  ...RECORD_STEPS.map((step) => ({ id: `rec-${slug(step.label)}`, text: step.prompt, section: 'record' as const })),
  { id: 'rec-go', text: 'Go', section: 'record' },
  ...NUMBER_WORDS.map((word, index) => ({ id: `num-${index + 1}`, text: word, section: 'numbers' as const })),
  ...Object.values(MOVE_LINES).map((text) => ({ id: `move-${slug(text)}`, text, section: 'moves' as const })),
  { id: 'clock-3-2-1', text: '3, 2, 1', section: 'clock' },
  { id: 'clock-10-seconds', text: '10 seconds', section: 'clock' },
  ...['Rest', 'Shadowboxing', 'Heavy Bag', 'Heavy Bag Freestyle', 'Double End Bag', 'Double End Bag Freestyle', 'Speed Bag', 'Speed Bag Freestyle'].map(
    (text) => ({ id: `seg-${slug(text)}`, text, section: 'segments' as const }),
  ),
  ...SPEED_BAG_DRILLS.map((drill) => ({ id: `drill-${drill.id}`, text: drill.name, section: 'drills' as const })),
  ...unique(
    [...Object.values(EXERCISE_CATEGORIES).flat(), ...GENERATED_EXERCISES].map((text) => ({
      id: `ex-${slug(text)}`,
      text,
      section: 'exercises' as const,
    })),
  ),
  ...unique(
    FORM_ISSUES.flatMap((issue) => (['lead', 'rear'] as const).map((hand) => cueFor(issue, hand))).map((text) => ({
      id: `cue-${slug(text)}`,
      text,
      section: 'cues' as const,
    })),
  ),
];

const BY_ID = new Map(VOICE_LINES.map((line) => [line.id, line]));
const BY_TEXT = new Map(VOICE_LINES.map((line) => [normal(line.text), line]));

/** A line by its id. Throws on a typo, so a missing id shows up in tests rather than as silence. */
export function voiceLine(...ids: string[]): VoiceLine {
  return ids.map((id) => {
    const line = BY_ID.get(id);
    if (!line) throw new Error(`No voice line "${id}"`);
    return { id, text: line.text };
  });
}

/** Whatever words were asked for, matched to a recorded line when one says the same thing. */
export function lineForText(text: string): VoiceLine {
  const line = BY_TEXT.get(normal(text));
  return [{ id: line?.id ?? null, text }];
}

/** "Next. Throw 10 jabs": a record-mode step. A prompt with no line of its own uses the browser voice. */
export const recordStepLine = (prompt: string): VoiceLine => [...voiceLine('rec-next'), ...lineForText(prompt)];

/** "Seven" for 7. Numbers past ten have no clip. */
export function numberLine(n: number): VoiceLine {
  return n >= 1 && n <= NUMBER_WORDS.length ? voiceLine(`num-${n}`) : [{ id: null, text: String(n) }];
}

/** A combo, one piece per move: punches by number, defense and footwork by name, drills by their own words. */
export function comboLine(moves: string[]): VoiceLine {
  return moves.flatMap((move) => {
    const { display, type } = toComboMove(move);
    if (type === 'punch') return numberLine(Number(display));
    if (MOVE_LINES[display]) return voiceLine(`move-${slug(MOVE_LINES[display])}`);
    return lineForText(move);
  });
}

/** The words a line says, for the browser voice. */
export const lineText = (line: VoiceLine) =>
  line.reduce((said, piece) => (said ? `${said}${/[.,!?]$/.test(said) ? ' ' : ', '}${piece.text}` : piece.text), '');

/** The ids a line needs clips for. */
export const lineIds = (line: VoiceLine) => line.flatMap((piece) => (piece.id ? [piece.id] : []));
