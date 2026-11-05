// How a workout becomes the flat list of timed segments a session runs through, plus the small
// helpers the session screen shares with it. Moved out of WorkoutSession.tsx unchanged.
import type { DbWorkout } from '@/hooks/useWorkouts';
import { splitStoredPhases } from '@/lib/storedPhases';
import type { SegmentType, WorkoutPhase, WorkoutSection, WorkoutSegment } from '@/types';

interface TempSegment {
  segment: WorkoutSegment;
  sectionName: 'warmup' | 'grind' | 'cooldown';
  phase: WorkoutPhase;
  repeatIndex: number;
  megasetIndex?: number;
}

export interface FlatSegment {
  id: string;
  name: string;
  type: 'active' | 'rest';
  segmentType?: SegmentType;
  duration: number;
  phaseName: string;
  section: 'warmup' | 'grind' | 'cooldown';
  combo?: string[];
  drill?: string[];
  nextCombo?: string[];
  intensity?: string;
  reps?: number;
  repeatIndex?: number;
  megasetIndex?: number;
  cumulativeRound?: number;
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatTimeCompact(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Speed bag drills are names; everything else in a combo list is punch or defense notation
const isDrillEntry = (entry: string[]) =>
  entry.some((token) => !/^\d/.test(token) && !/^(SLIP|ROLL|DUCK|PULL|BLOCK|PARRY|STEP|CIRCLE|PIVOT|FREESTYLE)/.test(token));

// A phase can share one list between a speed bag and punches, and each should only see its own
const mixesDrillsAndPunches = (phase: WorkoutPhase) => {
  const types = phase.segments.map((segment) => segment.segmentType);
  return types.includes('speedbag') && types.some((type) => type === 'combo' || type === 'shadowboxing' || type === 'doubleend');
};

export function dbWorkoutToLocal(dbWorkout: DbWorkout) {
  const { sections, megasetRepeats } = splitStoredPhases(dbWorkout.phases);
  
  // Each phase carries its own combos now; this list only exists on older workouts
  const combos: string[][] = dbWorkout.combos || [];
  
  return {
    id: dbWorkout.id,
    name: dbWorkout.name,
    duration: dbWorkout.duration,
    difficulty: dbWorkout.difficulty,
    sections,
    combos: combos.length > 0 ? combos : undefined,
    is_preset: dbWorkout.is_preset,
    megasetRepeats,
  };
}

/** What's said when a segment starts. */
export function segmentAnnouncement(segment: FlatSegment): string {
  if (segment.type === 'rest') return 'Rest';
  if (segment.segmentType === 'shadowboxing' || segment.name.toLowerCase().includes('shadow')) return 'Shadowboxing';
  if (segment.segmentType === 'speedbag') return segment.name.includes('Freestyle') ? 'Speed Bag Freestyle' : segment.name;
  if (segment.segmentType === 'doubleend') return segment.name.includes('Freestyle') ? 'Double End Bag Freestyle' : 'Double End Bag';
  if (segment.segmentType === 'combo') return segment.name.includes('Freestyle') ? 'Heavy Bag Freestyle' : 'Heavy Bag';
  return segment.name;
}

/** The combo or drill called out after the announcement. Only boxing segments get one. */
export function segmentCallout(segment: FlatSegment): string[] | null {
  const boxing = ['shadowboxing', 'combo', 'doubleend', 'speedbag'].includes(segment.segmentType ?? '');
  const combo = segment.combo ?? segment.drill;
  return boxing && combo && combo.length > 0 ? combo : null;
}


export type SessionWorkout = ReturnType<typeof dbWorkoutToLocal>;

/** Every segment in run order: warmup, each megaset of rounds, cooldown, with combos and drills assigned. */
export function flattenWorkout(workout: SessionWorkout): FlatSegment[] {
  const segments: FlatSegment[] = [];
  const megasetCount = workout.megasetRepeats || 1;
  
  const sectionOrder: { sectionName: 'warmup' | 'grind' | 'cooldown' }[] = [
    { sectionName: 'warmup' },
    ...Array.from({ length: megasetCount }, () => ({ sectionName: 'grind' as const })),
    { sectionName: 'cooldown' },
  ];

  const hasWarmup = workout.sections.warmup.length > 0;
  const hasCooldown = workout.sections.cooldown.length > 0;
  const hasGrind = workout.sections.grind.length > 0;

  const makeTransitionRest = (name: string, sectionName: 'warmup' | 'grind' | 'cooldown'): TempSegment => ({
    segment: { id: `transition-${name}`, name, type: 'rest' as const, segmentType: 'rest', duration: 30 },
    sectionName,
    phase: { id: `transition-${name}`, name, repeats: 1, segments: [], comboOrder: 'sequential' },
    repeatIndex: 0,
    megasetIndex: undefined,
  });
  
  const tempSegments: TempSegment[] = [];
  
  let grindIterationIndex = 0;
  sectionOrder.forEach(({ sectionName }) => {
    const currentMegasetIndex = sectionName === 'grind' ? grindIterationIndex : undefined;
    const isFirstGrind = sectionName === 'grind' && grindIterationIndex === 0;
    if (sectionName === 'grind') grindIterationIndex++;
    const phases = workout.sections[sectionName];
    if (phases.length === 0) return;

    if (isFirstGrind && hasWarmup && hasGrind) {
      tempSegments.push(makeTransitionRest('Get Ready', 'grind'));
    }

    if (sectionName === 'cooldown' && hasGrind && hasCooldown) {
      tempSegments.push(makeTransitionRest('Recovery', 'cooldown'));
    }

    phases.forEach((phase) => {
      for (let r = 0; r < phase.repeats; r++) {
        phase.segments.forEach((segment) => {
          tempSegments.push({ segment, sectionName, phase, repeatIndex: r, megasetIndex: currentMegasetIndex });
        });
      }
    });
  });
  
  // Two-pass combo assignment
  const comboSegmentIndices: number[] = [];
  const shadowboxIndices: number[] = [];
  
  tempSegments.forEach((item, idx) => {
    const { segment, phase } = item;
    const isSpeedbag = segment.segmentType === 'speedbag';
    const isDoubleend = segment.segmentType === 'doubleend';
    if (isSpeedbag || isDoubleend) return;
    const isComboSegment = segment.segmentType === 'combo' || segment.comboIndex === 'cycle';
    const isShadowboxing = segment.segmentType === 'shadowboxing' || 
                           segment.name.toLowerCase().includes('shadow') || 
                           segment.name.toLowerCase().includes('technique');
    
    // BUG 2 FIX A: NEVER assign combos to explicit exercise segments
    const isExplicitExercise = segment.segmentType === 'exercise' || 
      ['pushups', 'pushup', 'push-ups', 'burpees', 'burpee', 'curlups', 'curlup', 'curl-ups', 'sit-ups', 'situps',
       'jump rope', 'jog', 'jog in place', 'treadmill', 'high knees', 'plank'].some(
        ex => segment.name.toLowerCase().includes(ex)
      );
    
    const phaseCombos = phase.combos as string[][] | undefined;
    const phaseHasCombos = phaseCombos && phaseCombos.length > 0;
    const phaseHasComboSegments = phase.segments?.some((s) => 
      ['combo', 'shadowboxing', 'speedbag', 'doubleend'].includes(s.segmentType || '')
    );
    const isExerciseSegment = !isExplicitExercise && (
      segment.type === 'active' && segment.segmentType === 'work' && phaseHasCombos && !phaseHasComboSegments
    );
    
    if (isComboSegment || isExerciseSegment) comboSegmentIndices.push(idx);
    else if (isShadowboxing) shadowboxIndices.push(idx);
  });
  
  const totalCombos = workout.combos?.length || 0;
  const comboAssignments: Map<number, string[]> = new Map();
  const assigned = 0;
  
  const getComboListForPhase = (phase: WorkoutPhase): string[][] => {
    const phaseCombos = (phase.combos as string[][] | undefined)?.filter(
      (entry) => !mixesDrillsAndPunches(phase) || !isDrillEntry(entry),
    );
    if (phaseCombos && phaseCombos.length > 0) {
      if (phase.comboOrder === 'random') {
        const shuffled = [...phaseCombos];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
      }
      return phaseCombos;
    }
    if (!workout.combos || workout.combos.length === 0) return [];
    if (phase.comboOrder === 'random') {
      const shuffled = [...workout.combos];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }
    return workout.combos;
  };
  
  const phaseComboLists: Map<string, { list: string[][]; cursor: number }> = new Map();
  
  const getPhaseCombo = (phase: WorkoutPhase, phaseKey: string, sectionName: TempSegment['sectionName']): string[] | undefined => {
    const hasOwnCombos = !!phase.combos && phase.combos.length > 0;
    // A workout-wide combo list is for the rounds. A warmup or cooldown without combos stays freestyle.
    if (!hasOwnCombos && (totalCombos === 0 || sectionName !== 'grind')) return undefined;
    if (!phaseComboLists.has(phaseKey)) {
      phaseComboLists.set(phaseKey, { list: getComboListForPhase(phase), cursor: 0 });
    }
    const entry = phaseComboLists.get(phaseKey)!;
    if (entry.cursor >= entry.list.length) return undefined;
    return entry.list[entry.cursor++];
  };
  
  const allBoxingIndices = [...comboSegmentIndices, ...shadowboxIndices].sort((a, b) => a - b);
  const roundComboCache: Map<string, string[]> = new Map();
  
  for (const idx of allBoxingIndices) {
    const { phase, repeatIndex, sectionName } = tempSegments[idx];
    const roundKey = `${phase.id}-${repeatIndex}`;
    
    if (roundComboCache.has(roundKey)) {
      comboAssignments.set(idx, roundComboCache.get(roundKey)!);
    } else {
      const phaseKey = `${phase.id}`;
      const combo = getPhaseCombo(phase, phaseKey, sectionName);
      if (combo) {
        roundComboCache.set(roundKey, combo);
        comboAssignments.set(idx, combo);
      }
    }
  }
  
  // Speed bag and double-end segments show what was picked for them, from their own list when
  // a phase mixes drills and punches. Kept apart from combos, which also drive XP.
  const bagLists = new Map<string, string[][]>();
  const bagRounds = new Map<string, string[] | undefined>();
  const bagDrillFor = ({ segment, phase, repeatIndex }: TempSegment): string[] | undefined => {
    if (segment.segmentType !== 'speedbag' && segment.segmentType !== 'doubleend') return undefined;
    const roundKey = `${phase.id}-${repeatIndex}-${segment.segmentType}`;
    if (bagRounds.has(roundKey)) return bagRounds.get(roundKey);
    const listKey = `${phase.id}-${segment.segmentType}`;
    if (!bagLists.has(listKey)) {
      const list = ((phase.combos as string[][] | undefined) ?? []).filter(
        (entry) => !mixesDrillsAndPunches(phase) || isDrillEntry(entry) === (segment.segmentType === 'speedbag'),
      );
      if (phase.comboOrder === 'random') list.sort(() => Math.random() - 0.5);
      bagLists.set(listKey, list);
    }
    const drill = bagLists.get(listKey)!.shift();
    bagRounds.set(roundKey, drill);
    return drill;
  };

  let cumulativeRound = 0;
  // The megaset is part of a round's identity, so a one-phase grind repeated as megasets keeps counting up
  let lastRoundKey = '';
  
  tempSegments.forEach((item, idx) => {
    const { segment, sectionName, phase, repeatIndex, megasetIndex } = item;
    
    // The Get Ready before the first round isn't a round
    const isRound = sectionName === 'grind' && !phase.id.startsWith('transition-');
    if (isRound) {
      const roundKey = `${megasetIndex ?? 0}-${phase.id}-${repeatIndex}`;
      if (roundKey !== lastRoundKey) {
        cumulativeRound++;
        lastRoundKey = roundKey;
      }
    }
    
    const combo = comboAssignments.get(idx);
    
    const isShadowboxing = segment.segmentType === 'shadowboxing' || 
                           segment.name.toLowerCase().includes('shadow') || 
                           segment.name.toLowerCase().includes('technique');
    let nextCombo: string[] | undefined;
    if (isShadowboxing && !combo) {
      const nextItem = tempSegments[idx + 1];
      if (nextItem) {
        const nextAssigned = comboAssignments.get(idx + 1);
        if (nextAssigned) nextCombo = nextAssigned;
      }
    }
    
    segments.push({
      id: `${segment.id}-${repeatIndex}-${idx}`,
      name: segment.name,
      type: segment.type,
      segmentType: segment.segmentType,
      duration: segment.duration,
      phaseName: phase.name,
      section: sectionName,
      combo,
      drill: bagDrillFor(item),
      nextCombo,
      intensity: segment.intensity,
      reps: segment.reps,
      repeatIndex: phase.repeats > 1 ? repeatIndex + 1 : undefined,
      megasetIndex,
      cumulativeRound: isRound ? cumulativeRound : undefined,
    });
  });
  
  return segments;
}
