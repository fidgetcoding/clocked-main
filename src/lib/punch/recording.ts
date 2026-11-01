import { LM } from './body';
import { PUNCH_CONFIG, type PunchConfig } from './config';
import { PunchDetector } from './detector';
import type { PunchDetected, PunchClass, Landmark, Stance, Hand } from './types';

/** Landmarks only. A recording never holds a pixel of video. */
export const RECORDING_FORMAT = 'clocked-punch-landmarks';

export type RecordLabel = 'guard' | Exclude<PunchClass, 'punch'>;

export interface RecordStep {
  label: RecordLabel;
  prompt: string;
  /** How many punches the prompt asks for. */
  expected: number;
  seconds: number;
}

export const RECORD_STEPS: RecordStep[] = [
  { label: 'guard', prompt: 'Stand still in your guard', expected: 0, seconds: 10 },
  { label: 'jab', prompt: 'Throw 10 jabs', expected: 10, seconds: 30 },
  { label: 'cross', prompt: 'Throw 10 crosses', expected: 10, seconds: 30 },
  { label: 'lead_hook', prompt: 'Throw 10 lead hooks', expected: 10, seconds: 30 },
  { label: 'rear_hook', prompt: 'Throw 10 rear hooks', expected: 10, seconds: 30 },
  { label: 'lead_uppercut', prompt: 'Throw 10 lead uppercuts', expected: 10, seconds: 30 },
  { label: 'rear_uppercut', prompt: 'Throw 10 rear uppercuts', expected: 10, seconds: 30 },
];

type PackedLandmark = [number, number, number, number];

export interface RecordedFrame {
  t: number;
  image: PackedLandmark[] | null;
  world: PackedLandmark[] | null;
}

export interface RecordedSegment {
  label: RecordLabel;
  expected: number;
  startT: number;
  endT: number;
}

export interface PunchRecording {
  format: typeof RECORDING_FORMAT;
  version: 1;
  createdAt: string;
  stance: Stance;
  video: { width: number; height: number };
  segments: RecordedSegment[];
  frames: RecordedFrame[];
}

const round4 = (value: number) => Math.round(value * 10000) / 10000;

export const packLandmarks = (landmarks: Landmark[] | null): PackedLandmark[] | null =>
  landmarks && landmarks.map((p) => [round4(p.x), round4(p.y), round4(p.z), round4(p.visibility ?? 0)]);

const unpack = (landmarks: PackedLandmark[] | null): Landmark[] | null =>
  landmarks && landmarks.map(([x, y, z, visibility]) => ({ x, y, z, visibility }));

/** Throws a readable error for anything that isn't a recording. */
export function parseRecording(text: string): PunchRecording {
  const data = JSON.parse(text) as Partial<PunchRecording>;
  if (data.format !== RECORDING_FORMAT || !Array.isArray(data.frames) || !Array.isArray(data.segments)) {
    throw new Error(`Not a ${RECORDING_FORMAT} file`);
  }
  if (data.stance !== 'orthodox' && data.stance !== 'southpaw') throw new Error('The file has no stance');
  return data as PunchRecording;
}

export const CONFUSION_COLUMNS: PunchClass[] = [
  'jab',
  'cross',
  'lead_hook',
  'rear_hook',
  'lead_uppercut',
  'rear_uppercut',
  'punch',
];

export interface ConfusionRow {
  label: RecordLabel;
  expected: number;
  counts: Record<PunchClass, number>;
  total: number;
  /** Punches thrown by the hand the prompt didn't ask for. */
  wrongHand: number;
}

export interface ReplayResult {
  rows: ConfusionRow[];
  events: { label: RecordLabel | null; punch: PunchDetected }[];
  /** Punches outside any prompted step. */
  outsideSteps: number;
  /** Share of tracked frames with the fighter's left shoulder on the image's right. */
  leftOnImageRight: number;
  framesWithPerson: number;
  framesTotal: number;
  /** Punches labelled what the prompt asked for, over punches the prompts asked for. */
  accuracy: number;
}

