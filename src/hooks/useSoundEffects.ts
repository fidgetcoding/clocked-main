import { useCallback, useRef } from 'react';
import { useUserStore } from '@/stores/userStore';

// Audio context singleton
let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

export const useSoundEffects = () => {
  const user = useUserStore((state) => state.user);
  const prefs = user?.preferences as Record<string, any> | undefined;
  
  // Individual toggles (no master toggle - each sound controls itself)
  const soundEnabled = prefs?.soundEnabled !== false;
  const tenSecondWarningEnabled = prefs?.tenSecondWarning !== false;
  
  const lastPlayedRef = useRef<number>(0);

  // Play a subtle XP gain sound (short, soft blip)
  const playXPSound = useCallback(() => {
    if (!soundEnabled) return;
    
    // Debounce to prevent rapid-fire sounds
    const now = Date.now();
    if (now - lastPlayedRef.current < 100) return;
    lastPlayedRef.current = now;

    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Subtle high-pitched blip
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
      oscillator.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.05); // E6

      // Very quick fade in/out for subtlety
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.warn('Failed to play XP sound:', e);
    }
  }, [soundEnabled]);

  // Warning beep (two short beeps) - for 10-second warning
  const playWarningBeep = useCallback(() => {
    if (!soundEnabled || !tenSecondWarningEnabled) return;

    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      
      // Two beeps at 1000Hz
      [0, 0.15].forEach((delay) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(1000, now + delay);

        gainNode.gain.setValueAtTime(0, now + delay);
        gainNode.gain.linearRampToValueAtTime(0.1, now + delay + 0.01);
        gainNode.gain.linearRampToValueAtTime(0.1, now + delay + 0.08);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.1);

        oscillator.start(now + delay);
        oscillator.stop(now + delay + 0.1);
      });
    } catch (e) {
      console.warn('Failed to play warning beep:', e);
    }
  }, [soundEnabled, tenSecondWarningEnabled]);

  // Play a triumphant level-up sound (ascending arpeggio)
  const playLevelUpSound = useCallback(() => {
    if (!soundEnabled) return;

    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Create a triumphant ascending arpeggio
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (major chord)
      const noteLength = 0.12;
      const overlap = 0.08;

      notes.forEach((freq, index) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(freq, ctx.currentTime);

        const startTime = ctx.currentTime + index * (noteLength - overlap);
        const peakTime = startTime + 0.02;
        const endTime = startTime + noteLength + 0.1;

        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.15, peakTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, endTime);

        oscillator.start(startTime);
        oscillator.stop(endTime);
      });

      // Add a final sustained chord for impact
      setTimeout(() => {
        const chordNotes = [523.25, 659.25, 783.99, 1046.50];
        chordNotes.forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime);

          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.5);
        });
      }, notes.length * (noteLength - overlap) * 1000);
    } catch (e) {
      console.warn('Failed to play level up sound:', e);
    }
  }, [soundEnabled]);

  return {
    playXPSound,
    playLevelUpSound,
    playWarningBeep,
  };
};

// Standalone functions for use outside of React components
export const playSoundEffect = {
  xp: () => {
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') ctx.resume();

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.05);

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.warn('Failed to play XP sound:', e);
    }
  },

  levelUp: () => {
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') ctx.resume();

      const notes = [523.25, 659.25, 783.99, 1046.50];
      const noteLength = 0.12;
      const overlap = 0.08;

      notes.forEach((freq, index) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(freq, ctx.currentTime);

        const startTime = ctx.currentTime + index * (noteLength - overlap);
        const peakTime = startTime + 0.02;
        const endTime = startTime + noteLength + 0.1;

        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.15, peakTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, endTime);

        oscillator.start(startTime);
        oscillator.stop(endTime);
      });

      // Final sustained chord
      setTimeout(() => {
        const chordNotes = [523.25, 659.25, 783.99, 1046.50];
        chordNotes.forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime);

          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.5);
        });
      }, notes.length * (noteLength - overlap) * 1000);
    } catch (e) {
      console.warn('Failed to play level up sound:', e);
    }
  },
};
