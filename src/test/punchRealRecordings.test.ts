import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { scoreReplay } from '@/lib/lab/angleScore';
import { PUNCH_CONFIG, type PunchConfig } from '@/lib/punch/config';
import { parseRecording, replayRecording } from '@/lib/punch/recording';

/**
 * Real takes replayed through the detector. The angle tests are Nate shadowboxing in front of a
 * laptop webcam on 2026-11-03, orthodox, three of each punch per spot (ten at front-left chair), from
 * the floor looking up and from a chair at about hip height. The mannequin is a rendered figure
 * through the real pose model, ten of each punch, straight on. Trimmed with scripts/punch-fixture.ts.
 *
 * Bounds are loose on purpose: they catch a return of the over-counting, not one punch either way.
 */
const load = (name: string) =>
  parseRecording(gunzipSync(readFileSync(join(process.cwd(), 'src/test/fixtures/punch', `${name}.json.gz`))).toString('utf8'));

const score = (name: string, config: PunchConfig = PUNCH_CONFIG) => scoreReplay(replayRecording(load(name), config));

interface Expectation {
  name: string;
  asked: number;
  counted: [number, number];
  minNamed: number;
  maxFalse: number;
}

const SPOTS: Expectation[] = [
  // Was 35 of 18 before moves were judged against the fighter's usual punch
  { name: '08-front-floor', asked: 18, counted: [15, 21], minNamed: 12, maxFalse: 1 },
  // Was 30
  { name: '07-front-right-floor', asked: 18, counted: [15, 23], minNamed: 8, maxFalse: 2 },
  // Was 31
  { name: '06-right-floor', asked: 18, counted: [15, 23], minNamed: 0, maxFalse: 3 },
  { name: '16-front-chair', asked: 18, counted: [15, 21], minNamed: 15, maxFalse: 2 },
  { name: '15-front-right-chair', asked: 18, counted: [15, 21], minNamed: 6, maxFalse: 1 },
  // Was 79 of 60
  { name: '09-front-left-chair', asked: 60, counted: [52, 68], minNamed: 3, maxFalse: 6 },
  // From behind it already misses some. This must not get worse.
  { name: '12-back-chair', asked: 18, counted: [13, 20], minNamed: 0, maxFalse: 1 },
  { name: 'mannequin-front', asked: 60, counted: [56, 64], minNamed: 33, maxFalse: 0 },
];

describe('real recordings', () => {
  it.each(SPOTS)('$name counts close to what was asked', ({ name, asked, counted, minNamed, maxFalse }) => {
    const result = score(name);
    expect(result.expected).toBe(asked);
    expect(result.counted).toBeGreaterThanOrEqual(counted[0]);
    expect(result.counted).toBeLessThanOrEqual(counted[1]);
    expect(result.right).toBeGreaterThanOrEqual(minNamed);
    expect(result.falsePunches).toBeLessThanOrEqual(maxFalse);
  });

  it('counts next to nothing with the hands held up and no punches', () => {
    const result = score('17-swing-check');
    expect(result.counted).toBe(0);
    expect(result.falsePunches).toBeLessThanOrEqual(1);
  });

  it('over-counts from the floor without the check against the usual punch', () => {
    const off = structuredClone(PUNCH_CONFIG) as unknown as { typical: { minShare: number } };
    off.typical.minShare = 0;
    expect(score('08-front-floor', off as unknown as PunchConfig).counted).toBeGreaterThanOrEqual(30);
  });
});
