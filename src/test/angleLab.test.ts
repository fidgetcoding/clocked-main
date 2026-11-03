import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LabRequestError, saveSpot, sessionRows, type SaveRequest } from '../../scripts/angle-lab-plugin';
import { readCamera, scoreRecording } from '@/lib/lab/angleScore';
import {
  ANGLE_SPOTS,
  clockHour,
  clockWords,
  moveFromPrevious,
  sideWords,
  spotById,
  spotFileName,
  spotLines,
  summaryMarkdown,
  type LabRow,
} from '@/lib/lab/angleSpots';
import { packLandmarks, parseRecording, RECORDING_FORMAT, type PunchRecording, type RecordLabel } from '@/lib/punch/recording';
import type { Landmark, Stance } from '@/lib/punch/types';
import { simulate, type HandName, type Shape, type SynthPunch } from './punchSynth';

const SHAPES: Partial<Record<RecordLabel, [HandName, Shape]>> = { jab: ['lead', 'straight'], cross: ['rear', 'straight'] };

/** Stands in guard, then throws three jabs and three crosses. `swap` throws another punch for one asked; `guardPunches` jab during the guard. */
function fakeRecording(stance: Stance, { guardPunches = 0, swap = {} as Partial<Record<RecordLabel, RecordLabel>> } = {}): PunchRecording {
  const segments: PunchRecording['segments'] = [{ label: 'guard', expected: 0, startT: 1000, endT: 7000 }];
  const punches: SynthPunch[] = [];
  for (let i = 0; i < guardPunches; i += 1) punches.push({ hand: 'lead', shape: 'straight', at: 3000 + i * 1500 });
  let at = 7100;
  for (const label of ['jab', 'cross'] as const) {
    const [hand, shape] = SHAPES[swap[label] ?? label]!;
    for (let i = 0; i < 3; i += 1) punches.push({ hand, shape, at: at + 500 + i * 1500 });
    segments.push({ label, expected: 3, startT: at, endT: at + 4900 });
    at += 5000;
  }
  const frames = simulate({ stance, punches, startMs: 1000, durationMs: at }).map((frame) => {
    const world = frame.landmarks as Landmark[];
    const image = world.map((p) => ({ x: 0.5 + p.x * 0.5, y: 0.5 + p.y * 0.5, z: p.z, visibility: p.visibility ?? 1 }));
    return { t: frame.t, image: packLandmarks(image), world: packLandmarks(world) };
  });
  return { format: RECORDING_FORMAT, version: 1, createdAt: '2026-11-03T15:00:00.000Z', stance, video: { width: 640, height: 480 }, segments, frames };
}

describe('angle spots', () => {
  it('covers every spot in the handoff once', () => {
    expect(ANGLE_SPOTS.map((spot) => spot.id).sort()).toEqual(['1', '2', '3', '4', '5', '6a', '6b', '7', '8', '9']);
    expect(new Set(ANGLE_SPOTS.map((spot) => spot.slug)).size).toBe(ANGLE_SPOTS.length);
  });

  it('sweeps one way round, so the laptop never doubles back', () => {
    const hours = ANGLE_SPOTS.map((spot) => clockHour(spot.angle, 'orthodox'));
    const around = hours.map((hour) => (12 - hour + 12) % 12);
    for (let i = 1; i < around.length; i += 1) expect(around[i]).toBeGreaterThanOrEqual(around[i - 1]);
  });

  it('puts the lead side on the left for orthodox and mirrors it for southpaw', () => {
    expect(clockHour(60, 'orthodox')).toBe(10);
    expect(clockHour(60, 'southpaw')).toBe(2);
    expect(clockHour(-60, 'orthodox')).toBe(2);
    expect(clockHour(45, 'orthodox')).toBe(10.5);
    expect(clockHour(90, 'southpaw')).toBe(3);
    expect(clockHour(180, 'southpaw')).toBe(6);
    expect(clockHour(0, 'orthodox')).toBe(12);
    expect(clockWords(10.5)).toBe('between 10 and 11 o\'clock');
    expect(sideWords(60, 'orthodox')).toBe('60° to your lead-hand side, your left');
    expect(sideWords(60, 'southpaw')).toBe('60° to your lead-hand side, your right');
    expect(sideWords(-60, 'orthodox')).toBe('60° to your rear-hand side, your right');
  });

  it('says when the laptop can stay put', () => {
    const [two, eight, floor] = ['2', '8', '6a'].map((id) => spotById(id)!);
    expect(moveFromPrevious(eight, two)).toBe('The laptop stays where it is.');
    expect(moveFromPrevious(floor, eight)).toBe('Same spot. Only the height changes.');
    expect(spotLines(spotById('1')!, 'orthodox')[0]).toBe('Laptop at 6 o\'clock: directly behind you, 6 feet away.');
  });

  it('names files by filming order, slug and stance', () => {
    expect(spotFileName(ANGLE_SPOTS[0], 'orthodox')).toBe('01-front-no-bag-orthodox.json');
    expect(spotFileName(spotById('3')!, 'southpaw')).toBe('10-rear-60-hip-southpaw.json');
  });
});

