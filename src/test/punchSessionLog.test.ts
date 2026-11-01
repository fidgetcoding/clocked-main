import { describe, expect, it } from 'vitest';
import { PUNCH_CONFIG } from '@/lib/punch/config';
import { combosOf, parsePunchLog, PunchLogRecorder, withoutDetail } from '@/lib/punch/sessionLog';
import type { FormIssue, Hand, PunchClass, PunchDetected } from '@/lib/punch/types';

const GAP = PUNCH_CONFIG.combo.gapMs;

const punch = (id: number, t: number, kind: PunchClass, hand: Hand, issues: FormIssue[] = []): PunchDetected =>
  ({ type: 'punch', id, t, side: hand === 'lead' ? 'left' : 'right', hand, punch: kind, confidence: 1, issues, metrics: {} }) as PunchDetected;

const started = () => {
  const recorder = new PunchLogRecorder();
  recorder.markTracking();
  recorder.startRound(0, 1000);
  return recorder;
};

describe('PunchLogRecorder', () => {
  it('records each punch by type, hand and training time', () => {
    const recorder = started();
    recorder.record(punch(1, 1500, 'jab', 'lead'));
    recorder.record(punch(2, 1800, 'cross', 'rear'));
    const log = recorder.snapshot(5);
    expect(log.punches.map((p) => [p.t, p.punch, p.hand, p.side, p.round])).toEqual([
      [500, 'jab', 'lead', 'left', 1],
      [800, 'cross', 'rear', 'right', 1],
    ]);
    expect(log.totals).toMatchObject({ punches: 2, byHand: { lead: 1, rear: 1 }, cleanPercent: 100 });
    expect(log.totals.byType).toMatchObject({ jab: 1, cross: 1 });
    expect(log.durationSeconds).toBe(5);
  });

  it('leaves pauses out of the time, and makes each stretch a round', () => {
    const recorder = started();
    recorder.record(punch(1, 2000, 'jab', 'lead'));
    recorder.endRound(10);
    recorder.startRound(10, 500000);
    recorder.record(punch(2, 501000, 'cross', 'rear'));
    recorder.endRound(20);
    const log = recorder.snapshot(20);
    expect(log.punches[1]).toMatchObject({ t: 11000, round: 2 });
    expect(log.rounds).toEqual([
      { number: 1, startSeconds: 0, endSeconds: 10, punches: 1 },
      { number: 2, startSeconds: 10, endSeconds: 20, punches: 1 },
    ]);
  });

  it('groups combos by the gap between punches, and never across a round break', () => {
    const recorder = started();
    recorder.record(punch(1, 2000, 'jab', 'lead'));
    recorder.record(punch(2, 2000 + GAP, 'cross', 'rear'));
    recorder.record(punch(3, 2000 + 2 * GAP, 'lead_hook', 'lead'));
    recorder.record(punch(4, 2000 + 4 * GAP, 'jab', 'lead'));
    recorder.endRound(30);
    recorder.startRound(30, 2000 + 4 * GAP + 1);
    recorder.record(punch(5, 2000 + 4 * GAP + 2, 'cross', 'rear'));
    const log = recorder.snapshot(31);
    expect(log.combos.map((c) => c.sequence)).toEqual(['1-2-3']);
    expect(log.totals).toMatchObject({ combos: 1, longestCombo: 3 });
  });

  it('counts cues on a punch, cues that land late, and cues between punches', () => {
    const recorder = started();
    recorder.record(punch(1, 1100, 'jab', 'lead', ['other_hand_left_guard']));
    recorder.record(punch(2, 1200, 'cross', 'rear'));
    recorder.record({ type: 'form', t: 1300, punchId: 2, hand: 'rear', issue: 'slow_return' });
    recorder.record({ type: 'form', t: 1300, punchId: 2, hand: 'rear', issue: 'slow_return' });
    recorder.record(punch(3, 1400, 'cross', 'rear'));
    recorder.record({ type: 'form', t: 1500, punchId: null, hand: 'lead', issue: 'chin_exposed' });
    const log = recorder.snapshot(2);
    expect(log.punches[0].issues).toEqual(['other_hand_left_guard']);
    expect(log.punches[1].issues).toEqual(['slow_return']);
    expect(log.cues).toEqual([{ t: 500, round: 1, hand: 'lead', issue: 'chin_exposed' }]);
    expect(log.totals.cues).toEqual({ other_hand_left_guard: 1, slow_return: 1, chin_exposed: 1 });
    expect(log.totals).toMatchObject({ clean: 1, cleanPercent: 33 });
  });

  it('has nothing to keep if the camera never ran', () => {
    const recorder = new PunchLogRecorder();
    recorder.startRound(0, 0);
    expect(recorder.finish(60)).toBeNull();
  });

  it('keeps a log where the camera saw no punches', () => {
    const log = started().finish(60);
    expect(log).toMatchObject({ tracked: true, durationSeconds: 60, totals: { punches: 0, cleanPercent: null } });
  });

  it('carries on after being saved and restored through JSON', () => {
    const recorder = started();
    recorder.record(punch(1, 1100, 'jab', 'lead', ['chin_exposed']));
    const saved = parsePunchLog(JSON.parse(JSON.stringify(recorder.snapshot(7))));
    const restored = new PunchLogRecorder(saved);
    restored.markTracking();
    restored.startRound(7, 90000);
    restored.record(punch(1, 91000, 'cross', 'rear'));
    const log = restored.snapshot(9);
    expect(log.rounds.map((r) => [r.startSeconds, r.endSeconds, r.punches])).toEqual([
      [0, 7, 1],
      [7, null, 1],
    ]);
    expect(log.punches[1]).toMatchObject({ t: 8000, round: 2 });
    expect(log.totals).toMatchObject({ punches: 2, clean: 1, cleanPercent: 50 });
  });

  it('a snapshot does not change when the session carries on', () => {
    const recorder = started();
    recorder.record(punch(1, 1100, 'jab', 'lead'));
    const before = recorder.snapshot(1);
    recorder.record({ type: 'form', t: 1200, punchId: 1, hand: 'lead', issue: 'slow_return' });
    recorder.record(punch(2, 1300, 'jab', 'lead'));
    expect(before.punches).toHaveLength(1);
    expect(before.punches[0].issues).toEqual([]);
    expect(before.totals.punches).toBe(1);
  });

  it('stops keeping detail at the cap, with the totals still right', () => {
    const recorder = new PunchLogRecorder(null, PUNCH_CONFIG, 2);
    recorder.markTracking();
    recorder.startRound(0, 0);
    for (let id = 1; id <= 4; id++) recorder.record(punch(id, id * 10, 'jab', 'lead'));
    const log = recorder.snapshot(1);
    expect(log.punches).toHaveLength(2);
    expect(log.truncated).toBe(true);
    expect(log.totals.punches).toBe(4);
  });
});

describe('the stored log', () => {
  it('rejects anything that is not a log', () => {
    for (const bad of [null, 'x', {}, { version: 2 }, { version: 1, rounds: [] }]) expect(parsePunchLog(bad)).toBeNull();
  });

  it('withoutDetail keeps the totals', () => {
    const recorder = started();
    recorder.record(punch(1, 1100, 'jab', 'lead'));
    const slim = withoutDetail(recorder.snapshot(1));
    expect(slim.punches).toEqual([]);
    expect(slim.totals.punches).toBe(1);
    expect(parsePunchLog(slim)).not.toBeNull();
  });

  it('combosOf ignores a lone punch', () => {
    expect(combosOf([{ t: 0, punch: 'jab', hand: 'lead', side: 'left', round: 1, issues: [] }], GAP)).toEqual([]);
  });
});
