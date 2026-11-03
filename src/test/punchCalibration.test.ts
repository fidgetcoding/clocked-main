import { describe, expect, it } from 'vitest';
import {
  Calibration,
  CALIBRATION_PUNCHES,
  PUNCH_WAIT_MS,
  SEEN_HOLD_MS,
  SETUP_HOLD_MS,
  promptFor,
  stepLine,
  tallyLine,
  tipFor,
  voiceLine,
  type CalibrationStep,
} from '@/lib/punch/calibration';
import { FRAMING_MESSAGES } from '@/lib/punch/framing';
import { describeCamera, expectedQuality, placementAdvice, type StartCheckResult } from '@/lib/punch/startCheck';
import type { PunchClass, PunchDetected } from '@/lib/punch/types';
import { simulate } from './punchSynth';

const punchEvent = (punch: PunchClass, t: number, issues: PunchDetected['issues'] = []): PunchDetected =>
  ({ type: 'punch', id: t, t, side: 'left', hand: 'lead', punch, confidence: 0.9, issues, metrics: {} as PunchDetected['metrics'] });

/** Walks a calibration through setup and the guard hold, into the punches. */
function toPunches() {
  const calibration = new Calibration();
  calibration.begin();
  let t = 0;
  for (; calibration.current === 'setup' && t <= SETUP_HOLD_MS * 2; t += 33) calibration.push(t, 'ok', null, null);
  expect(calibration.current).toBe('guard');
  let finished = false;
  for (const frame of simulate({ durationMs: 6000, startMs: t })) {
    t = frame.t;
    finished = calibration.push(t, 'ok', frame.landmarks, frame.landmarks) || finished;
    if (calibration.current === 'punches') break;
  }
  expect(finished).toBe(true);
  return { calibration, t };
}

