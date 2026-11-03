import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { currentSession, LabRequestError, saveSpot, setSkipped, startSession, type SaveRequest } from '../../scripts/angle-lab-plugin';
import { readCamera, scoreRecording } from '@/lib/lab/angleScore';
import {
  ANGLE_SPOTS,
  clockHour,
  clockWords,
  moveFromPrevious,
  positionName,
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
  it('films a floor ring, a chair ring, then the two checks', () => {
    expect(ANGLE_SPOTS).toHaveLength(18);
    expect(ANGLE_SPOTS.map((spot) => spot.id)).toEqual(Array.from({ length: 18 }, (_, i) => String(i + 1)));
    expect(ANGLE_SPOTS.slice(0, 8).every((spot) => spot.height === 'floor')).toBe(true);
    expect(ANGLE_SPOTS.slice(8, 16).every((spot) => spot.height === 'chair')).toBe(true);
    expect(ANGLE_SPOTS[16]).toMatchObject({ angle: 45, height: 'chair', run: 'shove', check: 'swing' });
    expect(ANGLE_SPOTS[17]).toMatchObject({ angle: 0, height: 'chair', bag: 'none', run: 'full', check: 'no-bag' });
    expect(ANGLE_SPOTS.filter((spot) => spot.run === 'full').map((spot) => spot.id)).toEqual(['9', '18']);
    expect(new Set(ANGLE_SPOTS.map((spot) => spotFileName(spot, 'orthodox'))).size).toBe(18);
  });

  it('keeps the first take: front-left floor is still spot 1 with the same file name', () => {
    expect(spotFileName(spotById('1')!, 'orthodox')).toBe('01-front-left-floor-orthodox.json');
    expect(spotFileName(spotById('2')!, 'orthodox')).toBe('02-left-floor-orthodox.json');
  });

  it('goes round the circle from front-left in each ring', () => {
    const ring = ANGLE_SPOTS.slice(0, 8);
    expect(ring.map((spot) => positionName(spot.angle, 'orthodox'))).toEqual([
      'Front-left', 'Left', 'Back-left', 'Back', 'Back-right', 'Right', 'Front-right', 'Front',
    ]);
    expect(ANGLE_SPOTS.slice(8, 16).map((spot) => spot.angle)).toEqual(ring.map((spot) => spot.angle));
    expect(ring.map((spot) => clockWords(clockHour(spot.angle, 'orthodox')))).toEqual([
      '10:30', "9 o'clock", '7:30', "6 o'clock", '4:30', "3 o'clock", '1:30', "12 o'clock",
    ]);
    expect(moveFromPrevious(spotById('2')!, spotById('1')!)).toBe('Move the laptop.');
    expect(moveFromPrevious(spotById('9')!, spotById('8')!)).toBe('Move the laptop, and put it on the CHAIR from now on.');
    expect(moveFromPrevious(spotById('17')!, spotById('16')!)).toBe('Move the laptop.');
  });

  it('mirrors left and right for southpaw', () => {
    expect(positionName(45, 'southpaw')).toBe('Front-right');
    expect(positionName(-135, 'southpaw')).toBe('Back-left');
    expect(clockHour(45, 'southpaw')).toBe(1.5);
    expect(clockHour(180, 'southpaw')).toBe(6);
    expect(spotFileName(spotById('1')!, 'southpaw')).toBe('01-front-right-floor-southpaw.json');
  });

  it('says the side in body terms, with the clock and what to stand the laptop on', () => {
    expect(sideWords(45, 'orthodox')).toBe('diagonal, in front of you on your LEFT, your lead hand');
    expect(sideWords(-135, 'orthodox')).toBe('diagonal, behind you on your RIGHT, your rear hand');
    expect(sideWords(180, 'orthodox')).toBe('directly BEHIND you');
    expect(spotLines(spotById('1')!, 'orthodox')).toEqual([
      'Laptop diagonal, in front of you on your LEFT, your lead hand. 10:30, 6 feet away.',
      'On the FLOOR, screen tilted back so it sees all of you.',
      'Face the bag. The bag is at 12.',
    ]);
    expect(spotLines(spotById('8')!, 'orthodox')[0]).toBe("Laptop directly in FRONT of you, behind the bag. 12 o'clock, 6 feet away.");
    expect(spotLines(spotById('9')!, 'orthodox')[1]).toBe('On a CHAIR, about hip height.');
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

  const request = (session: string, spotId: string, recording = fakeRecording('orthodox')): SaveRequest => {
    const { score, camera } = scoreRecording(recording);
    return { session, row: { spotId, stance: 'orthodox', recordedAt: recording.createdAt, score, camera }, recording };
  };

  it('writes a file punch:confusion can read, and a grid summary', () => {
    const root = tempDir();
    const { name } = startSession(root, '2026-11-03', 'orthodox');
    const first = saveSpot(root, request(name, '1'));
    saveSpot(root, request(name, '18'));
    expect(first.path).toBe(join(root, '2026-11-03', '01-front-left-floor-orthodox.json'));
    expect(parseRecording(readFileSync(first.path, 'utf8')).frames.length).toBeGreaterThan(0);

    const summary = readFileSync(join(root, '2026-11-03', 'summary.md'), 'utf8');
    expect(summary).toContain('| Position | Floor | Chair | All heights |');
    expect(summary).toContain('| Front-left (10:30) | 100% · 100% · 0 | – | 100% · 100% |');
    expect(summary).toContain('| 18 | Front, no bag, chair | 6 of 6 | 6 | 0 | Camera in front of you. |');
    expect(summary).toContain('- 1. Front-left, floor: 100% counted, 100% named right, 0 false.');
  });

  it('carries on the same session in a later sitting, skips included', () => {
    const root = tempDir();
    const { name } = startSession(root, '2026-11-03', 'orthodox');
    saveSpot(root, request(name, '1'));
    setSkipped(root, name, '2', true);
    const later = currentSession(root)!;
    expect(later.name).toBe(name);
    expect(later.rows.map((row) => row.spotId)).toEqual(['1']);
    expect(later.skipped).toEqual(['2']);
    // Filming a skipped spot after all takes it off the skipped list
    expect(saveSpot(root, request(name, '2')).session.skipped).toEqual([]);
  });

  it('starts a second session the same day in its own folder', () => {
    const root = tempDir();
    startSession(root, '2026-11-03', 'orthodox');
    const second = startSession(root, '2026-11-03', 'southpaw');
    expect(second.name).toBe('2026-11-03-2');
    expect(currentSession(root)?.stance).toBe('southpaw');
  });

  it('replaces a spot\'s row on a redo', () => {
    const root = tempDir();
    const { name } = startSession(root, '2026-11-03', 'orthodox');
    saveSpot(root, request(name, '1'));
    const redo = saveSpot(root, request(name, '1', fakeRecording('orthodox', { guardPunches: 1 })));
    expect(redo.session.rows).toHaveLength(1);
    expect(redo.session.rows[0].score.falsePunches).toBe(1);
  });

  it('refuses anything that could write outside the folder', () => {
    const root = tempDir();
    const { name } = startSession(root, '2026-11-03', 'orthodox');
    expect(() => saveSpot(root, request('../../etc', '1'))).toThrow(LabRequestError);
    expect(() => saveSpot(root, request(name, '../1'))).toThrow(LabRequestError);
    expect(() => startSession(root, '../x', 'orthodox')).toThrow(LabRequestError);
    const bad = request(name, '1');
    expect(() => saveSpot(root, { ...bad, row: { ...bad.row, stance: 'southpaw' } })).toThrow(LabRequestError);
    expect(() => saveSpot(root, { ...bad, recording: { ...bad.recording, format: 'nope' } })).toThrow(LabRequestError);
    expect(() => setSkipped(root, name, '99', true)).toThrow(LabRequestError);
    expect(currentSession(tempDir())).toBeNull();
  });

  it('writes the grid even before any spot', () => {
    const summary = summaryMarkdown('2026-11-03', 'orthodox', [] as LabRow[]);
    expect(summary).toContain('| Back (6 o\'clock) | – | – | – |');
    expect(summary).toContain('- None yet.');
  });
});
