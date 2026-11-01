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
      // Phases with no section were saved by an older preset flow; they still belong in the rounds
      .filter((phase) => phase.section === name || (name === 'grind' && !phase.section))
      .map(({ section: _section, ...rest }) => rest as WorkoutPhase);

  return {
    phases,
    sections: { warmup: inSection('warmup'), grind: inSection('grind'), cooldown: inSection('cooldown') },
    megasetRepeats: meta?.megasetRepeats || meta?.supersetRepeats || 1,
  };
}

/** The reverse of splitStoredPhases, so a workout saved from sections keeps its phases. */
export function joinStoredPhases(sections: Partial<WorkoutSection>): StoredPhase[] {
  return (['warmup', 'grind', 'cooldown'] as const).flatMap((section) =>
    (sections[section] ?? []).map((phase) => ({ ...phase, section })),
  );
}
