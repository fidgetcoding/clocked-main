import { simulate, type SynthPunch } from './punchSynth';

/** A clear synthetic demonstration for calibration UI tests, independent of real-camera accuracy. */
export const calibrationMotion = (shape: Pick<SynthPunch, 'hand' | 'shape'>) =>
  // Give the dip/rise enough samples at 24–30 fps; a 120 ms dip aliased at some frame offsets.
  simulate({ startMs: 0, durationMs: 1500, punches: [{ ...shape, at: 400, dipMs: 200, outMs: 240 }] });
