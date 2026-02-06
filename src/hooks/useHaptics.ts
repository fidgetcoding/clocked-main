import { useCallback } from 'react';
import { useUserStore } from '@/stores/userStore';

export const useHaptics = () => {
  const user = useUserStore((state) => state.user);
  const prefs = user?.preferences as Record<string, any> | undefined;
  
  // Check individual preferences with master toggle
  const isMasterEnabled = prefs?.hapticEnabled !== false;
  const isRoundChangeEnabled = prefs?.hapticRoundChange !== false;
  const isWarningEnabled = prefs?.hapticWarning !== false;

  // Short vibration for transitions
  const vibrateShort = useCallback(() => {
    if (isMasterEnabled && isRoundChangeEnabled && navigator.vibrate) {
      navigator.vibrate(50);
    }
  }, [isMasterEnabled, isRoundChangeEnabled]);

  // Medium pulse for round changes
  const vibrateRoundChange = useCallback(() => {
    if (isMasterEnabled && isRoundChangeEnabled && navigator.vibrate) {
      navigator.vibrate([50, 50, 100]);
    }
  }, [isMasterEnabled, isRoundChangeEnabled]);

  // Double pulse for warnings
  const vibrateWarning = useCallback(() => {
    if (isMasterEnabled && isWarningEnabled && navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
  }, [isMasterEnabled, isWarningEnabled]);

  return {
    vibrateShort,
    vibrateRoundChange,
    vibrateWarning,
  };
};

// Standalone functions for use outside of React components
export const hapticFeedback = {
  short: () => {
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  },
  roundChange: () => {
    if (navigator.vibrate) {
      navigator.vibrate([50, 50, 100]);
    }
  },
  warning: () => {
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
  },
};
