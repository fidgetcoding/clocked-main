/**
 * Shrinks a Punch Check landmark recording to what replaying it needs, gzipped, for a test fixture:
 * world landmarks only, and only the joints the tracker reads. Values stay as recorded, since
 * rounding them further moves a punch or two across a limit.
 *
 *   npx vite-node scripts/punch-fixture.ts in.json out.json.gz
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { LM } from '../src/lib/punch/body';
import { parseRecording, replayRecording } from '../src/lib/punch/recording';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('Usage: npx vite-node scripts/punch-fixture.ts in.json out.json.gz');
  process.exit(1);
}
const kept = new Set<number>(Object.values(LM));
const recording = parseRecording(readFileSync(input, 'utf8'));
const trimmed = {
  ...recording,
  lab: undefined,
  frames: recording.frames.map((frame) => ({
    t: frame.t,
    image: null,
    world: frame.world && frame.world.map((point, i) => (kept.has(i) ? point : [0, 0, 0, 0])),
  })),
};
const total = (file: typeof recording) => replayRecording(file).events.length;
const before = total(recording);
const after = total(trimmed as typeof recording);
writeFileSync(output, gzipSync(JSON.stringify(trimmed), { level: 9 }));
console.log(`${output}: ${before} punches before trimming, ${after} after`);
if (before !== after) process.exitCode = 1;
