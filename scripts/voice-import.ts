// Turns Nate's recordings into the app's coach voice clips. Needs ffmpeg.
//
//   npm run voice:import -- <folder>                          One file per line, named by id
//   npm run voice:import -- --take <file> --section numbers   One long take of one section, read in order
//   npm run voice:import -- --take <file>                     One long take of the first six read-sheet sections
//
// Sections: calibration, numbers, moves, clock, segments, cues (the long take), then coach, record,
// speedbag and exercises, each a take of its own.
//
// A take is split on the pauses between lines. If the number of lines heard doesn't match the
// section, nothing is written and it lists what it heard where. Options for a take:
//   --gap <s>          Shortest pause between lines (default 0.6)
//   --section-gap <s>  Shortest pause between sections in a full take (default 2)
//   --noise <dB>       Anything quieter counts as silence (default -40)
//
// Fluffed a line? Say "again" and read it once more; the retake replaces it. This needs whisper-cli
// (brew install whisper-cpp) and an English model at ~/.whisper/ggml-base.en.bin, or set WHISPER_MODEL.
//
// Every clip is trimmed of silence at both ends, evened out in loudness, written as a small .m4a to
// public/voice/coach/, and the manifest is rebuilt.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VOICE_LINES } from '../src/lib/voice/lines';
import { buildManifest, clipFileName, matchRecording } from '../src/lib/voice/importNames';
import { dropRetakes, parseSilences, planTake, sectionArg, SOLO_SECTIONS, speechSpans, takeSections, TAKE_SECTIONS, type Span } from '../src/lib/voice/takeSplit';

// VOICE_OUT_DIR is for trying the importer on test speech without touching the app's clips
const OUT_DIR = path.resolve(process.env.VOICE_OUT_DIR ?? 'public/voice/coach');
// Trim from the front, flip, trim what was the end, flip back, then normalise to a spoken-word loudness
const FILTER = [
  'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05',
  'areverse',
  'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08',
  'areverse',
  'loudnorm=I=-16:TP=-1.5:LRA=11',
].join(',');
const ENCODE = ['-ac', '1', '-ar', '44100', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart'];
// A little either side of what silencedetect calls speech, so soft starts and ends aren't clipped
const PAD_BEFORE_S = 0.08;
const PAD_AFTER_S = 0.15;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** Converts one recording, or one stretch of one, into a clip. Returns an error message on failure. */
function convert(input: string, out: string, span?: Span): string | null {
  const cut = span ? ['-ss', Math.max(0, span.start - PAD_BEFORE_S).toFixed(3), '-t', (span.end - span.start + PAD_BEFORE_S + PAD_AFTER_S).toFixed(3)] : [];
  try {
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', input, ...cut, '-af', FILTER, ...ENCODE, out], { stdio: ['ignore', 'ignore', 'pipe'] });
    return null;
  } catch (error) {
    return String((error as { stderr?: Buffer }).stderr ?? error).trim();
  }
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) fail(`${name} needs a value`);
  return value;
}

function importFolder(folder: string) {
  const ids = new Set(VOICE_LINES.map((line) => line.id));
  const imported: string[] = [];
  const unmatched: string[] = [];
  const failed: string[] = [];
  for (const file of walk(path.resolve(folder))) {
    const match = matchRecording(path.basename(file), ids);
    if (!match) {
      if (!path.basename(file).startsWith('.')) unmatched.push(path.basename(file));
      continue;
    }
    const error = convert(file, path.join(OUT_DIR, clipFileName(match)));
    if (error) failed.push(`${path.basename(file)}: ${error}`);
    else imported.push(clipFileName(match));
  }
  console.log(`Imported ${imported.length} recording${imported.length === 1 ? '' : 's'} into public/voice/coach/.`);
  if (unmatched.length) console.log(`\nNot a line id, skipped (${unmatched.length}):\n  ${unmatched.join('\n  ')}`);
  if (failed.length) console.log(`\nffmpeg couldn't read (${failed.length}):\n  ${failed.join('\n  ')}`);
}

function duration(file: string): number {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const seconds = Number(out.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) fail(`Couldn't read how long ${file} is.`);
  return seconds;
}

// Only short stretches could be the one word "again"
const RETAKE_MAX_S = 1.2;
const WHISPER_MODELS = [process.env.WHISPER_MODEL, path.join(os.homedir(), '.whisper/ggml-base.en.bin'), path.join(os.homedir(), '.whisper/ggml-small.en.bin')];

