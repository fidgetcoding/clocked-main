import type { WorkoutPhase, WorkoutSection, WorkoutSegment } from '@/types';

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

// Far beyond any real workout. Only damaged or hand-edited data goes past it, and every repeat
// becomes segments the session has to build.
export const MAX_STORED_REPEATS = 100;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value : undefined);
const finite = (value: unknown) => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) ? number : undefined;
};
const repeatCount = (value: unknown) => Math.min(MAX_STORED_REPEATS, Math.max(1, Math.round(finite(value) ?? 1)));
const moves = (value: unknown) => (Array.isArray(value) ? value.filter((move): move is string => typeof move === 'string') : undefined);
const withoutUndefined = <T extends Record<string, unknown>>(value: T) =>
  Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as T;

function normalizeSegment(raw: unknown, fallbackId: string): WorkoutSegment | null {
  if (!isRecord(raw)) return null;
  const comboIndex = raw.comboIndex === 'cycle' ? 'cycle' : finite(raw.comboIndex);
  return withoutUndefined({
    ...raw,
    id: text(raw.id) || fallbackId,
    name: text(raw.name) ?? text(raw.exercise) ?? 'Round',
    type: raw.type === 'rest' ? 'rest' : 'active',
    segmentType: text(raw.segmentType) as WorkoutSegment['segmentType'],
    // Zero or missing keeps the session's existing 60-second fallback
    duration: Math.max(0, finite(raw.duration) ?? 0),
    intensity: text(raw.intensity),
    reps: finite(raw.reps),
    comboIndex,
    combo: moves(raw.combo),
    exercise: text(raw.exercise),
    activityType: text(raw.activityType) as WorkoutSegment['activityType'],
  }) as WorkoutSegment;
}

/** Saved phases as the app expects them: damaged entries are repaired or left out instead of crashing a screen. */
export function normalizeStoredPhases(value: unknown): StoredPhase[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw, index): StoredPhase[] => {
    if (!isRecord(raw)) return [];
    if (raw._meta === true) {
      const repeats = (count: unknown) => (count === undefined ? undefined : repeatCount(count));
      return [withoutUndefined({ ...raw, _meta: true, megasetRepeats: repeats(raw.megasetRepeats), supersetRepeats: repeats(raw.supersetRepeats) })];
    }
    const id = text(raw.id) || `phase-${index}`;
    const segments = Array.isArray(raw.segments) ? raw.segments : [];
    const section = raw.section === 'warmup' || raw.section === 'grind' || raw.section === 'cooldown' ? raw.section : undefined;
    const combos = Array.isArray(raw.combos) ? raw.combos.map(moves).filter((combo): combo is string[] => !!combo) : undefined;
    return [withoutUndefined({
      ...raw,
      id,
      name: text(raw.name) ?? '',
      repeats: repeatCount(raw.repeats),
      section,
      segments: segments.flatMap((segment, at) => normalizeSegment(segment, `${id}-${at}`) ?? []),
      phaseType: text(raw.phaseType) as WorkoutPhase['phaseType'],
      comboOrder: raw.comboOrder === 'random' || raw.comboOrder === 'sequential' ? raw.comboOrder : undefined,
      combos,
    }) as StoredPhase];
  });
}

/** Workout-level combo lists, keeping only lists of moves. */
export function normalizeStoredCombos(value: unknown): string[][] {
  return Array.isArray(value) ? value.map(moves).filter((combo): combo is string[] => !!combo) : [];
}

export function splitStoredPhases(stored: unknown): SplitPhases {
  const all = normalizeStoredPhases(stored);
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
