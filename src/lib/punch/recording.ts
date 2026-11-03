import { BodyTracker, LM, dist, type Vec3 } from './body';
import { PUNCH_CONFIG, type PunchConfig } from './config';
import { PunchDetector } from './detector';
import type { FormIssue, PunchDetected, PunchClass, Landmark, Stance, Hand } from './types';

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

export const unpackLandmarks = (landmarks: PackedLandmark[] | null): Landmark[] | null =>
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

/** Which form cues fired in each step. Throw a known fault for a whole step to test that cue. */
export function formatCues(result: ReplayResult): string {
  return result.rows
    .map((row) => {
      const cues = Object.entries(row.cues).map(([cue, count]) => `${cue} ${count}`);
      return `${row.label.padEnd(15)}${String(row.total).padStart(3)} punches  ${cues.join(', ') || 'no cues'}`;
    })
    .join('\n');
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
  /** Form cues raised during this step, at the peak of a punch or after it. */
  cues: Partial<Record<FormIssue, number>>;
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
    cues: {},
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
    for (const event of detector.push({ t: frame.t, landmarks: unpackLandmarks(frame.world) })) {
      const index = recording.segments.findIndex((s) => event.t >= s.startT && event.t <= s.endT);
      const raised = event.type === 'punch' ? event.issues : [event.issue];
      if (index >= 0) for (const cue of raised) rows[index].cues[cue] = (rows[index].cues[cue] ?? 0) + 1;
      if (event.type !== 'punch') continue;
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

export interface PromptedRep {
  label: RecordLabel;
  /** Position within its step, from 1. Odd and even reps make a tuning set and a held-out set. */
  index: number;
  /** When the prompted wrist was farthest from rest. */
  peakT: number;
  startT: number;
  endT: number;
}

export interface RepOptions {
  /** How long before a step's first prompt to look, because people start on the prompt. */
  leadInMs?: number;
  minGapMs?: number;
  /** A rep's movement must reach this share of the step's typical peak movement. */
  minShare?: number;
}

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

/**
 * Finds the reps in each prompted step from how far the prompted wrist moves, without using the
 * detector, so that tuning the detector can't change what it is scored against.
 */
export function findReps(recording: PunchRecording, options: RepOptions = {}): PromptedRep[] {
  const { leadInMs = 3000, minGapMs = 550, minShare = 0.6 } = options;
  const tracker = new BodyTracker();
  const poses = recording.frames.flatMap((frame) => {
    const landmarks = unpackLandmarks(frame.world);
    const pose = landmarks && tracker.push(frame.t, landmarks);
    return pose ? [pose] : [];
  });
  const reps: PromptedRep[] = [];

  recording.segments.forEach((segment, segmentIndex) => {
    if (segment.label === 'guard') return;
    const hand = handOfLabel(segment.label);
    const side = (hand === 'lead') === (recording.stance === 'orthodox') ? 'left' : 'right';
    const previousEnd = recording.segments[segmentIndex - 1]?.endT ?? -Infinity;
    const windowStart = Math.max(segment.startT - leadInMs, previousEnd);
    // Both arms hanging means they're between steps, not punching
    const trace = poses
      .filter((pose) => pose.t >= windowStart && pose.t <= segment.endT)
      .filter((pose) => !(pose.left.wrist && pose.right.wrist && pose.left.wrist.y < -0.9 && pose.right.wrist.y < -0.9))
      .flatMap((pose) => {
        const wrist = pose[side].wrist;
        return wrist ? [{ t: pose.t, wrist }] : [];
      });
    if (trace.length === 0) return;
    const rest: Vec3 = {
      x: median(trace.map((p) => p.wrist.x)),
      y: median(trace.map((p) => p.wrist.y)),
      z: median(trace.map((p) => p.wrist.z)),
    };
    const signal = trace.map((p) => dist(p.wrist, rest));
    // The 90th percentile, because one tracking glitch can be far larger than any punch
    const typicalPeak = [...signal].sort((a, b) => a - b)[Math.floor(signal.length * 0.9)];
    const floor = Math.max(typicalPeak * minShare, 0.25);

    const peaks: number[] = [];
    let above = -1;
    const closeRun = (end: number) => {
      let best = above;
      for (let i = above; i < end; i += 1) if (signal[i] > signal[best]) best = i;
      const last = peaks[peaks.length - 1];
      if (last !== undefined && trace[best].t - trace[last].t < minGapMs) {
        if (signal[best] > signal[last]) peaks[peaks.length - 1] = best;
      } else {
        peaks.push(best);
      }
    };
    // A run touching either end of the window is the arms coming up or dropping between steps
    signal.forEach((value, i) => {
      if (value >= floor && above < 0) above = i;
      else if (value < floor * 0.7 && above >= 0) {
        if (above > 0) closeRun(i);
        above = -1;
      }
    });

    peaks.forEach((peak, i) => {
      const t = trace[peak].t;
      const before = i === 0 ? windowStart : (trace[peaks[i - 1]].t + t) / 2;
      const after = i === peaks.length - 1 ? segment.endT : (t + trace[peaks[i + 1]].t) / 2;
      reps.push({ label: segment.label, index: i + 1, peakT: t, startT: before, endT: after });
    });
  });
  return reps;
}

export type RepHalf = 'odd' | 'even' | 'all';

export interface RepScoreRow {
  label: RecordLabel;
  reps: number;
  /** Reps with at least one punch labelled what the prompt asked for. */
  right: number;
  counts: Record<PunchClass, number>;
  /** Punches beyond one per rep. */
  extras: number;
}

export interface RepScore {
  half: RepHalf;
  rows: RepScoreRow[];
  reps: number;
  right: number;
  extras: number;
  /** Reps labelled what was asked for, over reps. */
  accuracy: number;
}

/** Scores punches against reps. Each half is scored only on its own reps. */
export function scoreReps(reps: PromptedRep[], punches: Pick<PunchDetected, 't' | 'punch'>[], half: RepHalf): RepScore {
  const chosen = reps.filter((rep) => half === 'all' || (rep.index % 2 === 1) === (half === 'odd'));
  const rows: RepScoreRow[] = [];
  for (const rep of chosen) {
    let row = rows.find((candidate) => candidate.label === rep.label);
    if (!row) {
      row = {
        label: rep.label,
        reps: 0,
        right: 0,
        extras: 0,
        counts: { jab: 0, cross: 0, lead_hook: 0, rear_hook: 0, lead_uppercut: 0, rear_uppercut: 0, punch: 0 },
      };
      rows.push(row);
    }
    const inRep = punches.filter((punch) => punch.t >= rep.startT && punch.t < rep.endT);
    row.reps += 1;
    if (inRep.some((punch) => punch.punch === rep.label)) row.right += 1;
    row.extras += Math.max(0, inRep.length - 1);
    for (const punch of inRep) row.counts[punch.punch] += 1;
  }
  const total = rows.reduce((sum, row) => sum + row.reps, 0);
  const right = rows.reduce((sum, row) => sum + row.right, 0);
  return {
    half,
    rows,
    reps: total,
    right,
    extras: rows.reduce((sum, row) => sum + row.extras, 0),
    accuracy: total === 0 ? 0 : right / total,
  };
}

export function formatRepScore(score: RepScore): string {
  const lines = [
    `${score.half} reps: ${score.right} of ${score.reps} labelled what was asked for (${Math.round(score.accuracy * 100)}%), ${score.extras} extra punches`,
    ['asked for'.padEnd(15), 'right'.padStart(6), 'reps'.padStart(5), ...CONFUSION_COLUMNS.map((c) => NUMBERS[c].padStart(4)), 'extra'.padStart(7)].join(''),
  ];
  for (const row of score.rows) {
    lines.push(
      [
        row.label.padEnd(15),
        String(row.right).padStart(6),
        String(row.reps).padStart(5),
        ...CONFUSION_COLUMNS.map((c) => String(row.counts[c]).padStart(4)),
        String(row.extras).padStart(7),
      ].join(''),
    );
  }
  return lines.join('\n');
}