/** Listens to each short stretch for "again". Returns null when whisper isn't set up. */
function transcribeShort(take: string, spans: Span[]): (string | undefined)[] | null {
  const model = WHISPER_MODELS.find((file) => file && existsSync(file));
  if (!model || spawnSync('whisper-cli', ['--help'], { stdio: 'ignore' }).error) return null;
  const dir = mkdtempSync(path.join(os.tmpdir(), 'voice-take-'));
  try {
    return spans.map((span, index) => {
      if (span.end - span.start > RETAKE_MAX_S) return undefined;
      const wav = path.join(dir, `${index}.wav`);
      const cut = ['-ss', Math.max(0, span.start - PAD_BEFORE_S).toFixed(3), '-t', (span.end - span.start + PAD_BEFORE_S + PAD_AFTER_S).toFixed(3)];
      execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', take, ...cut, '-ac', '1', '-ar', '16000', wav]);
      const run = spawnSync('whisper-cli', ['-m', model, '-f', wav, '-nt', '-np', '-l', 'en'], { encoding: 'utf8' });
      return run.status === 0 ? run.stdout.trim() : undefined;
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function importTake(take: string, section: string | undefined, args: string[]) {
  if (!existsSync(take) || !statSync(take).isFile()) fail(`No file at ${take}`);
  const sections = takeSections(section);
  if (!sections) fail(`--section is one of: ${[...TAKE_SECTIONS, ...SOLO_SECTIONS].map(sectionArg).join(', ')}, all`);
  const gap = Number(option(args, '--gap') ?? 0.6);
  const sectionGap = Number(option(args, '--section-gap') ?? 2);
  const noise = Number(option(args, '--noise') ?? -40);
  if (![gap, sectionGap, noise].every(Number.isFinite)) fail('--gap, --section-gap and --noise take numbers');

  const lines = sections.flatMap((name) => VOICE_LINES.filter((line) => line.section === name));
  const detect = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', take, '-af', `silencedetect=noise=${noise}dB:d=${gap}`, '-f', 'null', '-'], { encoding: 'utf8' });
  if (detect.status !== 0) fail(`ffmpeg couldn't read ${take}:\n${detect.stderr.trim()}`);
  let spans = speechSpans(parseSilences(detect.stderr), duration(take));
  if (spans.length > lines.length) {
    const heard = transcribeShort(take, spans);
    if (heard) {
      const result = dropRetakes(spans, heard);
      if (result.retakes) console.log(`Heard "again" ${result.retakes} time${result.retakes === 1 ? '' : 's'}; kept the retake each time.`);
      spans = result.spans;
    } else console.log('More lines than expected. To use "again" retakes, install whisper-cli and a model (see the top of scripts/voice-import.ts).');
  }
  const plan = planTake(spans, lines, sectionGap);

  if (!plan.ok) {
    console.error(`Nothing imported: the take doesn't line up with the ${sections.length === 1 ? `${sectionArg(sections[0])} lines` : 'read sheet'}.\n`);
    console.error(plan.report.join('\n'));
    console.error(
      '\nRe-record the section, or if a pause inside a line split it in two, try --gap 0.8. If two lines ran together, leave a longer pause between them.',
    );
    process.exit(1);
  }

  const failed: string[] = [];
  for (const clip of plan.clips) {
    const error = convert(take, path.join(OUT_DIR, `${clip.id}.m4a`), clip.span);
    if (error) failed.push(`${clip.id}: ${error}`);
  }
  console.log(`Imported ${plan.clips.length - failed.length} lines from ${path.basename(take)} (${sections.map(sectionArg).join(', ')}).`);
  if (failed.length) console.log(`\nffmpeg couldn't cut (${failed.length}):\n  ${failed.join('\n  ')}`);
}

function main() {
  const args = process.argv.slice(2);
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  } catch {
    fail('ffmpeg is not installed. On a Mac: brew install ffmpeg');
  }
  mkdirSync(OUT_DIR, { recursive: true });

  const take = option(args, '--take');
  if (take) importTake(take, option(args, '--section'), args);
  else if (args[0] && existsSync(args[0]) && statSync(args[0]).isDirectory()) importFolder(args[0]);
  else fail('Usage: npm run voice:import -- <folder>   or   npm run voice:import -- --take <file> [--section <name>]');

  const ids = new Set(VOICE_LINES.map((line) => line.id));
  const manifest = buildManifest(readdirSync(OUT_DIR), ids);
  writeFileSync(path.join(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const missing = VOICE_LINES.filter((line) => !manifest.clips[line.id]);
  console.log(`\n${VOICE_LINES.length - missing.length} of ${VOICE_LINES.length} lines have a clip.`);
  if (missing.length) {
    console.log(`Still missing (${missing.length}), these use the browser voice:`);
    for (const line of missing) console.log(`  ${line.id.padEnd(28)}${line.text}`);
  }
}

main();
