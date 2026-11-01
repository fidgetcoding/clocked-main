import { describe, expect, it } from 'vitest';
import { tapeHours, weeklyTape } from '@/lib/weeklyTape';

const now = new Date('2026-11-04T12:00:00'); // A Wednesday
const entry = (completed_at: string, duration = 600, xp_earned = 50) => ({ completed_at, duration, xp_earned });

describe('weeklyTape', () => {
  it('has nothing to compare for someone new', () => {
    expect(weeklyTape([], now).hasTape).toBe(false);
  });

  it('splits on Monday and ignores anything older', () => {
    const tape = weeklyTape(
      [entry('2026-11-02T00:30:00'), entry('2026-11-01T23:30:00'), entry('2026-10-26T01:00:00'), entry('2026-10-25T23:00:00')],
      now,
    );
    expect(tape.thisWeek.sessions).toBe(1);
    expect(tape.lastWeek).toEqual({ sessions: 2, seconds: 1200, xp: 100 });
    expect(tape.hasTape).toBe(true);
  });

  it('writes time the way the tape shows it', () => {
    expect(tapeHours(600)).toBe('10m');
    expect(tapeHours(9600)).toBe('2h 40');
  });
});
