import type { WorkoutPhase, WorkoutSection } from '@/types';

// Workouts are saved as one flat list of phases tagged by section, plus an optional meta entry
export interface StoredPhase extends Partial<WorkoutPhase> {
  _meta?: boolean;
  megasetRepeats?: number;
  supersetRepeats?: number;
}

export interface SplitPhases {
  phases: StoredPhase[];
  sections: WorkoutSection;
  megasetRepeats: number;
}

export function splitStoredPhases(stored: StoredPhase[] | null | undefined): SplitPhases {
  const all = stored ?? [];
  const meta = all.find((phase) => phase._meta);
  const phases = all.filter((phase) => !phase._meta);
  const inSection = (name: WorkoutPhase['section']) =>
    phases
      .filter((phase) => phase.section === name)
      .map(({ section: _section, ...rest }) => rest as WorkoutPhase);

  return {
    phases,
    sections: { warmup: inSection('warmup'), grind: inSection('grind'), cooldown: inSection('cooldown') },
    megasetRepeats: meta?.megasetRepeats || meta?.supersetRepeats || 1,
  };
}
