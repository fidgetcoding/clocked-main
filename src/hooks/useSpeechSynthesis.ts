import { useCallback, useRef, useEffect } from 'react';

interface SpeechOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
}

export const useSpeechSynthesis = () => {
  const isInitialized = useRef(false);
  const voicesLoaded = useRef(false);

  // Initialize speech synthesis - call this on user interaction
  const initialize = useCallback(() => {
    if (isInitialized.current) return;
    
    if ('speechSynthesis' in window) {
      // Chrome requires getting voices first
      const loadVoices = () => {
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
          voicesLoaded.current = true;
        }
      };
      
      loadVoices();
      speechSynthesis.onvoiceschanged = loadVoices;
      
      // Warm up the speech engine with a silent utterance
      const warmUp = new SpeechSynthesisUtterance('');
      warmUp.volume = 0;
      speechSynthesis.speak(warmUp);
      
      isInitialized.current = true;
    }
  }, []);

  // Speak text with proper queue management
  const speak = useCallback((text: string, options: SpeechOptions = {}) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not available');
      return;
    }

    try {
      // Cancel any pending speech to avoid queue buildup
      speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = options.rate ?? 0.9;
      utterance.pitch = options.pitch ?? 1;
      utterance.volume = options.volume ?? 1;
      
      // Use default voice or first available
      const voices = speechSynthesis.getVoices();
      if (voices.length > 0) {
        // Prefer English voices
        const englishVoice = voices.find(v => v.lang.startsWith('en'));
        if (englishVoice) {
          utterance.voice = englishVoice;
        }
      }
      
      speechSynthesis.speak(utterance);
    } catch (error) {
      console.warn('Speech synthesis error:', error);
    }
  }, []);

  // Speak without canceling queue (for countdown sequences)
  const speakQueued = useCallback((text: string, options: SpeechOptions = {}) => {
    if (!('speechSynthesis' in window)) return;

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = options.rate ?? 0.9;
      utterance.pitch = options.pitch ?? 1;
      utterance.volume = options.volume ?? 1;
      speechSynthesis.speak(utterance);
    } catch (error) {
      console.warn('Speech synthesis error:', error);
    }
  }, []);

  // Cancel all pending speech
  const cancel = useCallback(() => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    initialize,
    speak,
    speakQueued,
    cancel,
    isAvailable: 'speechSynthesis' in window,
  };
};
