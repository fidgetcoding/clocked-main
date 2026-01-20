import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { QuickTimerSettings, TimerState } from '@/types';

interface TimerStore {
  // Quick Timer Settings
  settings: QuickTimerSettings;
  updateSettings: (updates: Partial<QuickTimerSettings>) => void;
  
  // Timer State
  timerState: TimerState;
  startTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => void;
  tickTimer: () => void;
  nextRound: () => void;
}

const defaultSettings: QuickTimerSettings = {
  roundTime: 180, // 3 minutes
  restTime: 60, // 1 minute
  rounds: 12,
  warningTime: 10, // 10 seconds
};

const defaultTimerState: TimerState = {
  isRunning: false,
  isPaused: false,
  currentRound: 1,
  totalRounds: 12,
  isRestPeriod: false,
  timeRemaining: 180,
  totalElapsed: 0,
};

export const useTimerStore = create<TimerStore>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      timerState: defaultTimerState,

      updateSettings: (updates) =>
        set((state) => ({
          settings: { ...state.settings, ...updates },
        })),

      startTimer: () => {
        const { settings } = get();
        set({
          timerState: {
            isRunning: true,
            isPaused: false,
            currentRound: 1,
            totalRounds: settings.rounds,
            isRestPeriod: false,
            timeRemaining: settings.roundTime,
            totalElapsed: 0,
          },
        });
      },

      pauseTimer: () =>
        set((state) => ({
          timerState: {
            ...state.timerState,
            isRunning: false,
            isPaused: true,
          },
        })),

      resumeTimer: () =>
        set((state) => ({
          timerState: {
            ...state.timerState,
            isRunning: true,
            isPaused: false,
          },
        })),

      resetTimer: () => {
        const { settings } = get();
        set({
          timerState: {
            ...defaultTimerState,
            totalRounds: settings.rounds,
            timeRemaining: settings.roundTime,
          },
        });
      },

      tickTimer: () => {
        const { timerState, settings } = get();
        
        if (!timerState.isRunning) return;

        const newTimeRemaining = timerState.timeRemaining - 1;
        const newTotalElapsed = timerState.totalElapsed + 1;

        if (newTimeRemaining <= 0) {
          // Time's up for current segment
          if (timerState.isRestPeriod) {
            // End of rest, start next round
            if (timerState.currentRound >= timerState.totalRounds) {
              // Workout complete
              set({
                timerState: {
                  ...timerState,
                  isRunning: false,
                  isPaused: false,
                  timeRemaining: 0,
                  totalElapsed: newTotalElapsed,
                },
              });
            } else {
              // Start next round
              set({
                timerState: {
                  ...timerState,
                  currentRound: timerState.currentRound + 1,
                  isRestPeriod: false,
                  timeRemaining: settings.roundTime,
                  totalElapsed: newTotalElapsed,
                },
              });
            }
          } else {
            // End of round, start rest
            set({
              timerState: {
                ...timerState,
                isRestPeriod: true,
                timeRemaining: settings.restTime,
                totalElapsed: newTotalElapsed,
              },
            });
          }
        } else {
          // Normal tick
          set({
            timerState: {
              ...timerState,
              timeRemaining: newTimeRemaining,
              totalElapsed: newTotalElapsed,
            },
          });
        }
      },

      nextRound: () => {
        const { timerState, settings } = get();
        if (timerState.currentRound >= timerState.totalRounds) return;

        set({
          timerState: {
            ...timerState,
            currentRound: timerState.currentRound + 1,
            isRestPeriod: false,
            timeRemaining: settings.roundTime,
          },
        });
      },
    }),
    {
      name: 'get-clocked-timer',
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);
