import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Stance } from '@/lib/punch/types';

interface PunchPrefs {
  stance: Stance;
  /** 0 means no timer. */
  roundSeconds: number;
  voiceCues: boolean;
  setStance: (stance: Stance) => void;
  setRoundSeconds: (roundSeconds: number) => void;
  setVoiceCues: (voiceCues: boolean) => void;
}

export const usePunchPrefsStore = create<PunchPrefs>()(
  persist(
    (set) => ({
      stance: 'orthodox',
      roundSeconds: 0,
      voiceCues: false,
      setStance: (stance) => set({ stance }),
      setRoundSeconds: (roundSeconds) => set({ roundSeconds }),
      setVoiceCues: (voiceCues) => set({ voiceCues }),
    }),
    { name: 'get-clocked-punch-prefs' },
  ),
);
