import type { VoiceSection } from './lines';

/** A stretch of a recording, in seconds. */
export interface Span {
  start: number;
  end: number;
  /** For a retake: the pause before the take it replaced, so dropping the fluff doesn't look like a section break. */
  pauseBefore?: number;
}

/** The sections a single long take covers, in the order they're read. */
export const TAKE_SECTIONS: VoiceSection[] = ['calibration', 'numbers', 'moves', 'clock', 'segments', 'cues'];

/** Stretches shorter than this are a click or a breath, not a line. */
const MIN_SPEECH_S = 0.12;

/** The silences ffmpeg's silencedetect filter reports on stderr. */
export function parseSilences(log: string): Span[] {
  const silences: Span[] = [];
  let start: number | null = null;
  for (const line of log.split('\n')) {
    const opened = /silence_start: (-?[\d.]+)/.exec(line);
    if (opened) start = Math.max(0, Number(opened[1]));
    const closed = /silence_end: ([\d.]+)/.exec(line);
    if (closed && start !== null) {
      silences.push({ start, end: Number(closed[1]) });
      start = null;
    }
  }
  // Silence running to the end of the file never gets an end line
  if (start !== null) silences.push({ start, end: Infinity });
  return silences;
}

/** The talking: everything between the silences. */
export function speechSpans(silences: Span[], duration: number): Span[] {
  const spans: Span[] = [];
  let at = 0;
  for (const silence of [...silences].sort((a, b) => a.start - b.start)) {
    if (silence.start - at >= MIN_SPEECH_S) spans.push({ start: at, end: silence.start });
    at = Math.max(at, silence.end);
  }
  if (duration - at >= MIN_SPEECH_S) spans.push({ start: at, end: duration });
  return spans;
}

/** Splits the talking into sections wherever the pause between two lines is at least `gap` seconds. */
export function groupBySection(spans: Span[], gap: number): Span[][] {
  const groups: Span[][] = [];
  spans.forEach((span, index) => {
    if (index === 0 || (span.pauseBefore ?? span.start - spans[index - 1].end) >= gap) groups.push([]);
    groups[groups.length - 1].push(span);
  });
  return groups;
}

/** The retake word: said straight after a fluffed line, before reading it again. */
export function isRetakeWord(heard: string): boolean {
  return /^\W*(again|a gain)\W*$/i.test(heard.trim());
}

/**
 * Drops each "again" and the line just before it, so the line read after "again" takes that line's place.
 * `heard` is what was transcribed for each span (undefined where it wasn't checked).
 */
export function dropRetakes(spans: Span[], heard: (string | undefined)[]): { spans: Span[]; retakes: number } {
  const kept: Span[] = [];
  let retakes = 0;
  let pending: number | undefined;
  spans.forEach((span, index) => {
    if (isRetakeWord(heard[index] ?? '')) {
      const fluffed = kept.pop();
      if (fluffed) {
        retakes++;
        const before = kept[kept.length - 1];
        pending = fluffed.pauseBefore ?? (before ? fluffed.start - before.end : undefined);
      }
      return;
    }
    kept.push(pending === undefined ? span : { ...span, pauseBefore: pending });
    pending = undefined;
  });
  return { spans: kept, retakes };
}

export interface TakeLine {
  id: string;
  text: string;
  section: VoiceSection;
}

export interface TakePlan {
  ok: boolean;
  clips: { id: string; span: Span }[];
  /** What was heard where, for when the count is off. */
  report: string[];
}

const at = (span: Span) => `${span.start.toFixed(2)}–${span.end.toFixed(2)}s`;

/**
 * Matches the lines heard in a take to the lines it should hold, in order. Refuses unless the counts
 * agree, since one missed or extra line would shift every clip after it onto the wrong id.
 */
export function planTake(spans: Span[], lines: TakeLine[], sectionGap: number): TakePlan {
  const report: string[] = [];
  const sections = [...new Set(lines.map((line) => line.section))];
  const groups = groupBySection(spans, sectionGap);

  if (sections.length > 1) {
    report.push(`Heard ${groups.length} section${groups.length === 1 ? '' : 's'} (pauses of ${sectionGap}s or more), expected ${sections.length}.`);
    groups.forEach((group, index) => {
      const section = sections[index];
      const expected = section ? lines.filter((line) => line.section === section).length : 0;
      const mark = group.length === expected ? '' : '  <-- off';
      report.push(`  ${section ?? '(extra)'}: heard ${group.length}, expected ${expected}, ${at({ start: group[0].start, end: group[group.length - 1].end })}${mark}`);
    });
  }

  report.push(`Heard ${spans.length} line${spans.length === 1 ? '' : 's'}, expected ${lines.length}.`);
  const rows = Math.max(spans.length, lines.length);
  for (let i = 0; i < rows; i++) {
    const span = spans[i];
    const line = lines[i];
    report.push(
      `  ${String(i + 1).padStart(2)}  ${span ? `${at(span)} (${(span.end - span.start).toFixed(2)}s)`.padEnd(24) : '(nothing heard)'.padEnd(24)}  ${line ? `${line.id}  "${line.text}"` : '(no line left)'}`,
    );
  }

  const sectionsOff =
    sections.length > 1 &&
    groups.length === sections.length &&
    groups.some((group, index) => group.length !== lines.filter((line) => line.section === sections[index]).length);
  // Right total but the sections disagree: a missed line and an extra one, somewhere. Don't guess
  if (spans.length !== lines.length || sectionsOff) return { ok: false, clips: [], report };
  return { ok: true, clips: lines.map((line, i) => ({ id: line.id, span: spans[i] })), report };
}
