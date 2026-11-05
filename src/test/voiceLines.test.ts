import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildManifest, clipFileName, matchRecording } from '@/lib/voice/importNames';
import { comboLine, lineForText, lineIds, lineText, numberLine, VOICE_LINES, VOICE_SECTIONS, voiceLine } from '@/lib/voice/lines';
import { Calibration, CALIBRATION_PUNCHES, PUNCH_WAIT_MS, voiceLine as calibrationSays } from '@/lib/punch/calibration';
import { RECORD_STEPS } from '@/lib/punch/recording';
import { cueFor } from '@/lib/punch/round';
import { legacyVoiceOn } from '@/stores/voiceStore';

const IDS = new Set(VOICE_LINES.map((line) => line.id));

describe('the voice lines', () => {
  it('have unique ids and unique words', () => {
    expect(IDS.size).toBe(VOICE_LINES.length);
    const words = VOICE_LINES.map((line) => line.text.toLowerCase().replace(/[^a-z0-9]/g, ''));
    expect(new Set(words).size).toBe(words.length);
  });

  it('use ids that are safe file names', () => {
    for (const id of IDS) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('every line belongs to a section the script lists', () => {
    const sections = new Set(VOICE_SECTIONS.map((entry) => entry.section));
    for (const line of VOICE_LINES) expect(sections.has(line.section)).toBe(true);
  });

  it('cover everything calibration can say', () => {
    const calibration = new Calibration();
    const said = new Set<string>();
    const listen = () => {
      const line = calibrationSays(calibration.view());
      if (line) said.add(line);
    };
    calibration.begin();
    calibration.skipStep();
    listen();
    calibration.skipStep();
    let t = 0;
    for (const _punch of CALIBRATION_PUNCHES) {
      listen();
      t += PUNCH_WAIT_MS + 1;
      calibration.push(t, 'ok', null, null);
      listen();
      calibration.skipPunch();
    }
    listen();
    // The guard, each punch, a miss and the end
    expect(said.size).toBe(CALIBRATION_PUNCHES.length + 3);
    for (const line of said) expect(lineForText(line)[0].id).not.toBeNull();
    expect(lineForText('Hands up. Hold still.')[0].id).toBe('cal-hands-up-hold-still');
    expect(lineForText('Throw a lead uppercut')[0].id).toBe('cal-throw-a-lead-uppercut');
    expect(lineForText("Didn't see it")[0].id).toBe('cal-didnt-see-it');
    expect(lineForText('Looked like a rear hook')[0].id).toBe('cal-looked-like-a-rear-hook');
  });

  it('cover every record-mode prompt and every form cue', () => {
    for (const step of RECORD_STEPS) expect(VOICE_LINES.some((line) => line.text === step.prompt)).toBe(true);
    const issues = ['other_hand_left_guard', 'slow_return', 'chin_exposed', 'arm_not_extended', 'elbow_flare', 'no_rotation'] as const;
    for (const issue of issues) for (const hand of ['lead', 'rear'] as const) expect(lineForText(cueFor(issue, hand))[0].id).not.toBeNull();
  });

  it('cover every phrase the workout screen says as a fixed string', () => {
    const source = readFileSync('src/lib/session/flattenWorkout.ts', 'utf8');
    const body = source.slice(source.indexOf('function segmentAnnouncement'), source.indexOf('function segmentCallout'));
    const said = [...body.matchAll(/(?:return|\?|:) '([^']+)'/g)].map((match) => match[1]);
    expect(said).toContain('Speed Bag Freestyle');
    for (const text of said) expect(lineForText(text)[0].id).not.toBeNull();
  });

  it('match spoken text loosely, by its letters and numbers', () => {
    expect(lineForText('Pushups')).toEqual([{ id: 'ex-push-ups', text: 'Pushups' }]);
    expect(lineForText('doubles')[0].id).toBe('drill-doubles');
    expect(lineForText('Something typed in')).toEqual([{ id: null, text: 'Something typed in' }]);
  });

  it('build combos from numbers and moves', () => {
    expect(lineIds(comboLine(['1', '2', 'SLIP L', 'ROLL R', '3']))).toEqual(['num-1', 'num-2', 'move-slip-left', 'move-roll-right', 'num-3']);
    expect(lineIds(comboLine(['JAB', 'CROSS', 'SL', '↺']))).toEqual(['num-1', 'num-2', 'move-slip-left', 'move-circle-left']);
    expect(lineIds(comboLine(['Doubles', 'Triples']))).toEqual(['drill-doubles', 'drill-triples']);
    expect(comboLine(['made up'])).toEqual([{ id: null, text: 'made up' }]);
    expect(lineText(comboLine(['1', '2', 'SLIP L']))).toBe('One, Two, Slip left');
  });

  it('count to ten in clips, and past it in the browser voice', () => {
    expect(lineIds(numberLine(10))).toEqual(['num-10']);
    expect(numberLine(11)).toEqual([{ id: null, text: '11' }]);
  });

  it('read a calibration step as one sentence', () => {
    expect(lineText(voiceLine('rec-next', 'rec-lead-hook'))).toBe('Next. Throw 10 lead hooks');
    expect(() => voiceLine('nope')).toThrow();
  });
});

describe('importing recordings', () => {
  it('matches file names to lines and takes', () => {
    expect(matchRecording('cue-hands-up.m4a', IDS)).toEqual({ id: 'cue-hands-up', take: 1 });
    expect(matchRecording('cue-hands-up-2.m4a', IDS)).toEqual({ id: 'cue-hands-up', take: 2 });
    expect(matchRecording('Cue_Hands Up-3.WAV', IDS)).toEqual({ id: 'cue-hands-up', take: 3 });
    expect(matchRecording('num-1.mp3', IDS)).toEqual({ id: 'num-1', take: 1 });
    expect(matchRecording('num-1-2.mp3', IDS)).toEqual({ id: 'num-1', take: 2 });
    expect(matchRecording('clock-3-2-1.m4a', IDS)).toEqual({ id: 'clock-3-2-1', take: 1 });
    expect(matchRecording('clock-3-2-1-2.m4a', IDS)).toEqual({ id: 'clock-3-2-1', take: 2 });
    expect(matchRecording('New Recording 4.m4a', IDS)).toBeNull();
    expect(matchRecording('cue-hands-up.txt', IDS)).toBeNull();
  });

  it('names the converted clips', () => {
    expect(clipFileName({ id: 'seg-rest', take: 1 })).toBe('seg-rest.m4a');
    expect(clipFileName({ id: 'seg-rest', take: 2 })).toBe('seg-rest-2.m4a');
  });

  it('builds the manifest from the coach folder, takes in order', () => {
    expect(buildManifest(['seg-rest-2.m4a', 'manifest.json', 'seg-rest.m4a', 'num-1.m4a', 'stray.m4a', 'num-2.wav'], IDS)).toEqual({
      version: 1,
      clips: { 'num-1': ['num-1.m4a'], 'seg-rest': ['seg-rest.m4a', 'seg-rest-2.m4a'] },
    });
  });

  it('the shipped manifest only names clips that exist', () => {
    const manifest = JSON.parse(readFileSync('public/voice/coach/manifest.json', 'utf8'));
    expect(manifest.version).toBe(1);
    for (const files of Object.values(manifest.clips) as string[][]) for (const file of files) expect(() => readFileSync(`public/voice/coach/${file}`)).not.toThrow();
  });
});

describe('the voice setting', () => {
  const storage = (value: unknown) => ({ getItem: () => (value === undefined ? null : JSON.stringify(value)) });

  it('starts from the old Voice Announcements setting', () => {
    expect(legacyVoiceOn(storage({ state: { user: { preferences: { voiceAnnouncements: false } } } }))).toBe(false);
    expect(legacyVoiceOn(storage({ state: { user: { preferences: { voiceAnnouncements: true } } } }))).toBe(true);
    expect(legacyVoiceOn(storage(undefined))).toBe(true);
    expect(legacyVoiceOn({ getItem: () => '{not json' })).toBe(true);
    expect(legacyVoiceOn(undefined)).toBe(true);
  });
});
