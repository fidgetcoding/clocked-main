// npm run voice:import -- <folder of recordings>
// Matches each recording to a voice line by file name, trims the silence at both ends, evens out the
// loudness, writes a small .m4a to public/voice/coach/ and rebuilds the manifest. Needs ffmpeg.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { VOICE_LINES } from '../src/lib/voice/lines';
import { buildManifest, clipFileName, matchRecording } from '../src/lib/voice/importNames';

const OUT_DIR = path.resolve('public/voice/coach');
// Trim from the front, flip, trim what was the end, flip back, then normalise to a spoken-word loudness
const FILTER = [
  'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05',
  'areverse',
  'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08',
  'areverse',
  'loudnorm=I=-16:TP=-1.5:LRA=11',
].join(',');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function main() {
  const folder = process.argv[2];
  if (!folder || !existsSync(folder) || !statSync(folder).isDirectory()) {
    console.error('Usage: npm run voice:import -- <folder of recordings>');
    process.exit(1);
  }
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  } catch {
    console.error('ffmpeg is not installed. On a Mac: brew install ffmpeg');
    process.exit(1);
  }

  const ids = new Set(VOICE_LINES.map((line) => line.id));
  mkdirSync(OUT_DIR, { recursive: true });

  const imported: string[] = [];
  const unmatched: string[] = [];
  const failed: string[] = [];
  for (const file of walk(path.resolve(folder))) {
    const match = matchRecording(path.basename(file), ids);
    if (!match) {
      if (!path.basename(file).startsWith('.')) unmatched.push(path.basename(file));
      continue;
    }
    const out = path.join(OUT_DIR, clipFileName(match));
    try {
      execFileSync(
        'ffmpeg',
        ['-y', '-v', 'error', '-i', file, '-af', FILTER, '-ac', '1', '-ar', '44100', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', out],
        { stdio: ['ignore', 'ignore', 'pipe'] },
      );
      imported.push(clipFileName(match));
    } catch (error) {
      failed.push(`${path.basename(file)}: ${String((error as { stderr?: Buffer }).stderr ?? error).trim()}`);
    }
  }

  const manifest = buildManifest(readdirSync(OUT_DIR), ids);
  writeFileSync(path.join(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  const missing = VOICE_LINES.filter((line) => !manifest.clips[line.id]);
  console.log(`Imported ${imported.length} recording${imported.length === 1 ? '' : 's'} into public/voice/coach/.`);
  if (unmatched.length) console.log(`\nNot a line id, skipped (${unmatched.length}):\n  ${unmatched.join('\n  ')}`);
  if (failed.length) console.log(`\nffmpeg couldn't read (${failed.length}):\n  ${failed.join('\n  ')}`);
  console.log(`\n${VOICE_LINES.length - missing.length} of ${VOICE_LINES.length} lines have a clip.`);
  if (missing.length) {
    console.log(`Still missing (${missing.length}), these use the browser voice:`);
    for (const line of missing) console.log(`  ${line.id.padEnd(28)}${line.text}`);
  }
}

main();
