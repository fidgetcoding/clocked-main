import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StartCheckResult } from '@/lib/punch/startCheck';

interface PunchPrefs {
  /** What the last start check saw. Stays in this browser. */
  lastStartCheck: StartCheckResult | null;
  setLastStartCheck: (result: StartCheckResult) => void;
  /** 0 means no timer. */
  roundSeconds: number;
  setRoundSeconds: (roundSeconds: number) => void;
}

export const usePunchPrefsStore = create<PunchPrefs>()(
  persist(
    (set) => ({
      lastStartCheck: null,
      setLastStartCheck: (lastStartCheck) => set({ lastStartCheck }),
      roundSeconds: 0,
      setRoundSeconds: (roundSeconds) => set({ roundSeconds }),
    }),
    { name: 'get-clocked-punch-prefs' },
  ),
);