const handOfLabel = (label: RecordLabel): Hand | null => {
  if (label === 'guard') return null;
  return label === 'jab' || label.startsWith('lead') ? 'lead' : 'rear';
};

/** Runs a recording through the detector and scores it against what the prompts asked for. */
export function replayRecording(recording: PunchRecording, config: PunchConfig = PUNCH_CONFIG): ReplayResult {
  const detector = new PunchDetector(recording.stance, config);
  const rows: ConfusionRow[] = recording.segments.map((segment) => ({
    label: segment.label,
    expected: segment.expected,
    counts: { jab: 0, cross: 0, lead_hook: 0, rear_hook: 0, lead_uppercut: 0, rear_uppercut: 0, punch: 0 },
    total: 0,
    wrongHand: 0,
  }));
  const events: ReplayResult['events'] = [];
  let outsideSteps = 0;
  let framesWithPerson = 0;
  let leftOnRight = 0;

  for (const frame of recording.frames) {
    if (frame.image) {
      framesWithPerson += 1;
      if (frame.image[LM.LEFT_SHOULDER][0] > frame.image[LM.RIGHT_SHOULDER][0]) leftOnRight += 1;
    }
    for (const event of detector.push({ t: frame.t, landmarks: unpack(frame.world) })) {
      if (event.type !== 'punch') continue;
      const index = recording.segments.findIndex((s) => event.t >= s.startT && event.t <= s.endT);
      if (index < 0) {
        outsideSteps += 1;
        events.push({ label: null, punch: event });
        continue;
      }
      const row = rows[index];
      row.counts[event.punch] += 1;
      row.total += 1;
      const wanted = handOfLabel(row.label);
      if (wanted && wanted !== event.hand) row.wrongHand += 1;
      events.push({ label: row.label, punch: event });
    }
  }

  const asked = rows.reduce((sum, row) => sum + row.expected, 0);
  const right = rows.reduce((sum, row) => (row.label === 'guard' ? sum : sum + row.counts[row.label]), 0);

  return {
    rows,
    events,
    outsideSteps,
    leftOnImageRight: framesWithPerson === 0 ? 0 : leftOnRight / framesWithPerson,
    framesWithPerson,
    framesTotal: recording.frames.length,
    accuracy: asked === 0 ? 0 : right / asked,
  };
}

const NUMBERS: Record<PunchClass, string> = {
  jab: '1',
  cross: '2',
  lead_hook: '3',
  rear_hook: '4',
  lead_uppercut: '5',
  rear_uppercut: '6',
  punch: '?',
};

/** The confusion table as plain text: what was asked for down the side, what it was called across the top. */
export function formatConfusion(result: ReplayResult): string {
  const header = ['asked for'.padEnd(15), ...CONFUSION_COLUMNS.map((c) => NUMBERS[c].padStart(4)), 'total'.padStart(7), 'asked'.padStart(7), 'wrong hand'.padStart(12)];
  const lines = [header.join('')];
  for (const row of result.rows) {
    lines.push(
      [
        row.label.padEnd(15),
        ...CONFUSION_COLUMNS.map((c) => String(row.counts[c]).padStart(4)),
        String(row.total).padStart(7),
        String(row.expected).padStart(7),
        String(row.wrongHand).padStart(12),
      ].join(''),
    );
  }
  lines.push('');
  lines.push(`Labelled what was asked for: ${Math.round(result.accuracy * 100)}%`);
  lines.push(`Punches outside any step: ${result.outsideSteps}`);
  lines.push(`Frames with a person: ${result.framesWithPerson} of ${result.framesTotal}`);
  lines.push(
    `Left shoulder on the image's right: ${Math.round(result.leftOnImageRight * 100)}% of frames (low means a mirrored feed or facing away)`,
  );
  return lines.join('\n');
}
