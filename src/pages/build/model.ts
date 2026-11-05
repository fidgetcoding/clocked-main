// The builder's helpers and constants: drag handling, combo-library lookups, defaults and formatting.
// Moved out of Build.tsx unchanged.
import { splitStoredPhases } from '@/lib/storedPhases';
import { type PlateTone } from '@/components/broadcast';
import { type MoveType } from '@/components/broadcast/run/moves';
import { Input } from '@/components/ui/input';
import { DbWorkout } from '@/hooks/useWorkouts';
import { WorkoutPhase, WorkoutSegment, SegmentType } from '@/types';
import { cn } from '@/lib/utils';
import { PointerSensor, TouchSensor } from '@dnd-kit/core';

export function shouldHandleDragActivation(target: EventTarget | null) {
  return !(target instanceof Element && target.closest('[data-no-dnd="true"]'));
}

export class BuilderPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({ nativeEvent }: React.PointerEvent) => shouldHandleDragActivation(nativeEvent.target),
    },
  ];
}

export class BuilderTouchSensor extends TouchSensor {
  static activators = [
    {
      eventName: 'onTouchStart' as const,
      handler: ({ nativeEvent }: React.TouchEvent) => shouldHandleDragActivation(nativeEvent.target),
    },
  ];
}

export function stopDndEvent(event: React.SyntheticEvent) {
  event.stopPropagation();
}

export const EXERCISE_ENTRY_PLACEHOLDERS = new Set(['exercise', 'exercise a', 'exercise b']);

export const DEFENSIVE_MOVE_PATTERN = /^(SLIP|ROLL|DUCK|PULL|BLOCK|PARRY|STEP|CIRCLE|PIVOT)/;

export function isComboNotationToken(token: string) {
  return /^\d/.test(token) || DEFENSIVE_MOVE_PATTERN.test(token);
}

export function isComboLibraryEntry(entry: string[]) {
  return (entry.length === 1 && entry[0] === 'FREESTYLE') || entry.some(isComboNotationToken);
}

export function isTextLibraryEntry(entry: string[]) {
  return entry.some((token) => !isComboNotationToken(token));
}

export function findNthMatchingIndex(entries: string[][], matcher: (entry: string[]) => boolean, matchPosition: number) {
  let seenMatches = -1;

  for (let index = 0; index < entries.length; index += 1) {
    if (!matcher(entries[index])) continue;
    seenMatches += 1;
    if (seenMatches === matchPosition) return index;
  }

  return -1;
}

export type LibraryEntryTarget =
  | { kind: 'phaseCombo'; comboIndex: number }
  | { kind: 'segmentName'; segmentId: string }
  | { kind: 'none' };

export function resolveLibraryEntryTarget({
  phase,
  segment,
  ctx,
  visibleIndex,
  isSuperset,
}: {
  phase: WorkoutPhase;
  segment: WorkoutSegment;
  ctx: 'speedbag' | 'combo' | 'exercises';
  visibleIndex: number;
  isSuperset: boolean;
}): LibraryEntryTarget {
  const phaseCombos = phase.combos || [];

  if (ctx === 'exercises') {
    const hasStoredExerciseEntries = phaseCombos.length > 0 && phaseCombos.some(isTextLibraryEntry);
    const hasSegmentBackedEntry = !!segment.name && !EXERCISE_ENTRY_PLACEHOLDERS.has(segment.name.toLowerCase());

    if (isSuperset || !hasStoredExerciseEntries) {
      return hasSegmentBackedEntry ? { kind: 'segmentName', segmentId: segment.id } : { kind: 'none' };
    }

    return visibleIndex < phaseCombos.length
      ? { kind: 'phaseCombo', comboIndex: visibleIndex }
      : { kind: 'none' };
  }

  if (!isSuperset) {
    return visibleIndex < phaseCombos.length
      ? { kind: 'phaseCombo', comboIndex: visibleIndex }
      : { kind: 'none' };
  }

  const matcher = ctx === 'speedbag' ? isTextLibraryEntry : isComboLibraryEntry;
  const comboIndex = findNthMatchingIndex(phaseCombos, matcher, visibleIndex);

  return comboIndex === -1 ? { kind: 'none' } : { kind: 'phaseCombo', comboIndex };
}

// Tones, not colours: the type letter and the timeline read the same way.
export const SEGMENT_TYPES: { key: SegmentType; label: string; name: string; tone: PlateTone }[] = [
  { key: 'shadowboxing', label: 'S', name: 'Shadowboxing', tone: 'lime' },
  { key: 'speedbag', label: 'SB', name: 'Speed bag', tone: 'white' },
  { key: 'combo', label: 'H', name: 'Heavy bag', tone: 'white' },
  { key: 'doubleend', label: 'DB', name: 'Double end bag', tone: 'white' },
  { key: 'sparring', label: 'SP', name: 'Sparring', tone: 'lime' },
  { key: 'exercise', label: 'E', name: 'Exercise', tone: 'steel' },
  { key: 'rest', label: 'R', name: 'Rest', tone: 'graphite' },
];

// Punches lean forward on lime, defense leans back, movement stays graphite.
export const MOVE_PLATE: Record<MoveType, { tone: PlateTone; back?: boolean }> = {
  punch: { tone: 'lime' },
  defense: { tone: 'white', back: true },
  movement: { tone: 'graphite' },
  drill: { tone: 'steel' },
};

// The Input is a rule by default. This puts on-air type on it.
export const FX_FIELD = '!font-display !font-black italic uppercase leading-none';

export const OPTION = (on: boolean) => cn('plate fx h-11 text-xl', on ? 'plate-white' : 'plate-graphite');

export const tally = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

export const NO_SPINNER = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

/** A stored combo or drill, as a row of small plates. */

export const DEFAULT_SEGMENT: Omit<WorkoutSegment, 'id'> = {
  name: 'Shadowboxing',
  type: 'active',
  segmentType: 'shadowboxing',
  duration: 60,
};

export const DEFAULT_PHASE: Omit<WorkoutPhase, 'id'> = {
  name: 'Round',
  repeats: 1,
  segments: [],
};

export function generateId() {
  return crypto.randomUUID();
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (secs === 0) return `${mins}m`;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Helper to convert DB workout phases to local format
export function dbPhasesToLocal(dbWorkout: DbWorkout): { warmup: WorkoutPhase[], grind: WorkoutPhase[], cooldown: WorkoutPhase[], megasetRepeats: number } {
  const { sections: { warmup, grind, cooldown }, megasetRepeats } = splitStoredPhases(dbWorkout.phases);
  
  // Migrate: if top-level combos exist but no phase has combos, attach to first grind phase with combo segments
  const topLevelCombos: string[][] = dbWorkout.combos || [];
  const anyPhaseHasCombos = [...warmup, ...grind, ...cooldown].some((p) => p.combos && p.combos.length > 0);
  
  if (topLevelCombos.length > 0 && !anyPhaseHasCombos) {
    // Find first grind phase with combo/shadowboxing segments
    const targetPhase = grind.find((p) => 
      p.segments?.some((s) => s.segmentType === 'combo' || s.segmentType === 'shadowboxing')
    );
    if (targetPhase) {
      targetPhase.combos = topLevelCombos;
    } else if (grind.length > 0) {
      // Fallback: attach to first grind phase
      grind[0].combos = topLevelCombos;
    }
  }
  
  return { warmup, grind, cooldown, megasetRepeats };
}
