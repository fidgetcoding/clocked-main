import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface VoicePrefs {
  /** The one switch for everything the app says out loud. Beeps and bells have their own settings. */
  voiceOn: boolean;
  setVoiceOn: (on: boolean) => void;
  toggleVoice: () => void;
}

/** Before this store, the switch lived on the local profile as voiceAnnouncements. Start from that. */
export function legacyVoiceOn(storage: Pick<Storage, 'getItem'> | undefined): boolean {
  try {
    const saved = storage?.getItem('get-clocked-user');
    if (!saved) return true;
    return JSON.parse(saved)?.state?.user?.preferences?.voiceAnnouncements !== false;
  } catch {
    return true;
  }
}

export const useVoiceStore = create<VoicePrefs>()(
  persist(
    (set) => ({
      voiceOn: legacyVoiceOn(typeof localStorage === 'undefined' ? undefined : localStorage),
      setVoiceOn: (voiceOn) => set({ voiceOn }),
      toggleVoice: () => set((state) => ({ voiceOn: !state.voiceOn })),
    }),
    { name: 'get-clocked-voice', partialize: (state) => ({ voiceOn: state.voiceOn }) },
  ),
);
