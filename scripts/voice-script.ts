/**
 * Writes the coach voice recording script: every line the app says, with the file name to record it as.
 * Built from src/lib/voice/lines.ts, so it never drifts from what the app actually says.
 *
 *   npm run voice:script -- out.md
 *   npm run voice:script -- --read-sheet out.md   Just the lines for one long take, numbered, to read off
 */
import { writeFileSync } from 'node:fs';
import { VOICE_LINES, VOICE_SECTIONS } from '../src/lib/voice/lines';
import { TAKE_SECTIONS } from '../src/lib/voice/takeSplit';

const SAY: Record<string, string> = {
  'clock-3-2-1': 'Three, two, one',
  'rec-next': 'Next',
};

const HEADER = `# Clocked coach voice: recording script

Every line the app says out loud, ${VOICE_LINES.length} in all. Record each one and the app plays your voice instead of the robot. Any line you skip keeps the robot voice, so you can do them a few at a time.

## How to record

- Phone voice memo or any mic is fine. Quiet room, phone about a hand's width from your mouth.
- One file per line, named with its id: \`cue-hands-up.m4a\`. .m4a, .wav and .mp3 all work.
- Want variety? Say it again in a separate file: \`<id>-2\`, \`<id>-3\`. The app picks one at random each time.
- Coach energy, short and punchy. Don't leave a gap at the start or end; the import trims silence anyway.
- Put the files in one folder and run \`npm run voice:import -- <folder>\` in the repo. It converts them, adds them to the app and lists what's still missing.
- Or skip the file names: read the read sheet in one long take and run \`npm run voice:import -- --take <file>\`. One section at a time works too: \`--take <file> --section numbers\`. Fluffed a line? Say "again" and read it once more.

## How the long lines get built

Some lines are made from pieces, so you only record each piece once:

- **Combos** are the punch numbers and moves said in order. "1, 2, slip left, 2" plays \`num-1\`, \`num-2\`, \`move-slip-left\`, \`num-2\`. Say the numbers on their own, the way you'd call them in a combo.
- **Record mode steps** are \`rec-next\` then the step, so "Next. Throw 10 jabs" is \`rec-next\` + \`rec-jab\`. The count during a step is \`num-1\` to \`num-10\`.
- A line only plays in your voice when every piece of it is recorded. Otherwise the whole line uses the robot voice, so you never hear two voices in one sentence.
- Exercise names people type in themselves aren't on this list and always use the robot voice.
- The dev-only angle lab isn't on this list.
`;

const sections = VOICE_SECTIONS.map(({ section, title, about }) => {
  const lines = VOICE_LINES.filter((line) => line.section === section);
  const rows = lines.map((line) => `| \`${line.id}\` | ${SAY[line.id] ?? line.text} |`);
  return [`## ${title} (${lines.length})`, '', about, '', '| File id | Say |', '|---|---|', ...rows].join('\n');
});

/** The read sheet: the take's lines in order, numbered, and nothing else to trip over. */
function readSheet() {
  const take = TAKE_SECTIONS.map((section) => ({
    title: VOICE_SECTIONS.find((entry) => entry.section === section)!.title,
    lines: VOICE_LINES.filter((line) => line.section === section),
  }));
  const count = take.reduce((sum, section) => sum + section.lines.length, 0);
  let n = 0;
  const blocks = take.map(({ title, lines }, index) => {
    const rows = lines.map((line) => `## ${++n}. ${SAY[line.id] ?? line.text}`);
    const after = index < take.length - 1 ? 'then wait 3 seconds' : 'done';
    return [`*${title}* (${lines.length})`, '', ...rows, '', `*…${after}*`].join('\n');
  });
  const intro = `# Coach voice: read sheet

${count} lines, top to bottom, in one recording. **Wait 1 second between lines** and **3 seconds between sections**. Say each line in one breath, coach energy, and say *Three, two, one* quickly with no gaps. Fluffed one? Say **again**, then read that line once more. Or stop, and record that section again on its own.

Then run: \`npm run voice:import -- --take <file>\``;
  return { count, markdown: `${intro}\n\n${blocks.join('\n\n')}\n` };
}

const args = process.argv.slice(2);
const sheet = args.includes('--read-sheet');
const out = args.find((arg) => !arg.startsWith('--'));
const { count, markdown } = sheet ? readSheet() : { count: VOICE_LINES.length, markdown: `${HEADER}\n${sections.join('\n\n')}\n` };
if (out) {
  writeFileSync(out, markdown);
  console.log(`Wrote ${count} lines to ${out}`);
} else {
  process.stdout.write(markdown);
}
