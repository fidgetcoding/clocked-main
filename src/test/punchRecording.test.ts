import { describe, expect, it } from 'vitest';
import {
  findReps,
  formatConfusion,
  formatRepScore,
  packLandmarks,
  parseRecording,
  RECORD_STEPS,
  RECORDING_FORMAT,
  replayRecording,
  scoreReps,
  type PunchRecording,
  type RecordLabel,
} from '@/lib/punch/recording';
import { LM } from '@/lib/punch/body';
import type { Landmark, Stance } from '@/lib/punch/types';
import { simulate, type HandName, type Shape } from './punchSynth';

const SHAPES: Record<Exclude<RecordLabel, 'guard'>, [HandName, Shape]> = {
  jab: ['lead', 'straight'],
  cross: ['rear', 'straight'],
  lead_hook: ['lead', 'hook'],
  rear_hook: ['rear', 'hook'],
  lead_uppercut: ['lead', 'uppercut'],
  rear_uppercut: ['rear', 'uppercut'],
};

/** A recording of a fighter doing what every prompt asks, three punches a step. */
function fakeRecording(stance: Stance, flipImage = false): PunchRecording {
  const segments: PunchRecording['segments'] = [];
  const punches = [];
  let at = 2000;
  for (const step of RECORD_STEPS) {
    const startT = at;
    if (step.label !== 'guard') {
      const [hand, shape] = SHAPES[step.label];
      for (let i = 0; i < 3; i += 1) {
        punches.push({ hand, shape, at: at + 500 + i * 1500 });
      }
      at += 5000;
    } else {
      at += 3000;
    }
    segments.push({ label: step.label, expected: step.label === 'guard' ? 0 : 3, startT, endT: at - 100 });
  }
  const frames = simulate({ stance, punches, startMs: 1000, durationMs: at }).map((frame) => {
    const landmarks = frame.landmarks as Landmark[];
    const image = landmarks.map((p, i) => ({
      x: (i === LM.LEFT_SHOULDER) !== flipImage ? 0.7 : 0.3,
      y: 0.5,
      z: 0,
      visibility: p.visibility,
    }));
    return { t: frame.t, image: packLandmarks(image), world: packLandmarks(landmarks) };
  });
  return {
    format: RECORDING_FORMAT,
    version: 1,
    createdAt: '2026-11-01T00:00:00.000Z',
    stance,
    video: { width: 640, height: 480 },
    segments,
    frames,
  };
}

describe('recording replay', () => {
  it.each<Stance>(['orthodox', 'southpaw'])('puts every punch on the diagonal, %s', (stance) => {
    const result = replayRecording(fakeRecording(stance));
    for (const row of result.rows) {
      if (row.label === 'guard') {
        expect(row.total).toBe(0);
      } else {
        expect(row.counts[row.label]).toBe(3);
        expect(row.total).toBe(3);
        expect(row.wrongHand).toBe(0);
      }
    }
    expect(result.accuracy).toBe(1);
    expect(result.outsideSteps).toBe(0);
    expect(result.leftOnImageRight).toBe(1);
  });

  it('shows the hand mix-up when the file was recorded under the wrong stance', () => {
    const recording = { ...fakeRecording('orthodox'), stance: 'southpaw' as const };
    const result = replayRecording(recording);
    const jabs = result.rows.find((row) => row.label === 'jab');
    expect(jabs?.counts.cross).toBe(3);
    expect(jabs?.wrongHand).toBe(3);
  });

  it('reports a mirrored feed', () => {
    expect(replayRecording(fakeRecording('orthodox', true)).leftOnImageRight).toBe(0);
  });

  it('prints a table with one row per step', () => {
    const table = formatConfusion(replayRecording(fakeRecording('orthodox')));
    for (const step of RECORD_STEPS) expect(table).toContain(step.label);
    expect(table).toContain('Labelled what was asked for: 100%');
  });

  it('survives a round trip through JSON', () => {
    const recording = fakeRecording('orthodox');
    expect(replayRecording(parseRecording(JSON.stringify(recording))).accuracy).toBe(1);
  });

  it('holds landmarks and nothing else', () => {
    const recording = fakeRecording('orthodox');
    expect(Object.keys(recording).sort()).toEqual(['createdAt', 'format', 'frames', 'segments', 'stance', 'version', 'video']);
    expect(Object.keys(recording.frames[0]).sort()).toEqual(['image', 't', 'world']);
    expect(recording.video).toEqual({ width: 640, height: 480 });
  });

  it('rejects other files', () => {
    expect(() => parseRecording('{"format":"something"}')).toThrow('clocked-punch-landmarks');
    expect(() => parseRecording(JSON.stringify({ format: RECORDING_FORMAT, frames: [], segments: [] }))).toThrow('stance');
  });

  it('prompts for all six punches', () => {
    expect(RECORD_STEPS.map((s) => s.label)).toEqual([
      'guard',
      'jab',
      'cross',
      'lead_hook',
      'rear_hook',
      'lead_uppercut',
      'rear_uppercut',
    ]);
  });

  it('finds reps from the prompted wrist alone, and scores odd and even apart', () => {
    const recording = fakeRecording('orthodox');
    const reps = findReps(recording, { leadInMs: 0 });
    const labels = ['jab', 'cross', 'lead_hook', 'rear_hook', 'lead_uppercut', 'rear_uppercut'];
    for (const label of labels) expect(reps.filter((rep) => rep.label === label)).toHaveLength(3);

    const result = replayRecording(recording);
    const punches = result.events.map((event) => event.punch);
    const odd = scoreReps(reps, punches, 'odd');
    const even = scoreReps(reps, punches, 'even');
    expect(odd.reps).toBe(12);
    expect(even.reps).toBe(6);
    expect(odd.accuracy).toBe(1);
    expect(even.accuracy).toBe(1);
    expect(even.extras).toBe(0);
    expect(formatRepScore(even)).toContain('even reps: 6 of 6 labelled what was asked for (100%)');
  });

  it('counts a wrong label as a miss and a second punch as an extra', () => {
    const reps = [{ label: 'jab' as const, index: 1, peakT: 100, startT: 0, endT: 200 }];
    const score = scoreReps(reps, [{ t: 50, punch: 'cross' }, { t: 60, punch: 'cross' }], 'all');
    expect(score.right).toBe(0);
    expect(score.extras).toBe(1);
    expect(score.rows[0].counts.cross).toBe(2);
  });
});
