import { describe, expect, it } from 'vitest';
import { dropRetakes, groupBySection, isRetakeWord, parseSilences, planTake, speechSpans, TAKE_SECTIONS, type TakeLine } from '@/lib/voice/takeSplit';
import { VOICE_LINES } from '@/lib/voice/lines';

const span = (start: number, end: number) => ({ start, end });
const line = (id: string, section: TakeLine['section'] = 'numbers'): TakeLine => ({ id, text: id, section });

describe('splitting a long take', () => {
  it('reads the silences ffmpeg reports, including one running to the end', () => {
    const log = [
      '[silencedetect @ 0x1] silence_start: -0.01',
      '[silencedetect @ 0x1] silence_end: 0.5 | silence_duration: 0.51',
      '[silencedetect @ 0x1] silence_start: 1.2',
      '[silencedetect @ 0x1] silence_end: 2.3 | silence_duration: 1.1',
      '[silencedetect @ 0x1] silence_start: 3',
    ].join('\n');
    expect(parseSilences(log)).toEqual([span(0, 0.5), span(1.2, 2.3), { start: 3, end: Infinity }]);
  });

  it('takes the talking between the silences and ignores clicks', () => {
    const spans = speechSpans([span(0, 0.5), span(1.2, 2.3), span(2.35, 3)], 4);
    expect(spans).toEqual([span(0.5, 1.2), span(3, 4)]);
  });

  it('starts a new section at a long pause', () => {
    expect(groupBySection([span(0, 1), span(2, 3), span(6, 7)], 2)).toEqual([[span(0, 1), span(2, 3)], [span(6, 7)]]);
  });

  it('maps lines to ids in order when the count matches', () => {
    const plan = planTake([span(0, 1), span(2, 3)], [line('num-1'), line('num-2')], 2);
    expect(plan.ok).toBe(true);
    expect(plan.clips).toEqual([
      { id: 'num-1', span: span(0, 1) },
      { id: 'num-2', span: span(2, 3) },
    ]);
  });

  it('refuses and says what it heard when a line is missing', () => {
    const plan = planTake([span(0, 1)], [line('num-1'), line('num-2')], 2);
    expect(plan.ok).toBe(false);
    expect(plan.clips).toEqual([]);
    expect(plan.report.join('\n')).toContain('Heard 1 line, expected 2.');
    expect(plan.report.join('\n')).toContain('(nothing heard)');
  });

  it('refuses a right total when a missed line in one section hides an extra in another', () => {
    const lines = [line('a', 'calibration'), line('b', 'calibration'), line('c', 'numbers')];
    const plan = planTake([span(0, 1), span(5, 6), span(7, 8)], lines, 2);
    expect(plan.ok).toBe(false);
    expect(plan.report.join('\n')).toContain('<-- off');
  });

  it('covers the six priority sections, 55 lines', () => {
    expect(VOICE_LINES.filter((entry) => TAKE_SECTIONS.includes(entry.section))).toHaveLength(55);
  });
});

describe('"again" retakes', () => {
  it('hears the word however whisper writes it', () => {
    expect(isRetakeWord(' Again.')).toBe(true);
    expect(isRetakeWord('again!')).toBe(true);
    expect(isRetakeWord('A gain')).toBe(true);
    expect(isRetakeWord('Ten')).toBe(false);
    expect(isRetakeWord('Hands up again')).toBe(false);
  });

  it('drops "again" and the fluffed line, keeping the retake', () => {
    const spans = [span(0, 1), span(2, 3), span(4, 4.4), span(5, 6)];
    const { spans: kept, retakes } = dropRetakes(spans, ['One', 'Tow', 'Again.', 'Two']);
    expect(retakes).toBe(1);
    expect(kept.map((entry) => entry.start)).toEqual([0, 5]);
  });

  it("doesn't turn the gap left by a retake into a section break", () => {
    const spans = [span(0, 1), span(2, 3), span(4, 4.4), span(5.5, 6.5)];
    const { spans: kept } = dropRetakes(spans, ['One', 'Tow', 'again', 'Two']);
    expect(groupBySection(kept, 2)).toHaveLength(1);
    const plan = planTake(kept, [line('num-1'), line('num-2')], 2);
    expect(plan.clips.map((clip) => [clip.id, clip.span.start])).toEqual([
      ['num-1', 0],
      ['num-2', 5.5],
    ]);
  });

  it('keeps the section break when the first line of a section is retaken', () => {
    const spans = [span(0, 1), span(4, 5), span(6, 6.4), span(7.5, 8.5)];
    const { spans: kept } = dropRetakes(spans, [undefined, 'Tow', 'again', 'Two']);
    expect(groupBySection(kept, 2)).toHaveLength(2);
  });
});