describe('calibration', () => {
  it('waits on the choice, and skipping ends it straight away', () => {
    const calibration = new Calibration();
    expect(calibration.current).toBe('choose');
    calibration.push(0, 'ok', null, null);
    expect(calibration.current).toBe('choose');
    calibration.skip();
    expect(calibration.done).toBe(true);
    expect(calibration.view().skipped).toBe(true);
  });

  it('passes setup only once the framing has held good', () => {
    const calibration = new Calibration();
    calibration.begin();
    calibration.push(0, 'out_of_frame', null, null);
    expect(calibration.view().framing).toBe('out_of_frame');
    calibration.push(500, 'ok', null, null);
    calibration.push(500 + SETUP_HOLD_MS / 2, 'ok', null, null);
    expect(calibration.view().setupProgress).toBeCloseTo(0.5);
    // A problem starts the hold over
    calibration.push(600 + SETUP_HOLD_MS / 2, 'too_far', null, null);
    calibration.push(700 + SETUP_HOLD_MS, 'ok', null, null);
    expect(calibration.current).toBe('setup');
    calibration.push(700 + SETUP_HOLD_MS * 2, 'ok', null, null);
    expect(calibration.current).toBe('guard');
  });

  it('can skip setup and the guard hold', () => {
    const calibration = new Calibration();
    calibration.begin();
    calibration.skipStep();
    expect(calibration.current).toBe('guard');
    calibration.skipStep();
    expect(calibration.current).toBe('punches');
    expect(calibration.checkResult).toBeNull();
  });

  it('reads the camera during the guard hold', () => {
    const { calibration } = toPunches();
    const result = calibration.checkResult!;
    expect(result.gaveUp).toBe(false);
    expect(result.cameraSide).toBe('front');
    expect(calibration.view().stepIndex).toBe(0);
  });

  it('confirms a punch it saw, then moves to the next one', () => {
    const { calibration, t } = toPunches();
    calibration.onPunch(punchEvent('jab', t + 100));
    expect(calibration.view().steps[0].status).toBe('seen');
    // Further punches while "Got it" is up don't change it
    calibration.onPunch(punchEvent('cross', t + 200));
    expect(calibration.view().steps[0].status).toBe('seen');
    calibration.push(t + 100 + SEEN_HOLD_MS, 'ok', null, null);
    expect(calibration.view().stepIndex).toBe(1);
  });

  it('accepts an unnamed punch, since some spots only count', () => {
    const { calibration, t } = toPunches();
    calibration.onPunch(punchEvent('punch', t + 100));
    expect(calibration.view().steps[0].status).toBe('unnamed');
    expect(stepLine(calibration.view().steps[0])).toMatch(/won't name/);
  });

  it('says what it saw instead, with a tip, and allows a retry', () => {
    const { calibration, t } = toPunches();
    calibration.onPunch(punchEvent('lead_hook', t + 100, ['other_hand_left_guard']));
    const step = calibration.view().steps[0];
    expect(step.status).toBe('wrong');
    expect(step.seenAs).toBe('lead_hook');
    expect(step.tip).toBe('Keep the other hand up.');
    expect(stepLine(step)).toBe('Looked like a lead hook.');
    calibration.retryPunch();
    expect(calibration.view().steps[0]).toMatchObject({ status: 'waiting', tip: null });
    // A right one after a wrong one still counts
    calibration.onPunch(punchEvent('jab', t + 300));
    expect(calibration.view().steps[0].status).toBe('seen');
  });

  it("says it didn't see one after a wait, with a tip, and a late punch still counts", () => {
    const { calibration, t } = toPunches();
    calibration.push(t + PUNCH_WAIT_MS, 'ok', null, null);
    const step = calibration.view().steps[0];
    expect(step.status).toBe('missed');
    expect(step.tip).toMatch(/fully extended/);
    calibration.onPunch(punchEvent('jab', t + PUNCH_WAIT_MS + 500));
    expect(calibration.view().steps[0].status).toBe('seen');
  });

  it('gives the framing problem as the tip when that is why it missed', () => {
    const { calibration, t } = toPunches();
    calibration.push(t + PUNCH_WAIT_MS, 'low_confidence', null, null);
    expect(calibration.view().steps[0].tip).toBe(FRAMING_MESSAGES.low_confidence);
  });

  it('skips punches through to the result, then finishes', () => {
    const { calibration, t } = toPunches();
    calibration.onPunch(punchEvent('jab', t + 10));
    calibration.push(t + 10 + SEEN_HOLD_MS, 'ok', null, null);
    for (let i = 1; i < CALIBRATION_PUNCHES.length; i += 1) calibration.skipPunch();
    expect(calibration.current).toBe('result');
    expect(tallyLine(calibration.view().steps)).toBe('Saw 1 of 6 punches.');
    calibration.finish();
    expect(calibration.done).toBe(true);
    expect(calibration.view().skipped).toBe(false);
  });

  it('starts over from setup', () => {
    const { calibration, t } = toPunches();
    calibration.onPunch(punchEvent('jab', t + 10));
    calibration.restart();
    expect(calibration.current).toBe('setup');
    expect(calibration.checkResult).toBeNull();
    expect(calibration.view().steps.every((step) => step.status === 'waiting')).toBe(true);
  });

  it('asks for each punch in the Punch Check set, in order', () => {
    expect(CALIBRATION_PUNCHES.map(promptFor)).toEqual([
      'Throw a jab',
      'Throw a cross',
      'Throw a lead hook',
      'Throw a rear hook',
      'Throw a lead uppercut',
      'Throw a rear uppercut',
    ]);
  });

  it('only changes its key when the screen would change', () => {
    const calibration = new Calibration();
    calibration.begin();
    const before = calibration.key();
    calibration.push(0, 'ok', null, null);
    calibration.push(10, 'ok', null, null);
    expect(calibration.key()).toBe(before);
    calibration.push(SETUP_HOLD_MS / 2, 'ok', null, null);
    expect(calibration.key()).not.toBe(before);
  });
});

describe('calibration wording', () => {
  const step = (status: CalibrationStep['status'], seenAs: PunchClass | null = null): CalibrationStep => ({ punch: 'cross', status, seenAs, tip: null });

  it('speaks the prompt, then the outcome', () => {
    const calibration = new Calibration();
    expect(voiceLine(calibration.view())).toBeNull();
    calibration.begin();
    calibration.skipStep();
    expect(voiceLine(calibration.view())).toBe('Hands up. Hold still.');
    calibration.skipStep();
    expect(voiceLine(calibration.view())).toBe('Throw a jab');
    calibration.onPunch(punchEvent('jab', 1));
    expect(voiceLine(calibration.view())).toBe('Got it');
  });

  it('has tips for every punch, and the fault comes first', () => {
    for (const punch of CALIBRATION_PUNCHES) expect(tipFor(punch).length).toBeGreaterThan(10);
    expect(tipFor('jab', punchEvent('jab', 0, ['arm_not_extended']))).toBe('Throw it fully extended.');
    expect(tipFor('lead_hook', punchEvent('jab', 0, ['arm_not_extended']))).toMatch(/elbow up/);
  });

  it('never talks in the first person', () => {
    const base: StartCheckResult = {
      framed: true, headCut: false, legsCut: false, scale: 0.3, cameraAngle: 0, cameraSide: 'front', cameraHeight: 'level', stance: null, guard: null, gaveUp: false, shaky: false, seenShare: 1, handsHidden: false,
    };
    const results: StartCheckResult[] = [
      base,
      { ...base, gaveUp: true },
      { ...base, cameraSide: 'behind' },
      { ...base, cameraSide: 'side_left' },
      { ...base, cameraHeight: 'low' },
      { ...base, framed: false },
    ];
    const lines = [
      ...results.flatMap((result) => [describeCamera(result), expectedQuality(result), placementAdvice(result) ?? '']),
      ...(['waiting', 'seen', 'unnamed', 'wrong', 'missed', 'skipped'] as const).map((status) => stepLine(step(status, 'jab'))),
      ...CALIBRATION_PUNCHES.map((punch) => tipFor(punch)),
      ...Object.values(FRAMING_MESSAGES),
    ];
    for (const line of lines) expect(line).not.toMatch(/\bI\b|\bI'm\b|\bI'll\b|\bme\b/);
  });
});
