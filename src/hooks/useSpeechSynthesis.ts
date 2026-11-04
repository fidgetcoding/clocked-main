import { useCallback, useEffect } from 'react';
import { coachVoice, type SayOptions } from '@/lib/voice/coachVoice';
import { lineForText, type VoiceLine } from '@/lib/voice/lines';

type Speakable = string | VoiceLine;

const asLine = (what: Speakable): VoiceLine => (typeof what === 'string' ? lineForText(what) : what);

/**
 * The app's spoken voice. Says a line in the recorded coach voice when there's a clip for it and in the
 * browser's voice when there isn't. Says nothing while the voice is muted.
 */
export const useSpeechSynthesis = () => {
  // Call on a tap: browsers only start audio from one
  const initialize = useCallback(() => coachVoice.initialize(), []);

  /** Cuts off whatever is being said and says this. Returns false when nothing was said. */
  const speak = useCallback((what: Speakable, options: Omit<SayOptions, 'queued'> = {}) => coachVoice.say(asLine(what), options), []);

  /** Says this after whatever is being said. Returns false when nothing was said. */
  const speakQueued = useCallback(
    (what: Speakable, options: Omit<SayOptions, 'queued'> = {}) => coachVoice.say(asLine(what), { ...options, queued: true }),
    [],
  );

  /** Whether every piece of this has a recorded clip. */
  const isRecorded = useCallback((what: Speakable) => coachVoice.hasClips(asLine(what)), []);

  const cancel = useCallback(() => coachVoice.stop(), []);

  useEffect(() => {
    void coachVoice.loadManifest();
    return () => coachVoice.stop();
  }, []);

  return {
    initialize,
    speak,
    speakQueued,
    isRecorded,
    cancel,
    isAvailable: typeof window !== 'undefined' && 'speechSynthesis' in window,
  };
};

/** Gets the clips for this screen's lines ready ahead of time. */
export function useVoicePreload(ids: string[]) {
  const key = ids.join(' ');
  useEffect(() => {
    if (key) void coachVoice.preload(key.split(' '));
  }, [key]);
}
