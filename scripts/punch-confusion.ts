/**
 * Replays a Punch Check landmark recording (/punch-check?record=1) through the classifier and
 * prints a confusion table, so thresholds can be tuned without throwing another punch.
 *
 *   npm run punch:confusion -- file.json
 *   npm run punch:confusion -- file.json --events
 *   npm run punch:confusion -- file.json --set classify.minArcEvidence=0.6
 *   npm run punch:confusion -- file.json --split    Scores odd and even reps separately. Tune on odd only.
 */
import { readFileSync } from 'node:fs';
import { PUNCH_CONFIG, type PunchConfig } from '../src/lib/punch/config';
import { findReps, formatConfusion, formatRepScore, parseRecording, replayRecording, scoreReps } from '../src/lib/punch/recording';

function withOverride(config: PunchConfig, assignment: string): PunchConfig {
  const [path, raw] = assignment.split('=');
  const value = Number(raw);
  if (!path || Number.isNaN(value)) throw new Error(`--set needs path=number, got "${assignment}"`);
  const copy = structuredClone(config) as unknown as Record<string, unknown>;
  const keys = path.split('.');
  let node = copy;
  for (const key of keys.slice(0, -1)) {
    if (typeof node[key] !== 'object' || node[key] === null) throw new Error(`No such setting: ${path}`);
    node = node[key] as Record<string, unknown>;
  }
  const last = keys[keys.length - 1];
  if (typeof node[last] !== 'number') throw new Error(`No such setting: ${path}`);
  node[last] = value;
  return copy as unknown as PunchConfig;
}

const args = process.argv.slice(2);
const file = args.find((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--set');
if (!file) {
  console.error('Usage: npm run punch:confusion -- file.json [--events] [--set path=number]');
  process.exit(1);
}

let config: PunchConfig = PUNCH_CONFIG;
args.forEach((arg, i) => {
  if (arg === '--set') {
    config = withOverride(config, args[i + 1] ?? '');
    console.log(`set ${args[i + 1]}`);
  }
});

const recording = parseRecording(readFileSync(file, 'utf8'));
const result = replayRecording(recording, config);

console.log(`${file}: ${recording.stance}, recorded ${recording.createdAt}\n`);
console.log(formatConfusion(result));

if (args.includes('--split')) {
  const reps = findReps(recording);
  const punches = result.events.map((event) => event.punch);
  for (const half of ['odd', 'even'] as const) console.log(`\n${formatRepScore(scoreReps(reps, punches, half))}`);
}

if (args.includes('--events')) {
  console.log('');
  for (const { label, punch } of result.events) {
    const m = punch.metrics;
    console.log(
      [
        `asked ${label ?? '-'}`.padEnd(22),
        `got ${punch.punch}`.padEnd(20),
        `${punch.hand}`.padEnd(5),
        `conf ${punch.confidence.toFixed(2)}`,
        `dist ${m.distance.toFixed(2)}`,
        `reach ${m.reach.toFixed(2)}`,
        `elbow ${Math.round(m.elbow)}`,
        `held ${Math.round(m.elbowHeldMax)}`,
        `opened ${Math.round(m.elbowOpening)}`,
        `across ${m.armAcross.toFixed(2)}`,
        `rise ${m.rise.toFixed(2)}`,
        `start ${m.startBelowShoulder.toFixed(2)}`,
        `fore ${Math.round(m.forearmFromVertical)}/${Math.round(m.forearmFromLevel)}`,
        `upper ${Math.round(m.upperArmBelowLevel)}`,
        `S ${m.scores.straight.toFixed(2)} H ${m.scores.hook.toFixed(2)} U ${m.scores.uppercut.toFixed(2)}`,
      ].join('  '),
    );
  }
}
