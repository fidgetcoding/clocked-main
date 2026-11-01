import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PunchPrefs {
  /** 0 means no timer. */
  roundSeconds: number;
  voiceCues: boolean;
  /** Camera on during Quick Session. On unless they turn it off. */
  quickSessionCamera: boolean;
  /** Camera on during workouts. Off unless they turn it on. */
  workoutCamera: boolean;
  setRoundSeconds: (roundSeconds: number) => void;
  setVoiceCues: (voiceCues: boolean) => void;
  setQuickSessionCamera: (on: boolean) => void;
  setWorkoutCamera: (on: boolean) => void;
}

export const usePunchPrefsStore = create<PunchPrefs>()(
  persist(
    (set) => ({
      roundSeconds: 0,
      voiceCues: false,
      quickSessionCamera: true,
      workoutCamera: false,
      setRoundSeconds: (roundSeconds) => set({ roundSeconds }),
      setVoiceCues: (voiceCues) => set({ voiceCues }),
      setQuickSessionCamera: (quickSessionCamera) => set({ quickSessionCamera }),
      setWorkoutCamera: (workoutCamera) => set({ workoutCamera }),
    }),
    { name: 'get-clocked-punch-prefs' },
  ),
);
