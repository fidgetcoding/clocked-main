import { startOfWeek, subWeeks } from 'date-fns';

export interface WeekTotals {
  sessions: number;
  seconds: number;
  xp: number;
}

export interface WeeklyTape {
  thisWeek: WeekTotals;
  lastWeek: WeekTotals;
  /** False until something has been logged in either week, so nothing is compared against nothing. */
  hasTape: boolean;
}

interface Entry {
  completed_at: string;
  duration: number;
  xp_earned: number;
}

const empty = (): WeekTotals => ({ sessions: 0, seconds: 0, xp: 0 });

/** This calendar week against the last one, Monday to Sunday, from what's actually in the log. */
export function weeklyTape(history: Entry[], now: Date = new Date()): WeeklyTape {
  const thisStart = startOfWeek(now, { weekStartsOn: 1 }).getTime();
  const lastStart = subWeeks(new Date(thisStart), 1).getTime();
  const thisWeek = empty();
  const lastWeek = empty();
  for (const entry of history) {
    const at = new Date(entry.completed_at).getTime();
    const week = at >= thisStart ? thisWeek : at >= lastStart ? lastWeek : null;
    if (!week) continue;
    week.sessions += 1;
    week.seconds += entry.duration || 0;
    week.xp += entry.xp_earned || 0;
  }
  return { thisWeek, lastWeek, hasTape: thisWeek.sessions + lastWeek.sessions > 0 };
}

export const tapeHours = (seconds: number) => {
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}`;
};
