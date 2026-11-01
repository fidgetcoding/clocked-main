import { beforeEach, describe, expect, it } from 'vitest';
import { FRESH_SESSION } from '@/lib/sessionEffort';
import { clearSession, findResumableSession, findSavedSession, saveSession } from '@/lib/sessionRecovery';

// jsdom's localStorage isn't available under this Node
const stored = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => void stored.set(key, value),
    removeItem: (key: string) => void stored.delete(key),
    clear: () => stored.clear(),
  },
});

const snapshot = {
  userId: 'me',
  workoutId: 'w1',
  segmentCount: 8,
  segmentIndex: 3,
  timeRemaining: 42,
  totalElapsed: 300,
  isPreparation: false,
  timerXP: 75,
  log: FRESH_SESSION,
  isComplete: false,
};
const now = 1_000_000_000;
const HOUR = 60 * 60 * 1000;

describe('session recovery', () => {
  beforeEach(() => localStorage.clear());

  it('gives back what was saved', () => {
    saveSession(snapshot, now);
    expect(findResumableSession('me', 'w1', 8, now + HOUR)).toEqual({ ...snapshot, savedAt: now });
  });

  it('is gone after a clear', () => {
    saveSession(snapshot, now);
    clearSession();
    expect(findSavedSession('me', now)).toBeNull();
  });

  it('never hands one person another person\'s session, and leaves it in place', () => {
    saveSession(snapshot, now);
    expect(findSavedSession('someone-else', now)).toBeNull();
    expect(findSavedSession('me', now)).not.toBeNull();
  });

  it('ignores another workout without throwing the save away', () => {
    saveSession(snapshot, now);
    expect(findResumableSession('me', 'w2', 8, now)).toBeNull();
    expect(findSavedSession('me', now)).not.toBeNull();
  });

  it('throws away a save once the workout was edited', () => {
    saveSession(snapshot, now);
    expect(findResumableSession('me', 'w1', 5, now)).toBeNull();
    expect(findSavedSession('me', now)).toBeNull();
  });

  it('throws away a save older than 12 hours', () => {
    saveSession(snapshot, now);
    expect(findSavedSession('me', now + 12 * HOUR)).not.toBeNull();
    expect(findSavedSession('me', now + 12 * HOUR + 1)).toBeNull();
  });

  it('survives junk in storage', () => {
    for (const junk of ['not json', '{}', 'null', JSON.stringify({ ...snapshot, savedAt: now, timerXP: 'lots' })]) {
      localStorage.setItem('get-clocked-session', junk);
      expect(findSavedSession('me', now)).toBeNull();
      expect(localStorage.getItem('get-clocked-session')).toBeNull();
    }
  });

  it('allows a Quick Session, which has no segments', () => {
    saveSession({ ...snapshot, workoutId: 'quick-session', segmentCount: 0, segmentIndex: 0 }, now);
    expect(findResumableSession('me', 'quick-session', 0, now)).not.toBeNull();
  });
});
