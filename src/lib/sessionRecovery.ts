import type { SessionLog } from '@/lib/sessionEffort';

// A running session, saved in this browser so a reload or a killed tab can pick it up again.
// Nothing here is awarded: XP still lands once, when the session finishes or gets logged.

const KEY = 'get-clocked-session';
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export const QUICK_SESSION_ID = 'quick-session';

export interface SessionSnapshot {
  userId: string;
  workoutId: string;
  /** A workout edited since the save has a different shape, so its snapshot no longer fits. */
  segmentCount: number;
  segmentIndex: number;
  timeRemaining: number;
  totalElapsed: number;
  isPreparation: boolean;
  /** XP from the clock only. Live badges are earned again on resume, which adds theirs back once. */
  timerXP: number;
  /** What the run has done so far, which decides its badges and credit. */
  log: SessionLog;
  /** The camera's punch log so far, read back through parsePunchLog. */
  punchLog?: unknown;
  isComplete: boolean;
  /** The id its history row gets. Logging again after a reload finds that row instead of adding another. */
  historyId?: string;
  savedAt: number;
}

const isSnapshot = (value: unknown): value is SessionSnapshot => {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.userId === 'string' &&
    typeof row.workoutId === 'string' &&
    ['segmentCount', 'segmentIndex', 'timeRemaining', 'totalElapsed', 'timerXP', 'savedAt'].every((field) =>
      Number.isFinite(row[field]),
    ) &&
    typeof row.log === 'object' &&
    row.log !== null &&
    typeof row.isPreparation === 'boolean' &&
    typeof row.isComplete === 'boolean'
  );
};

export function saveSession(snapshot: Omit<SessionSnapshot, 'savedAt'>, now = Date.now()): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...snapshot, savedAt: now }));
  } catch {
    // Storage can be full or blocked. The session keeps running, it just can't be recovered.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear if storage is blocked
  }
}

/** The saved session for this person, if one exists and isn't stale. */
export function findSavedSession(userId: string, now = Date.now()): SessionSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const saved: unknown = JSON.parse(raw);
    if (!isSnapshot(saved) || now - saved.savedAt > MAX_AGE_MS) {
      clearSession();
      return null;
    }
    return saved.userId === userId ? saved : null;
  } catch {
    clearSession();
    return null;
  }
}

/** The saved session for this exact workout. A snapshot that no longer fits it is thrown away. */
export function findResumableSession(userId: string, workoutId: string, segmentCount: number, now = Date.now()): SessionSnapshot | null {
  const saved = findSavedSession(userId, now);
  if (!saved || saved.workoutId !== workoutId) return null;
  if (saved.segmentCount !== segmentCount || saved.segmentIndex >= Math.max(segmentCount, 1)) {
    clearSession();
    return null;
  }
  return saved;
}

export function describeSavedSession(name: string, saved: SessionSnapshot): string {
  if (saved.isComplete) return `You finished ${name} but didn't log it.`;
  const minutes = Math.floor(saved.totalElapsed / 60);
  const seconds = String(saved.totalElapsed % 60).padStart(2, '0');
  return `You were ${minutes}:${seconds} into ${name}.`;
}