describe('angle scoring', () => {
  it('counts a clean take as all right and no false punches', () => {
    const { score } = scoreRecording(fakeRecording('orthodox'));
    expect(score).toMatchObject({ expected: 6, counted: 6, right: 6, wrong: 0, unnamed: 0, falsePunches: 0, wrongHand: 0, seenShare: 1 });
  });

  it('scores a wrong name, and punches in the guard step as false', () => {
    const { score } = scoreRecording(fakeRecording('southpaw', { guardPunches: 2, swap: { jab: 'cross' } }));
    expect(score.falsePunches).toBe(2);
    expect(score.right).toBe(3);
    expect(score.wrong).toBe(3);
    expect(score.wrongHand).toBe(3);
  });

  it('reads the camera from the guard step', () => {
    const camera = readCamera(fakeRecording('orthodox'));
    expect(camera.gaveUp).toBe(false);
    expect(camera.side).toBe('front');
    expect(camera.says).toBe('Camera in front of you.');
  });

  it('gives up on a take with nobody in it', () => {
    const empty = { ...fakeRecording('orthodox'), frames: [] };
    expect(readCamera(empty).gaveUp).toBe(true);
    expect(scoreRecording(empty).score.seenShare).toBe(0);
  });
});

describe('angle lab saving', () => {
  const dirs: string[] = [];
  const tempDir = () => {
    const dir = mkdtempSync(join(tmpdir(), 'angle-lab-'));
    dirs.push(dir);
    return dir;
  };
  afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

  const request = (spotId: string, recording = fakeRecording('orthodox')): SaveRequest => {
    const { score, camera } = scoreRecording(recording);
    return { date: '2026-11-03', row: { spotId, stance: 'orthodox', recordedAt: recording.createdAt, score, camera }, recording };
  };

  it('writes a file punch:confusion can read, and a summary with every spot', () => {
    const root = tempDir();
    const first = saveSpot(root, request('9'));
    saveSpot(root, request('3'));
    expect(first.path).toBe(join(root, '2026-11-03', '01-front-no-bag-orthodox.json'));
    const saved = parseRecording(readFileSync(first.path, 'utf8'));
    expect(saved.frames.length).toBeGreaterThan(0);

    const summary = readFileSync(join(root, '2026-11-03', 'summary.md'), 'utf8');
    expect(summary).toContain('| 01 | 9 Front, no bag | orthodox | 6 of 6 | 6 | 0 | 0 | 0 | 0 | 100% | Camera in front of you. |');
    expect(summary).toContain('| 10 | 3 60° rear side, hip height |');
    expect(sessionRows(root, '2026-11-03').map((row) => row.file)).toEqual(['01-front-no-bag-orthodox.json', '10-rear-60-hip-orthodox.json']);
  });

  it('replaces a spot\'s row on a redo', () => {
    const root = tempDir();
    saveSpot(root, request('9'));
    const redo = saveSpot(root, request('9', fakeRecording('orthodox', { guardPunches: 1 })));
    expect(redo.rows).toHaveLength(1);
    expect(redo.rows[0].score.falsePunches).toBe(1);
  });

  it('refuses anything that could write outside the folder', () => {
    const root = tempDir();
    expect(() => saveSpot(root, { ...request('9'), date: '../../etc' })).toThrow(LabRequestError);
    expect(() => saveSpot(root, request('../9'))).toThrow(LabRequestError);
    const bad = request('9');
    expect(() => saveSpot(root, { ...bad, row: { ...bad.row, stance: 'x' as 'orthodox' } })).toThrow(LabRequestError);
    expect(() => saveSpot(root, { ...bad, recording: { ...bad.recording, format: 'nope' } })).toThrow(LabRequestError);
    expect(() => sessionRows(root, '../x')).toThrow(LabRequestError);
  });

  it('writes one table even before any spot', () => {
    expect(summaryMarkdown('2026-11-03', [] as LabRow[])).toContain('| # | Spot |');
  });
});
