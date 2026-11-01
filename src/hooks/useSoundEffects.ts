import { useCallback, useRef } from 'react';
import { useUserStore } from '@/stores/userStore';

// Audio context singleton
let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
};

/** Shared level-up sound synthesis logic */
const playLevelUpSoundImpl = () => {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') ctx.resume();

  const now = ctx.currentTime;

  // 1. Sub-bass hit for impact
  const subOsc = ctx.createOscillator();
  const subGain = ctx.createGain();
  subOsc.connect(subGain);
  subGain.connect(ctx.destination);
  subOsc.type = 'sine';
  subOsc.frequency.setValueAtTime(80, now);
  subOsc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
  subGain.gain.setValueAtTime(0.4, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  subOsc.start(now);
  subOsc.stop(now + 0.4);

  // 2. Ascending arpeggio - louder, slower, richer
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
  const noteLength = 0.18;
  const gap = 0.06;

  notes.forEach((freq, index) => {
    const startTime = now + 0.05 + index * (noteLength + gap);

    // Sawtooth layer for richness
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, startTime);
    gain1.gain.setValueAtTime(0, startTime);
    gain1.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, startTime + noteLength + 0.15);
    osc1.start(startTime);
    osc1.stop(startTime + noteLength + 0.15);

    // Sine layer for body
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq, startTime);
    gain2.gain.setValueAtTime(0, startTime);
    gain2.gain.linearRampToValueAtTime(0.35, startTime + 0.02);
    gain2.gain.exponentialRampToValueAtTime(0.001, startTime + noteLength + 0.15);
    osc2.start(startTime);
    osc2.stop(startTime + noteLength + 0.15);
  });

  // 3. Final sustained chord - loud and long
  const chordStart = now + 0.05 + notes.length * (noteLength + gap);
  const chordNotes = [523.25, 659.25, 783.99, 1046.50];
  chordNotes.forEach((freq) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, chordStart);
    gain.gain.setValueAtTime(0.25, chordStart);
    gain.gain.exponentialRampToValueAtTime(0.001, chordStart + 1.0);
    osc.start(chordStart);
    osc.stop(chordStart + 1.0);
  });
};

export const useSoundEffects = () => {
  const user = useUserStore((state) => state.user);
  const prefs = user?.preferences as Record<string, unknown> | undefined;
  
  const soundEnabled = prefs?.soundEnabled !== false;
  const tenSecondWarningEnabled = prefs?.tenSecondWarning !== false;
  
  const lastPlayedRef = useRef<number>(0);

  const playXPSound = useCallback(() => {
    if (!soundEnabled) return;
    const now = Date.now();
    if (now - lastPlayedRef.current < 100) return;
    lastPlayedRef.current = now;

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
  }, [soundEnabled]);

  const playWarningBeep = useCallback(() => {
    if (!soundEnabled || !tenSecondWarningEnabled) return;

    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
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

  const playLevelUpSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      playLevelUpSoundImpl();
    } catch (e) {
      console.warn('Failed to play level up sound:', e);
    }
  }, [soundEnabled]);

  return { playXPSound, playLevelUpSound, playWarningBeep };
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
      playLevelUpSoundImpl();
    } catch (e) {
      console.warn('Failed to play level up sound:', e);
    }
  },

  prestige: () => {
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;

      // 1. Deep dramatic drum hit
      const kickOsc = ctx.createOscillator();
      const kickGain = ctx.createGain();
      kickOsc.connect(kickGain);
      kickGain.connect(ctx.destination);
      kickOsc.type = 'sine';
      kickOsc.frequency.setValueAtTime(120, now);
      kickOsc.frequency.exponentialRampToValueAtTime(30, now + 0.5);
      kickGain.gain.setValueAtTime(0.5, now);
      kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      kickOsc.start(now);
      kickOsc.stop(now + 0.6);

      // 2. Majestic rising fanfare (brass-like sawtooth)
      const fanfareNotes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C4→C6
      const noteLen = 0.14;
      fanfareNotes.forEach((freq, i) => {
        const t = now + 0.15 + i * noteLen;
        
        // Sawtooth for brass character
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
        gain.gain.setValueAtTime(0.15, t + noteLen * 0.6);
        gain.gain.exponentialRampToValueAtTime(0.001, t + noteLen + 0.2);
        osc.start(t);
        osc.stop(t + noteLen + 0.2);

        // Sine for body
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq, t);
        gain2.gain.setValueAtTime(0, t);
        gain2.gain.linearRampToValueAtTime(0.25, t + 0.02);
        gain2.gain.setValueAtTime(0.25, t + noteLen * 0.6);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + noteLen + 0.2);
        osc2.start(t);
        osc2.stop(t + noteLen + 0.2);
      });

      // 3. Grand sustained power chord finale
      const chordStart = now + 0.15 + fanfareNotes.length * noteLen + 0.1;
      const chordFreqs = [261.63, 329.63, 392.00, 523.25, 783.99, 1046.50];
      chordFreqs.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, chordStart);
        gain.gain.setValueAtTime(0.2, chordStart);
        gain.gain.exponentialRampToValueAtTime(0.001, chordStart + 1.5);
        osc.start(chordStart);
        osc.stop(chordStart + 1.5);
      });

      // 4. Shimmer / sparkle effect
      for (let i = 0; i < 6; i++) {
        const sparkleTime = chordStart + 0.1 + i * 0.12;
        const sparkleFreq = 2000 + Math.random() * 2000;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(sparkleFreq, sparkleTime);
        gain.gain.setValueAtTime(0, sparkleTime);
        gain.gain.linearRampToValueAtTime(0.06, sparkleTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, sparkleTime + 0.15);
        osc.start(sparkleTime);
        osc.stop(sparkleTime + 0.15);
      }
    } catch (e) {
      console.warn('Failed to play prestige sound:', e);
    }
  },
};
