import { useLatest } from '@/hooks/useLatest';
import { splitStoredPhases } from '@/lib/storedPhases';
import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, GripVertical, Pencil, X, ChevronDown, ChevronUp, Share2, Search, Check } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { BroadcastPage, Plate, plateClass, PlayIcon, Ticker, type PlateTone } from '@/components/broadcast';
import { toComboMove, type MoveType } from '@/components/broadcast/run/moves';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useWorkouts, DbWorkout } from '@/hooks/useWorkouts';
import { useUserStore } from '@/stores/userStore';
import { Workout, WorkoutPhase, WorkoutSegment, SegmentType } from '@/types';
import { cn } from '@/lib/utils';
import { 
  getAllPresets, 
  getPresetCategories,
  PUNCH_KEYS_BY_DIFFICULTY, 
  DEFENSE_KEYS_BY_DIFFICULTY, 
  MOVEMENT_KEYS_BY_DIFFICULTY,
  ComboPreset,
  ComboDifficulty
} from '@/data/comboPresets';
import { SPEED_BAG_DRILLS } from '@/data/speedBagDrills';
import { ExercisePickerModal } from '@/components/ExercisePickerModal';
import { isBuiltinExercise } from '@/data/exerciseCategories';
import { useCustomExercises } from '@/hooks/useCustomExercises';
import { useAuth } from '@/contexts/useAuth';
import { promptEmailLink } from '@/lib/guest';
import { AIBuilderModal } from '@/components/AIBuilderModal';
import { useShareWorkout } from '@/hooks/useCommunityPosts';
import { useClubs } from '@/hooks/useClubs';
import { toast } from 'sonner';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function shouldHandleDragActivation(target: EventTarget | null) {
  return !(target instanceof Element && target.closest('[data-no-dnd="true"]'));
}

class BuilderPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({ nativeEvent }: React.PointerEvent) => shouldHandleDragActivation(nativeEvent.target),
    },
  ];
}

class BuilderTouchSensor extends TouchSensor {
  static activators = [
    {
      eventName: 'onTouchStart' as const,
      handler: ({ nativeEvent }: React.TouchEvent) => shouldHandleDragActivation(nativeEvent.target),
    },
  ];
}

function stopDndEvent(event: React.SyntheticEvent) {
  event.stopPropagation();
}

const EXERCISE_ENTRY_PLACEHOLDERS = new Set(['exercise', 'exercise a', 'exercise b']);
const DEFENSIVE_MOVE_PATTERN = /^(SLIP|ROLL|DUCK|PULL|BLOCK|PARRY|STEP|CIRCLE|PIVOT)/;

function isComboNotationToken(token: string) {
  return /^\d/.test(token) || DEFENSIVE_MOVE_PATTERN.test(token);
}

function isComboLibraryEntry(entry: string[]) {
  return (entry.length === 1 && entry[0] === 'FREESTYLE') || entry.some(isComboNotationToken);
}

function isTextLibraryEntry(entry: string[]) {
  return entry.some((token) => !isComboNotationToken(token));
}

function findNthMatchingIndex(entries: string[][], matcher: (entry: string[]) => boolean, matchPosition: number) {
  let seenMatches = -1;

  for (let index = 0; index < entries.length; index += 1) {
    if (!matcher(entries[index])) continue;
    seenMatches += 1;
    if (seenMatches === matchPosition) return index;
  }

  return -1;
}

type LibraryEntryTarget =
  | { kind: 'phaseCombo'; comboIndex: number }
  | { kind: 'segmentName'; segmentId: string }
  | { kind: 'none' };

function resolveLibraryEntryTarget({
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

// Sortable wrapper for phase cards in the builder
function SortablePhaseWrapper({ id, children }: { id: string; children: (props: { dragHandleProps: React.HTMLAttributes<HTMLElement>; style: React.CSSProperties; setNodeRef: (node: HTMLElement | null) => void; isDragging: boolean }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return <>{children({ dragHandleProps: { ...attributes, ...listeners }, style, setNodeRef, isDragging })}</>;
}

// Tones, not colours: the type letter and the timeline read the same way.
const SEGMENT_TYPES: { key: SegmentType; label: string; name: string; tone: PlateTone }[] = [
  { key: 'shadowboxing', label: 'S', name: 'Shadowboxing', tone: 'lime' },
  { key: 'speedbag', label: 'SB', name: 'Speed bag', tone: 'white' },
  { key: 'combo', label: 'H', name: 'Heavy bag', tone: 'white' },
  { key: 'doubleend', label: 'DB', name: 'Double end bag', tone: 'white' },
  { key: 'sparring', label: 'SP', name: 'Sparring', tone: 'lime' },
  { key: 'exercise', label: 'E', name: 'Exercise', tone: 'steel' },
  { key: 'rest', label: 'R', name: 'Rest', tone: 'graphite' },
];

// Punches lean forward on lime, defense leans back, movement stays graphite.
const MOVE_PLATE: Record<MoveType, { tone: PlateTone; back?: boolean }> = {
  punch: { tone: 'lime' },
  defense: { tone: 'white', back: true },
  movement: { tone: 'graphite' },
  drill: { tone: 'steel' },
};

// The Input is a rule by default. This puts on-air type on it.
const FX_FIELD = '!font-display !font-black italic uppercase leading-none';
const OPTION = (on: boolean) => cn('plate fx h-11 text-xl', on ? 'plate-white' : 'plate-graphite');
const tally = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;
const NO_SPINNER = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

/** A stored combo or drill, as a row of small plates. */
function MovePlates({ combo }: { combo: string[] }) {
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1 px-1">
      {combo.map((move, index) => (
        <Plate key={index} {...MOVE_PLATE[toComboMove(move).type]} className="min-h-8 min-w-8 !whitespace-normal px-2 py-1 text-xl leading-none">
          {move}
        </Plate>
      ))}
    </span>
  );
}

/** Down, the value, up. */
function Stepper({ noun, value, onChange, lime }: { noun: string; value: number; onChange: (next: number) => void; lime?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label={`Fewer ${noun}`}
        disabled={value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
        className="plate plate-graphite h-11 w-11 disabled:opacity-40"
      >
        <ChevronDown className="size-5" />
      </button>
      <span className={cn('fx w-9 text-center text-3xl', lime && 'text-volt')}>×{value}</span>
      <button
        type="button"
        aria-label={`More ${noun}`}
        onClick={() => onChange(value + 1)}
        className="plate plate-graphite h-11 w-11"
      >
        <ChevronUp className="size-5" />
      </button>
    </span>
  );
}

/** A phase's segments, each as wide as its share of the time. */
function PhaseTimeline({ segments, tone }: { segments: WorkoutSegment[]; tone: (segment: WorkoutSegment) => PlateTone }) {
  const total = segments.reduce((sum, segment) => sum + segment.duration, 0);
  if (total <= 0) return null;
  return (
    <div aria-hidden="true" className="flex gap-2.5 px-5 pb-2">
      {segments.map((segment) => (
        <span
          key={segment.id}
          className={cn(plateClass({ tone: tone(segment) }), 'fx h-8 min-w-0 text-xl')}
          style={{ flex: `${Math.max(segment.duration, 1)} 1 0` }}
        >
          {segment.duration / total >= 0.14 && `${segment.duration}s`}
        </span>
      ))}
    </div>
  );
}

const DEFAULT_SEGMENT: Omit<WorkoutSegment, 'id'> = {
  name: 'Shadowboxing',
  type: 'active',
  segmentType: 'shadowboxing',
  duration: 60,
};

const DEFAULT_PHASE: Omit<WorkoutPhase, 'id'> = {
  name: 'Round',
  repeats: 1,
  segments: [],
};

function generateId() {
  return crypto.randomUUID();
}

// Sortable combo item component
function SortableComboItem({ id, combo, index, onEdit, onDelete }: { 
  id: string; combo: string[]; index: number; onEdit: (i: number) => void; onDelete: (i: number) => void 
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const isFreestyle = combo.length === 1 && combo[0] === 'FREESTYLE';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-1 border-t border-surface-2 py-1',
        isDragging && 'relative z-50 bg-surface-2 opacity-50'
      )}
    >
      <div {...attributes} {...listeners} aria-label={`Move entry ${index + 1}`} className="flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing">
        <GripVertical className="size-4 text-muted-foreground" />
      </div>
      <span className="fx w-6 shrink-0 text-2xl text-volt">{index + 1}</span>
      <div className="min-w-0 flex-1 px-1">
        {isFreestyle ? (
          <Plate tone="steel" className="h-8 px-3 text-xl">Freestyle</Plate>
        ) : (
          <MovePlates combo={combo} />
        )}
      </div>
      <button
        type="button"
        data-no-dnd="true"
        aria-label={`Edit entry ${index + 1}`}
        onClick={(e) => {
          e.stopPropagation();
          onEdit(index);
        }}
        onPointerDown={stopDndEvent}
        onPointerDownCapture={stopDndEvent}
        onMouseDown={stopDndEvent}
        onMouseDownCapture={stopDndEvent}
        onTouchStart={stopDndEvent}
        onTouchStartCapture={stopDndEvent}
        className="flex h-11 w-9 shrink-0 touch-manipulation items-center justify-center text-muted-foreground hover:text-foreground"
      >
        <Pencil className="size-4 pointer-events-none" />
      </button>
      <button
        type="button"
        data-no-dnd="true"
        aria-label={`Remove entry ${index + 1}`}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(index);
        }}
        onPointerDown={stopDndEvent}
        onPointerDownCapture={stopDndEvent}
        onMouseDown={stopDndEvent}
        onMouseDownCapture={stopDndEvent}
        onTouchStart={stopDndEvent}
        onTouchStartCapture={stopDndEvent}
        className="flex h-11 w-9 shrink-0 touch-manipulation items-center justify-center text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="size-4 pointer-events-none" />
      </button>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (secs === 0) return `${mins}m`;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Helper to convert DB workout phases to local format
function dbPhasesToLocal(dbWorkout: DbWorkout): { warmup: WorkoutPhase[], grind: WorkoutPhase[], cooldown: WorkoutPhase[], megasetRepeats: number } {
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

const Build = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const aiWorkoutData = searchParams.get('ai');
  
  const { workouts, addWorkout, updateWorkout } = useWorkouts();
  const user = useUserStore((state) => state.user);
  const { addExercise: addCustomExercise, isInLibrary } = useCustomExercises();
  const addCustomExerciseRef = useLatest(addCustomExercise);
  const isInLibraryRef = useLatest(isInLibrary);
  const { isGuest } = useAuth();
  
  // Get default difficulty based on user's experience level
  const getDefaultDifficulty = (): ComboDifficulty => {
    const level = user?.experienceLevel;
    if (level === 'complete_beginner') return 'rookie';
    if (level === 'beginner') return 'beginner';
    if (level === 'intermediate') return 'intermediate';
    if (level === 'advanced') return 'advanced';
    if (level === 'pro') return 'pro';
    return 'beginner';
  };
  
  // Form state
  const [name, setName] = useState('New Workout');
  const [difficulty, setDifficulty] = useState<ComboDifficulty>(getDefaultDifficulty());
  const [warmupPhases, setWarmupPhases] = useState<WorkoutPhase[]>([]);
  const [grindPhases, setGrindPhases] = useState<WorkoutPhase[]>([]);
  const [cooldownPhases, setCooldownPhases] = useState<WorkoutPhase[]>([]);
  const [megasetRepeats, setMegasetRepeats] = useState(1);
  // Per-phase combo editing state
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [isPreset, setIsPreset] = useState(false);
  
  // UI state
  const [activeSection, setActiveSection] = useState<'warmup' | 'grind' | 'cooldown'>('grind');
  const [showComboBuilder, setShowComboBuilder] = useState(false);
  const [comboMode, setComboMode] = useState<'custom' | 'presets'>('presets');
  const [currentCombo, setCurrentCombo] = useState<string[]>([]);
  const [editingComboIndex, setEditingComboIndex] = useState<number | null>(null);
  // The AI Coach sends you here with its plan, ready to build
  const coachPrompt = searchParams.get('coachPrompt') ?? undefined;
  const [showAIBuilder, setShowAIBuilder] = useState(!!coachPrompt);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [editingSegmentContext, setEditingSegmentContext] = useState<'speedbag' | 'combo' | 'exercises'>('combo');
  const [editingExerciseSegmentId, setEditingExerciseSegmentId] = useState<string | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  // Null until edited, so it follows the set's name even if the set is still loading
  const [shareName, setShareName] = useState<string | null>(null);
  const [shareDestination, setShareDestination] = useState<'feed' | 'club'>('feed');
  const [shareTags, setShareTags] = useState<string[]>([]);
  const [shareClubId, setShareClubId] = useState<string | null>(null);
  const [expandedLibraries, setExpandedLibraries] = useState<Map<string, boolean>>(new Map());
  
  const shareWorkout = useShareWorkout();
  const { myMemberships, clubs } = useClubs();
  const myClubs = clubs.filter(c => myMemberships.some(m => m.club_id === c.id));

  // Drag-and-drop sensors (shared for combos and phases)
  const dndSensors = useSensors(
    useSensor(BuilderPointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(BuilderTouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  // Phase drag-and-drop handler
  const handlePhaseDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const phases = getActivePhases();
    const oldIndex = phases.findIndex(p => p.id === active.id);
    const newIndex = phases.findIndex(p => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    setActivePhases(arrayMove(phases, oldIndex, newIndex));
  };
  
  // Helper to get/set combos for the currently editing phase
  const getPhaseCombos = (phaseId: string): string[][] => {
    const allPhases = [...warmupPhases, ...grindPhases, ...cooldownPhases];
    const phase = allPhases.find(p => p.id === phaseId);
    return phase?.combos || [];
  };
  
  const setPhaseCombos = (phaseId: string, newCombos: string[][]) => {
    const updateFn = (phases: WorkoutPhase[]) => 
      phases.map(p => p.id === phaseId ? { ...p, combos: newCombos } : p);
    setWarmupPhases(prev => updateFn(prev));
    setGrindPhases(prev => updateFn(prev));
    setCooldownPhases(prev => updateFn(prev));
  };

  const replaceOrAppendPhaseCombo = (phaseId: string, entry: string[]) => {
    const phaseCombos = getPhaseCombos(phaseId);

    if (editingComboIndex !== null) {
      const newCombos = [...phaseCombos];
      newCombos[editingComboIndex] = entry;
      setPhaseCombos(phaseId, newCombos);
      setEditingComboIndex(null);
      return;
    }

    setPhaseCombos(phaseId, [...phaseCombos, entry]);
  };
  
  const editingPhaseCombos = editingPhaseId ? getPhaseCombos(editingPhaseId) : [];
  const comboIds = editingPhaseCombos.map((_, i) => `combo-${i}`);
  
  const handleComboDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !editingPhaseId) return;
    const oldIndex = comboIds.indexOf(String(active.id));
    const newIndex = comboIds.indexOf(String(over.id));
    setPhaseCombos(editingPhaseId, arrayMove(editingPhaseCombos, oldIndex, newIndex));
  };

  // Load AI-generated workout from URL params
  useEffect(() => {
    if (aiWorkoutData) {
      try {
        const workout = JSON.parse(decodeURIComponent(aiWorkoutData)) as Workout;
        setWorkoutId(workout.id);
        setName(workout.name);
        setDifficulty(workout.difficulty);
        // Migrate AI workout combos to first grind phase
        const grind = workout.sections.grind.map((phase, idx) => {
          if (idx === 0 && workout.combos && workout.combos.length > 0 && !phase.combos) {
            return { ...phase, combos: workout.combos };
          }
          return phase;
        });
        setWarmupPhases(workout.sections.warmup);
        setGrindPhases(grind);
        setCooldownPhases(workout.sections.cooldown);
        setMegasetRepeats(workout.megasetRepeats || 1);
        setIsPreset(false);
        toast.success(`Loaded "${workout.name}" - customize and save or start!`);

        // Detect custom exercises not in the built-in library
        const allPhases = [...workout.sections.warmup, ...grind, ...workout.sections.cooldown];
        const customNames = new Set<string>();
        for (const phase of allPhases) {
          for (const seg of phase.segments) {
            if (seg.segmentType === 'exercise' && seg.name && !isBuiltinExercise(seg.name) && !isInLibraryRef.current(seg.name)) {
              // Skip generic names
              const generic = ['exercise', 'exercise a', 'exercise b', 'rest', 'stretch', 'stretching', 'warmup', 'cooldown'];
              if (!generic.includes(seg.name.toLowerCase())) {
                customNames.add(seg.name);
              }
            }
          }
        }
        if (customNames.size > 0) {
          const names = Array.from(customNames);
          setTimeout(() => {
            toast(`New exercises detected: ${names.join(', ')}`, {
              duration: 8000,
              action: {
                label: 'Save to Library',
                onClick: () => {
                  for (const n of names) {
                    addCustomExerciseRef.current.mutate({ name: n });
                  }
                  toast.success(`Saved ${names.length} exercise${names.length > 1 ? 's' : ''} to your library`);
                },
              },
            });
          }, 1500);
        }
      } catch (e) {
        console.error('Failed to parse AI workout data', e);
      }
    }
  }, [aiWorkoutData, addCustomExerciseRef, isInLibraryRef]);

  // Load existing workout for editing from Supabase
  useEffect(() => {
    if (editId && workouts.length > 0) {
      const dbWorkout = workouts.find(w => w.id === editId);
      if (dbWorkout) {
        const { warmup, grind, cooldown, megasetRepeats: mr } = dbPhasesToLocal(dbWorkout);
        setWorkoutId(dbWorkout.id);
        setName(dbWorkout.name);
        setDifficulty((dbWorkout.difficulty as ComboDifficulty) || 'beginner');
        setWarmupPhases(warmup);
        setGrindPhases(grind);
        setCooldownPhases(cooldown);
        setMegasetRepeats(mr);
        setIsPreset(dbWorkout.is_preset || false);
      }
    }
  }, [editId, workouts]);

  // Combos are always optional - if you run out, remaining segments are freestyle
  const combosComplete = true;

  const getActivePhases = () => {
    switch (activeSection) {
      case 'warmup': return warmupPhases;
      case 'grind': return grindPhases;
      case 'cooldown': return cooldownPhases;
    }
  };

  const setActivePhases = (phases: WorkoutPhase[]) => {
    switch (activeSection) {
      case 'warmup': setWarmupPhases(phases); break;
      case 'grind': setGrindPhases(phases); break;
      case 'cooldown': setCooldownPhases(phases); break;
    }
  };

  const addPhase = () => {
    const newPhase: WorkoutPhase = {
      id: generateId(),
      ...DEFAULT_PHASE,
      segments: [{
        id: generateId(),
        ...DEFAULT_SEGMENT,
      }],
    };
    setActivePhases([...getActivePhases(), newPhase]);
  };

  const addSuperset = () => {
    const newPhase: WorkoutPhase = {
      id: generateId(),
      name: 'Superset',
      repeats: 3,
      segments: [
        {
          id: generateId(),
          name: 'Exercise A',
          type: 'active',
          segmentType: 'exercise',
          duration: 45,
        },
        {
          id: generateId(),
          name: 'Exercise B',
          type: 'active',
          segmentType: 'exercise',
          duration: 45,
        },
        {
          id: generateId(),
          name: 'Rest',
          type: 'rest',
          segmentType: 'rest',
          duration: 30,
        },
      ],
    };
    setActivePhases([...getActivePhases(), newPhase]);
  };

  const removePhase = (phaseId: string) => {
    setActivePhases(getActivePhases().filter(p => p.id !== phaseId));
  };

  const updatePhase = (phaseId: string, updates: Partial<WorkoutPhase>) => {
    setActivePhases(getActivePhases().map(p => 
      p.id === phaseId ? { ...p, ...updates } : p
    ));
  };

  const addSegment = (phaseId: string) => {
    setActivePhases(getActivePhases().map(p => 
      p.id === phaseId 
        ? { ...p, segments: [...p.segments, { id: generateId(), ...DEFAULT_SEGMENT }] }
        : p
    ));
  };

  const removeSegment = (phaseId: string, segmentId: string) => {
    setActivePhases(getActivePhases().map(p => 
      p.id === phaseId 
        ? { ...p, segments: p.segments.filter(s => s.id !== segmentId) }
        : p
    ));
  };

  const updateSegment = (phaseId: string, segmentId: string, updates: Partial<WorkoutSegment>) => {
    setActivePhases(getActivePhases().map(p => 
      p.id === phaseId 
        ? { ...p, segments: p.segments.map(s => s.id === segmentId ? { ...s, ...updates } : s) }
        : p
    ));
  };

  const cycleSegmentType = (phaseId: string, segmentId: string, currentType?: SegmentType) => {
    const types: SegmentType[] = ['shadowboxing', 'speedbag', 'combo', 'doubleend', 'sparring', 'exercise', 'rest'];
    const currentIndex = types.indexOf(currentType || 'shadowboxing');
    const nextType = types[(currentIndex + 1) % types.length];
    const isActive = nextType !== 'rest';
    const nameMap: Record<string, string> = { exercise: 'Exercise', rest: 'Rest', shadowboxing: 'Shadowboxing', combo: 'Heavy Bag', speedbag: 'Speed Bag', doubleend: 'Double End Bag', sparring: 'Sparring' };
    updateSegment(phaseId, segmentId, { 
      segmentType: nextType, 
      type: isActive ? 'active' : 'rest',
      name: nameMap[nextType] || nextType,
    });
  };

  // Combo builder functions
  const addToCombo = (key: string) => {
    setCurrentCombo([...currentCombo, key]);
  };

  const removeFromCombo = (index: number) => {
    setCurrentCombo(currentCombo.filter((_, i) => i !== index));
  };

  const saveCombo = () => {
    if (currentCombo.length === 0 || !editingPhaseId) return;
    const phaseCombos = getPhaseCombos(editingPhaseId);
    
    if (editingComboIndex !== null) {
      const newCombos = [...phaseCombos];
      newCombos[editingComboIndex] = currentCombo;
      setPhaseCombos(editingPhaseId, newCombos);
      setEditingComboIndex(null);
    } else {
      setPhaseCombos(editingPhaseId, [...phaseCombos, currentCombo]);
    }
    setCurrentCombo([]);
    setShowComboBuilder(false);
  };

  const addPresetCombo = (preset: ComboPreset) => {
    if (!editingPhaseId) return;
    replaceOrAppendPhaseCombo(editingPhaseId, preset.combo);
  };

  const addSpeedBagDrill = (drillName: string) => {
    if (!editingPhaseId) return;
    replaceOrAppendPhaseCombo(editingPhaseId, [drillName]);
  };

  const handleLibraryEntryEdit = ({
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
  }) => {
    const target = resolveLibraryEntryTarget({ phase, segment, ctx, visibleIndex, isSuperset });
    setEditingPhaseId(phase.id);

    if (ctx === 'exercises') {
      if (target.kind === 'segmentName') {
        setEditingExerciseSegmentId(target.segmentId);
        setEditingComboIndex(null);
        setShowExercisePicker(true);
        return;
      }

      if (target.kind === 'phaseCombo') {
        setEditingExerciseSegmentId(null);
        setEditingComboIndex(target.comboIndex);
        setShowExercisePicker(true);
      }

      return;
    }

    if (target.kind !== 'phaseCombo') return;

    setEditingExerciseSegmentId(null);
    setEditingSegmentContext(ctx);
    setCurrentCombo((phase.combos || [])[target.comboIndex] || []);
    setEditingComboIndex(target.comboIndex);
    setComboMode(ctx === 'speedbag' ? 'presets' : 'custom');
    setShowComboBuilder(true);
  };

  const handleLibraryEntryDelete = ({
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
  }) => {
    const target = resolveLibraryEntryTarget({ phase, segment, ctx, visibleIndex, isSuperset });

    if (target.kind === 'segmentName') {
      removeSegment(phase.id, target.segmentId);
      return;
    }

    if (target.kind !== 'phaseCombo') return;

    setPhaseCombos(phase.id, (phase.combos || []).filter((_, comboIndex) => comboIndex !== target.comboIndex));

    if (editingPhaseId === phase.id && editingComboIndex === target.comboIndex) {
      setEditingComboIndex(null);
    }
  };

  // Determine phase context for library labels (combos vs drills vs exercises)
  const getPhaseSegmentContext = (phase: WorkoutPhase): 'speedbag' | 'combo' | 'exercises' => {
    if (phase.segments.some(s => s.segmentType === 'speedbag')) return 'speedbag';
    // Exercise-library phase: has exercise segments but NO combo/shadowboxing/speedbag/doubleend segments
    const hasComboCapableSegment = phase.segments.some(s => 
      ['combo', 'shadowboxing', 'speedbag', 'doubleend'].includes(s.segmentType || '')
    );
    const hasExerciseSegment = phase.segments.some(s => s.segmentType === 'exercise');
    if (hasExerciseSegment && !hasComboCapableSegment) return 'exercises';
    return 'combo';
  };

  const editCombo = (index: number) => {
    if (!editingPhaseId) return;
    const phaseCombos = getPhaseCombos(editingPhaseId);
    setCurrentCombo(phaseCombos[index]);
    setEditingComboIndex(index);
    setComboMode('custom');
    setShowComboBuilder(true);
  };

  const deleteCombo = (index: number) => {
    if (!editingPhaseId) return;
    const phaseCombos = getPhaseCombos(editingPhaseId);
    setPhaseCombos(editingPhaseId, phaseCombos.filter((_, i) => i !== index));
  };

  // Calculate total duration (factoring in megaset repeats)
  const calculateTotalDuration = () => {
    let total = 0;
    [...warmupPhases, ...grindPhases, ...cooldownPhases].forEach(phase => {
      const phaseTotal = phase.segments.reduce((acc, seg) => acc + seg.duration, 0);
      total += phaseTotal * phase.repeats;
    });
    return total * megasetRepeats;
  };

  const handleSave = (andStart: boolean = false) => {
    const segments = [...warmupPhases, ...grindPhases, ...cooldownPhases].flatMap((phase) => phase.segments);
    if (segments.length === 0) {
      toast.error('Add a phase with at least one segment first');
      return;
    }
    const untimed = segments.find((segment) => segment.duration <= 0);
    if (untimed) {
      toast.error(`Give "${untimed.name}" a time first`);
      return;
    }

    const id = workoutId || editId || generateId();
    const existingWorkout = workouts.find(w => w.id === id);
    
    // Convert to database format — include megaset metadata
    const phasesForDb = JSON.parse(JSON.stringify([
      ...warmupPhases.map(p => ({ ...p, section: 'warmup' })),
      ...grindPhases.map(p => ({ ...p, section: 'grind' })),
      ...cooldownPhases.map(p => ({ ...p, section: 'cooldown' })),
      // Store megaset repeats as metadata entry
      ...(megasetRepeats > 1 ? [{ _meta: true, megasetRepeats }] : []),
    ]));
    
    const workoutData = {
      name,
      description: null,
      duration: calculateTotalDuration(),
      difficulty,
      phases: phasesForDb,
      combos: null, // combos are now stored per-phase inside phasesForDb
      tags: ['boxing', difficulty],
      is_preset: existingWorkout?.is_preset || isPreset || false,
      is_archived: false,
      times_completed: existingWorkout?.times_completed || 0,
      last_used_at: existingWorkout?.last_used_at || null,
    };

    const saveAndNavigate = (savedId: string) => {
      if (andStart) {
        navigate(`/workout/${savedId}/session`);
      } else {
        toast.success(`Saved "${name}"`);
        navigate('/');
      }
    };

    if (editId) {
      updateWorkout.mutate(
        { id: editId, ...workoutData },
        {
          onSuccess: (data) => saveAndNavigate(data.id),
          onError: (error) => toast.error('Failed to save: ' + error.message),
        }
      );
    } else {
      addWorkout.mutate(workoutData, {
        onSuccess: (data) => saveAndNavigate(data.id),
        onError: (error) => toast.error('Failed to save: ' + error.message),
      });
    }
  };

  // Get available keys based on difficulty
  const punchKeys = PUNCH_KEYS_BY_DIFFICULTY[difficulty];
  const defenseKeys = DEFENSE_KEYS_BY_DIFFICULTY[difficulty];
  const movementKeys = MOVEMENT_KEYS_BY_DIFFICULTY[difficulty];
  const presets = getAllPresets(difficulty);
  const presetCategories = getPresetCategories(difficulty);
  const [presetSearch, setPresetSearch] = useState('');
  const [selectedPresetCategory, setSelectedPresetCategory] = useState<string | null>(null);

  const getSegmentTypeInfo = (segType?: SegmentType) => {
    // Map legacy 'work' to 'exercise'
    const key = (segType === 'work' || !segType) ? 'exercise' : segType;
    return SEGMENT_TYPES.find(t => t.key === key) || SEGMENT_TYPES[0];
  };

  return (
    <AppLayout hideNav>
      <BroadcastPage show={<><span className="max-[359px]:hidden">Run of show</span><span className="min-[360px]:hidden">Show</span></>} onBack={() => navigate('/')}>
        <div className="flex min-h-11 items-center justify-between gap-3 px-4 pt-2">
          <h1 className="lab lab-lime not-italic">
            {editId ? 'Edit Set' : 'Create New Set'}
          </h1>
          {editId && (
            <button
              type="button"
              onClick={() => {
                if (isGuest) {
                  promptEmailLink('share workouts');
                  return;
                }
                // onOpenChange doesn't fire when the dialog is opened from here, so the form starts fresh now
                setShareName(null);
                setShareDestination('feed');
                setShareClubId(null);
                setShareTags([]);
                setShareMessage('');
                setShowShareDialog(true);
              }}
              className="plate plate-graphite fx h-11 gap-2 px-4 text-xl"
              title="Share to Fight Club"
            >
              <Share2 className="size-4" />
              Share
            </button>
          )}
        </div>

        {/* Mode Toggle - Custom first, AI second */}
        <div className="grid grid-cols-2 gap-4 px-5 pt-2">
          <button
            type="button"
            onClick={() => {/* Stay in custom mode */}}
            aria-pressed="true"
            className={OPTION(true)}
          >
            Custom Build
          </button>
          <button
            type="button"
            onClick={() => setShowAIBuilder(true)}
            className={OPTION(false)}
          >
            AI Builder
          </button>
        </div>

        <div className="pb-36">
          {/* Workout Name */}
          <div className="px-4 pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="workout-name" className="lab">Workout Name</label>
              <p className="flex items-baseline gap-1.5 whitespace-nowrap">
                <span className="lab">Total: </span>
                <b className="fx text-4xl text-volt">{formatDuration(calculateTotalDuration())}</b>
              </p>
            </div>
            <Input
              id="workout-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workout Name"
              className={cn(FX_FIELD, 'h-14 border-volt text-[clamp(2.25rem,13vw,3rem)]')}
            />
          </div>

          {/* Section Tabs */}
          <div className="grid grid-cols-[1fr_1fr_1.25fr] gap-3.5 px-5 pt-4">
            {[
              { key: 'warmup', label: 'WARMUP' },
              { key: 'grind', label: 'ROUNDS' },
              { key: 'cooldown', label: 'COOLDOWN' },
            ].map((section) => (
              <button
                type="button"
                key={section.key}
                onClick={() => setActiveSection(section.key as 'warmup' | 'grind' | 'cooldown')}
                aria-pressed={activeSection === section.key}
                className={cn(OPTION(activeSection === section.key), 'text-lg sm:text-xl')}
              >
                {section.label}
              </button>
            ))}
          </div>

          {/* Megaset + phase repeat info - only visible when ROUNDS tab is active */}
          {activeSection === 'grind' && (
            <div className="mt-3 flex items-center justify-between gap-3 border-y border-surface-2 px-4 py-1">
              <span className="lab lab-w">Megaset</span>
              <Stepper noun="megasets" value={megasetRepeats} onChange={setMegasetRepeats} lime={megasetRepeats > 1} />
            </div>
          )}

          {/* Phases */}
          <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handlePhaseDragEnd}>
            <SortableContext items={getActivePhases().map(p => p.id)} strategy={verticalListSortingStrategy}>
            <div>
            {getActivePhases().map((phase) => {
              const activeSegmentCount = phase.segments.filter(s => s.type === 'active').length;
              const phaseCtx = getPhaseSegmentContext(phase);
              // Superset only when 2+ active segments AND not an exercise-library phase
              const isSuperset = activeSegmentCount >= 2 && phaseCtx !== 'exercises';
              return (
              <SortablePhaseWrapper key={phase.id} id={phase.id}>
                {({ dragHandleProps, style, setNodeRef, isDragging }) => (
              <div ref={setNodeRef} style={style} className={cn("mt-3 border-y border-surface-3 bg-surface-1", isDragging && "relative z-50 opacity-50")}>
                {/* Phase Header */}
                <div className="flex items-center gap-1 px-2 pt-1">
                  <div {...dragHandleProps} aria-label={`Move ${phase.name}`} className="flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing">
                    <GripVertical className="size-5 text-muted-foreground" />
                  </div>
                  <Input
                    value={phase.name}
                    aria-label="Phase name"
                    onChange={(e) => updatePhase(phase.id, { name: e.target.value })}
                    className={cn(FX_FIELD, 'min-w-0 flex-1 border-transparent text-4xl focus-visible:!border-volt')}
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${phase.name}`}
                    onClick={() => removePhase(phase.id)}
                    className="flex h-11 w-10 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 px-4 pb-2">
                  <span className="lab lab-w">Repeats</span>
                  <Stepper noun="repeats" value={phase.repeats} onChange={(repeats) => updatePhase(phase.id, { repeats })} />
                  <span className="ml-auto flex flex-col items-end gap-0.5">
                    <b className="fx whitespace-nowrap text-3xl text-muted-foreground">
                      {formatDuration(phase.segments.reduce((sum, segment) => sum + segment.duration, 0) * phase.repeats)}
                    </b>
                    {/* Superset badge (only if applicable) */}
                    {isSuperset && <span className="lab lab-lime">Superset</span>}
                  </span>
                </div>
                <PhaseTimeline segments={phase.segments} tone={(segment) => getSegmentTypeInfo(segment.segmentType).tone} />

                {/* Combo/Drill/Exercise Order Toggle */}
                {((phase.segments.some(s => ['combo', 'shadowboxing', 'speedbag', 'doubleend', 'exercise'].includes(s.segmentType || '')) || phaseCtx === 'exercises') && (phase.combos?.length || 0) > 0) && (
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-surface-3 px-4 py-1.5">
                    <span className="lab">
                      {phaseCtx === 'speedbag' ? 'Drill Order' : phaseCtx === 'exercises' ? 'Exercise Order' : 'Combo Order'}
                    </span>
                    <div className="flex gap-3.5">
                      <button
                        type="button"
                        onClick={() => updatePhase(phase.id, { comboOrder: 'sequential' })}
                        aria-pressed={(phase.comboOrder || 'sequential') === 'sequential'}
                        className={cn(OPTION((phase.comboOrder || 'sequential') === 'sequential'), 'px-3')}
                      >
                        In Order
                      </button>
                      <button
                        type="button"
                        onClick={() => updatePhase(phase.id, { comboOrder: 'random' })}
                        aria-pressed={phase.comboOrder === 'random'}
                        className={cn(OPTION(phase.comboOrder === 'random'), 'px-3')}
                      >
                        Random
                      </button>
                    </div>
                  </div>
                )}

                {/* Segments */}
                <div className="divide-y divide-surface-3 border-t border-surface-3">
                  {phase.segments.map((segment, segIdx) => {
                    const segInfo = getSegmentTypeInfo(segment.segmentType);
                    const hasComboSupport = segment.segmentType === 'combo' || segment.segmentType === 'shadowboxing' || segment.segmentType === 'speedbag' || segment.segmentType === 'doubleend' || segment.segmentType === 'exercise';
                    // Every non-rest segment shows its own library with + Add
                    const showLibrary = hasComboSupport;
                    return (
                      <div key={segment.id}>
                        <div className="flex items-center gap-2 py-1 pl-4 pr-2">
                          <button
                            type="button"
                            aria-label={`${segInfo.label}, ${segInfo.name}. Change segment type`}
                            onClick={() => cycleSegmentType(phase.id, segment.id, segment.segmentType)}
                            className={cn(plateClass({ tone: segInfo.tone }), 'fx h-11 w-11 shrink-0 text-2xl')}
                          >
                            {segInfo.label}
                          </button>
                          <Input
                            value={segment.name}
                            aria-label="Segment name"
                            onChange={(e) => updateSegment(phase.id, segment.id, { name: e.target.value })}
                            className="min-w-0 flex-1"
                          />
                          <Input
                            type="number"
                            min={1}
                            value={segment.duration}
                            aria-label="Seconds"
                            onChange={(e) => updateSegment(phase.id, segment.id, { duration: Math.max(0, parseInt(e.target.value) || 0) })}
                            className={cn(FX_FIELD, NO_SPINNER, 'w-12 shrink-0 text-center text-3xl')}
                          />
                          <span className="lab">sec</span>
                          <button
                            type="button"
                            aria-label={`Remove ${segment.name}`}
                            onClick={() => removeSegment(phase.id, segment.id)}
                            className="flex h-11 w-9 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive"
                          >
                            <X className="size-4" />
                          </button>
                        </div>

                        {/* Inline Combos - rendered after last combo-capable segment */}
                        {showLibrary && (() => {
                          const ctx = segment.segmentType === 'exercise' ? 'exercises' as const : getPhaseSegmentContext(phase);
                          const labelWord = ctx === 'speedbag' ? 'Drills' : ctx === 'exercises' ? 'Exercises' : 'Combos';
                          const emptyText = ctx === 'speedbag' 
                            ? 'No drills selected - segments will be freestyle' 
                            : ctx === 'exercises'
                            ? 'No exercises selected - segments will be freestyle'
                            : 'No combos selected - segments will be freestyle';
                          
                          // Determine if this is a superset (multiple active segment types)
                          const activeSegments = phase.segments.filter(s => s.type === 'active');
                          const isSuperset = activeSegments.length >= 2 && 
                            new Set(activeSegments.map(s => s.segmentType)).size > 1;
                          
                          // For superset phases, derive per-segment libraries independently
                          let segmentLibrary: string[][] | undefined;
                          if (isSuperset) {
                            if (ctx === 'exercises') {
                              // E segment in superset: show the segment name as its exercise entry
                              const generic = ['exercise', 'exercise a', 'exercise b'];
                              if (segment.name && !generic.includes(segment.name.toLowerCase())) {
                                segmentLibrary = [[segment.name]];
                              } else {
                                segmentLibrary = [];
                              }
                            } else if (ctx === 'speedbag') {
                              // SB segment in superset: show phase.combos entries that are drill names (not punch notation)
                              segmentLibrary = (phase.combos || []).filter(combo => 
                                combo.some(token => !/^\d/.test(token) && !/^(SLIP|ROLL|DUCK|PULL|BLOCK|PARRY|STEP|CIRCLE|PIVOT)/.test(token))
                              );
                            } else {
                              // Non-E, non-SB segment in superset (H, DB, S): show punch notation combos + FREESTYLE
                              segmentLibrary = (phase.combos || []).filter(combo => 
                                (combo.length === 1 && combo[0] === 'FREESTYLE') ||
                                combo.some(token => /^\d/.test(token) || /^(SLIP|ROLL|DUCK|PULL|BLOCK|PARRY|STEP|CIRCLE|PIVOT)/.test(token))
                              );
                            }
                          } else if (ctx === 'exercises') {
                            // Non-superset exercise segment: use phase.combos if they contain exercise names
                            // Otherwise synthesize from segment name
                            const phaseCombos = phase.combos || [];
                            const hasExerciseEntries = phaseCombos.length > 0 && phaseCombos.some(combo =>
                              combo.some(token => !/^\d$/.test(token) && !/^(SLIP|ROLL|DUCK|PULL|BLOCK|PARRY|STEP|CIRCLE|PIVOT)/.test(token))
                            );
                            if (hasExerciseEntries) {
                              segmentLibrary = phaseCombos;
                            } else {
                              const generic = ['exercise', 'exercise a', 'exercise b'];
                              if (segment.name && !generic.includes(segment.name.toLowerCase())) {
                                segmentLibrary = [[segment.name]];
                              } else {
                                segmentLibrary = [];
                              }
                            }
                          } else {
                            segmentLibrary = phase.combos;
                          }
                          
                          const libraryEntries = segmentLibrary || [];
                          
                          const libraryKey = `${phase.id}-${segIdx}`;
                          const explicitState = expandedLibraries.get(libraryKey);
                          const isLibraryExpanded = explicitState !== undefined ? explicitState : libraryEntries.length <= 3;
                          const toggleLibrary = () => {
                            setExpandedLibraries(prev => {
                              const next = new Map(prev);
                              next.set(libraryKey, !isLibraryExpanded);
                              return next;
                            });
                          };
                          
                          return (
                          <div className="px-3 pb-2">
                            <div className="flex items-center justify-between gap-3">
                              <button
                                type="button"
                                onClick={toggleLibrary}
                                aria-expanded={isLibraryExpanded}
                                className="lab flex min-h-11 items-center gap-1.5 transition-colors hover:text-foreground"
                              >
                                <ChevronDown className={cn("size-4 transition-transform", !isLibraryExpanded && "-rotate-90")} />
                                {labelWord} ({libraryEntries.length})
                              </button>
                              <button
                                onClick={() => {
                                  setEditingPhaseId(phase.id);
                                   setEditingExerciseSegmentId(null);
                                  if (ctx === 'exercises') {
                                     setEditingComboIndex(null);
                                    setShowExercisePicker(true);
                                  } else {
                                    setEditingSegmentContext(ctx);
                                    setCurrentCombo([]);
                                    setEditingComboIndex(null);
                                    setComboMode('presets');
                                    setPresetSearch('');
                                    setSelectedPresetCategory(null);
                                    setShowComboBuilder(true);
                                  }
                                  // Auto-expand when adding
                                  setExpandedLibraries(prev => { const next = new Map(prev); next.set(libraryKey, true); return next; });
                                }}
                                className="plate plate-lime fx h-11 gap-1.5 px-4 text-xl"
                              >
                                <Plus className="size-4" />
                                Add
                              </button>
                            </div>
                            {isLibraryExpanded && (
                              <>
                                {libraryEntries.length === 0 ? (
                                  <p className={cn(
                                    "prose-w py-2 text-base",
                                    phase.name?.toLowerCase().includes('championship') 
                                      ? "text-[hsl(var(--championship-gold))]" 
                                      : "text-muted-foreground"
                                  )}>
                                    {phase.name?.toLowerCase().includes('championship') ? 'Freestyle' : emptyText}
                                  </p>
                                ) : (
                                  <DndContext
                                    sensors={dndSensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={(event) => {
                                      const { active, over } = event;
                                      if (!over || active.id === over.id) return;
                                      const ids = libraryEntries.map((_, i) => `combo-${phase.id}-${segIdx}-${i}`);
                                      const oldIndex = ids.indexOf(active.id as string);
                                      const newIndex = ids.indexOf(over.id as string);
                                      if (!isSuperset) {
                                        setPhaseCombos(phase.id, arrayMove(phase.combos || [], oldIndex, newIndex));
                                      }
                                    }}
                                  >
                                    <SortableContext 
                                      items={libraryEntries.map((_, i) => `combo-${phase.id}-${segIdx}-${i}`)} 
                                      strategy={verticalListSortingStrategy}
                                    >
                                      <div>
                                        {libraryEntries.map((combo, idx) => (
                                          <SortableComboItem
                                            key={`combo-${phase.id}-${segIdx}-${idx}`}
                                            id={`combo-${phase.id}-${segIdx}-${idx}`}
                                            combo={combo}
                                            index={idx}
                                            onEdit={() => {
                                              handleLibraryEntryEdit({
                                                phase,
                                                segment,
                                                ctx,
                                                visibleIndex: idx,
                                                isSuperset,
                                              });
                                            }}
                                            onDelete={() => {
                                              handleLibraryEntryDelete({
                                                phase,
                                                segment,
                                                ctx,
                                                visibleIndex: idx,
                                                isSuperset,
                                              });
                                            }}
                                          />
                                        ))}
                                      </div>
                                    </SortableContext>
                                  </DndContext>
                                )}
                              </>
                            )}
                          </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>

                {/* Add Segment */}
                <button
                  type="button"
                  onClick={() => addSegment(phase.id)}
                  className="fx flex min-h-11 w-full items-center justify-center gap-1.5 border-t border-surface-3 text-xl text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                >
                  <Plus className="size-4" />
                  Add Segment
                </button>
              </div>
              )}
              </SortablePhaseWrapper>
              );
            })}

            {/* Add Phase */}
            <div className="px-5 pt-4">
              <button
                type="button"
                onClick={addPhase}
                className="plate plate-graphite fx h-14 w-full gap-2 text-3xl"
              >
                <Plus className="size-5" />
                Add Phase
              </button>
            </div>
            </div>
            </SortableContext>
          </DndContext>

        </div>

        {/* Combo Builder Modal */}
        {showComboBuilder && (
          <div className="fixed inset-0 z-50 overflow-y-auto overflow-x-clip bg-background">
            <div className="mx-auto max-w-[46rem] pb-8">
            <header className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-background px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
              <button type="button" aria-label="Close" onClick={() => setShowComboBuilder(false)} className="plate plate-graphite h-11 w-12 shrink-0">
                <X className="size-5" />
              </button>
              <h2 className="fx min-w-0 truncate py-1 text-4xl">
                {editingSegmentContext === 'speedbag' 
                  ? (editingComboIndex !== null ? 'Edit Drill' : 'Add Drill')
                  : editingSegmentContext === 'exercises'
                  ? (editingComboIndex !== null ? 'Edit Exercise' : 'Add Exercise')
                  : (editingComboIndex !== null ? 'Edit Combo' : 'Add Combo')}
              </h2>
              {comboMode === 'custom' ? (
                <Button onClick={saveCombo} size="sm" className="shrink-0" disabled={currentCombo.length === 0}>
                  Save
                </Button>
              ) : (
                <div className="w-12" />
              )}
            </header>

            {/* Difficulty + Mode Toggle */}
            {editingSegmentContext !== 'exercises' && (
            <div className="space-y-3 border-b border-surface-3 px-5 pb-3 pt-1">
              {/* Difficulty Tabs */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {(['rookie', 'beginner', 'intermediate', 'advanced', 'pro'] as const).map((d) => (
                  <button
                    type="button"
                    key={d}
                    onClick={() => setDifficulty(d)}
                    aria-pressed={difficulty === d}
                    className={cn(OPTION(difficulty === d), 'flex-auto px-2.5 text-lg sm:text-xl')}
                  >
                    {d}
                  </button>
                ))}
              </div>
              {/* Mode Toggle - only for combos */}
              {editingSegmentContext !== 'speedbag' && (
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setComboMode('presets')}
                  aria-pressed={comboMode === 'presets'}
                  className={cn('plate fx h-11 text-2xl', comboMode === 'presets' ? 'plate-lime' : 'plate-graphite')}
                >
                  Presets
                </button>
                <button
                  type="button"
                  onClick={() => setComboMode('custom')}
                  aria-pressed={comboMode === 'custom'}
                  className={cn('plate fx h-11 text-2xl', comboMode === 'custom' ? 'plate-lime' : 'plate-graphite')}
                >
                  Custom
                </button>
              </div>
              )}
            </div>
            )}

            {/* Exercise name input mode */}
            {editingSegmentContext === 'exercises' ? (
              <div className="px-4 py-4">
                <p className="lab lab-lime mb-2">
                  ADD EXERCISE SET
                </p>
                <p className="prose-w mb-3 text-base text-muted-foreground">
                  Type the exercises for this round. Use "&" to combine multiple exercises in one set.
                </p>
                <div className="space-y-4">
                  <Input
                    id="exercise-name-input"
                    placeholder="e.g. Mountain Climbers & Squat Jumps"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val && editingPhaseId) {
                          addSpeedBagDrill(val);
                          (e.target as HTMLInputElement).value = '';
                          setShowComboBuilder(false);
                        }
                      }
                    }}
                  />
                  <div className="px-1">
                    <Button
                      onClick={() => {
                        const input = document.getElementById('exercise-name-input') as HTMLInputElement;
                        const val = input?.value?.trim();
                        if (val && editingPhaseId) {
                          addSpeedBagDrill(val);
                          input.value = '';
                          setShowComboBuilder(false);
                        }
                      }}
                      className="w-full"
                    >
                      Add Exercise Set
                    </Button>
                  </div>
                </div>
              </div>
            ) : (comboMode === 'presets' || editingSegmentContext === 'speedbag') ? (
              /* Presets List */
              <div className="pt-3">
                {editingSegmentContext === 'speedbag' ? (
                  <>
                    <p className="lab lab-lime px-4 pb-1">
                      {difficulty.toUpperCase()} DRILLS
                    </p>
                    <div>
                      {(() => {
                        const DRILL_CATEGORIES: Record<string, string[]> = {
                          rookie: ['single-alternating', 'doubles'],
                          beginner: ['single-alternating', 'doubles', 'double-right-lead', 'double-left-lead', 'side-to-side'],
                          intermediate: ['triples', 'triple-right-lead', 'triple-left-lead', 'fist-rolls-forward', 'backfists', 'elbow-strikes'],
                          advanced: ['fist-rolls-reverse', 'one-two-rhythm'],
                          pro: [],
                        };
                        const availableIds = (() => {
                          const levels = ['rookie', 'beginner', 'intermediate', 'advanced', 'pro'];
                          const idx = levels.indexOf(difficulty);
                          return levels.slice(0, idx + 1).flatMap(l => DRILL_CATEGORIES[l]);
                        })();
                        return SPEED_BAG_DRILLS
                          .filter(d => d.id !== 'freestyle' && availableIds.includes(d.id))
                          .map((drill) => (
                          <button
                            type="button"
                            key={drill.id}
                            onClick={() => {
                              addSpeedBagDrill(drill.name);
                              setShowComboBuilder(false);
                            }}
                            className="flex min-h-11 w-full items-center gap-3 border-b border-surface-2 px-4 py-2 text-left transition-colors hover:bg-surface-1"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="fx text-3xl">{drill.name}</p>
                              <p className="prose-w mt-1 text-sm text-muted-foreground">{drill.description}</p>
                            </div>
                            <Plus className="size-5 shrink-0 text-volt" />
                          </button>
                        ));
                      })()}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Search bar */}
                    <div className="relative mx-4 mb-2">
                      <Search className="absolute left-0 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search combos (e.g. slip, 7, roll)..."
                        value={presetSearch}
                        onChange={(e) => setPresetSearch(e.target.value)}
                        className="pl-6"
                      />
                    </div>
                    {/* Category filter pills */}
                    <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1.5 px-5">
                      {presetCategories.map((cat, catIdx) => {
                        const isActive = selectedPresetCategory === cat.name;
                        // Shorten category names for compact pills
                        const shortName = cat.name
                          .replace(/\s*Combos?\s*/gi, ' ')
                          .replace(/\s*No Defense\s*/gi, '')
                          .replace(/\s*at End\s*/gi, '')
                          .replace(/\s*Full Armada\s*/gi, '')
                          .replace(/True Pro\s*—?\s*/gi, 'Pro ')
                          .replace(/\s*—\s*9\s*&\s*10/gi, '')
                          .replace(/Body Uppercuts?/gi, 'Body UC')
                          .replace(/Counter-Punching/gi, 'Counter')
                          .replace(/Mastery/gi, '')
                          .replace(/Patterns/gi, '')
                          .replace(/Footwork/gi, '')
                          .replace(/Mixed\s*/gi, '')
                          .replace(/All Defense Types/gi, 'All Def')
                          .replace(/\s+/g, ' ')
                          .trim();
                        return (
                          <button
                            type="button"
                            key={catIdx}
                            onClick={() => setSelectedPresetCategory(isActive ? null : cat.name)}
                            aria-pressed={isActive}
                            className={cn(OPTION(isActive), 'px-3 text-lg')}
                          >
                            {shortName}
                          </button>
                        );
                      })}
                    </div>
                    {/* Flat combo list */}
                    {(() => {
                      const existingCombos = editingPhaseId ? getPhaseCombos(editingPhaseId) : [];
                      const isComboAdded = (combo: string[]) =>
                        existingCombos.some(ec => ec.length === combo.length && ec.every((m, i) => m === combo[i]));
                      const searchLower = presetSearch.toLowerCase();
                      
                      const visibleCombos: { combo: string[]; catName: string; idx: number }[] = [];
                      presetCategories.forEach((cat) => {
                        if (selectedPresetCategory && cat.name !== selectedPresetCategory) return;
                        cat.combos.forEach((combo, idx) => {
                          if (searchLower && !combo.some(m => m.toLowerCase().includes(searchLower))) return;
                          visibleCombos.push({ combo, catName: cat.name, idx });
                        });
                      });

                      if (visibleCombos.length === 0) {
                        return <p className="fx px-4 py-8 text-3xl text-muted-foreground">No combos found</p>;
                      }

                      return (
                        <div className="border-t border-surface-3">
                          {visibleCombos.map(({ combo, catName, idx }) => {
                            const added = isComboAdded(combo);
                            const comboKey = `${difficulty}-${catName}-${idx}`;
                            return (
                              <button
                                type="button"
                                key={comboKey}
                                aria-pressed={added}
                                onClick={() => {
                                  if (added) {
                                    // Deselect: remove this combo from phase
                                    if (editingPhaseId) {
                                      const phaseCombos = getPhaseCombos(editingPhaseId);
                                      const removeIdx = phaseCombos.findIndex(ec => ec.length === combo.length && ec.every((m, i) => m === combo[i]));
                                      if (removeIdx !== -1) {
                                        setPhaseCombos(editingPhaseId, phaseCombos.filter((_, i) => i !== removeIdx));
                                      }
                                    }
                                  } else {
                                    addPresetCombo({ id: comboKey, name: combo.join('-'), combo, difficulty });
                                  }
                                }}
                                className={cn(
                                  'flex min-h-11 w-full items-center gap-3 border-b border-surface-2 px-4 py-1.5 text-left transition-colors',
                                  added ? 'bg-surface-2' : 'hover:bg-surface-1'
                                )}
                              >
                                <span className="min-w-0 flex-1">
                                  <MovePlates combo={combo} />
                                </span>
                                {added ? (
                                  <Check className="size-5 shrink-0 text-volt" />
                                ) : (
                                  <Plus className="size-5 shrink-0 text-muted-foreground" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            ) : (
              /* Custom Builder */
              <div>
                {/* Current Combo Display */}
                <div className="border-b border-surface-3 px-5 py-3">
                  <div className="flex min-h-[4.5rem] flex-wrap items-center justify-center gap-x-6 gap-y-2">
                    {currentCombo.length === 0 ? (
                      <p className="lab lab-w">Tap keys to build combo</p>
                    ) : (
                      currentCombo.map((move, idx) => {
                        const isPunch = toComboMove(move).type === 'punch';
                        return (
                          <button
                            type="button"
                            key={idx}
                            aria-label={`Remove ${move}`}
                            onClick={() => removeFromCombo(idx)}
                            className={cn(plateClass(MOVE_PLATE[toComboMove(move).type]), 'fx h-[4.5rem] px-4', isPunch ? 'min-w-16 text-7xl' : 'text-4xl')}
                          >
                            {move}
                          </button>
                        );
                      })
                    )}
                  </div>
                  {currentCombo.some((move) => toComboMove(move).name) && (
                    <p className="fx mt-2 text-center text-2xl">
                      {currentCombo.map((move) => toComboMove(move).name).filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>

                {/* Punch Keys */}
                <div className="px-5 pt-3">
                  <p className="lab mb-2">Punches</p>
                  <div className="grid grid-cols-4 gap-x-5 gap-y-2 sm:grid-cols-5">
                    {punchKeys.map((key) => (
                      <button
                        type="button"
                        key={key}
                        onClick={() => addToCombo(key)}
                        className="plate plate-lime fx h-14 text-5xl"
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Defense Keys */}
                {defenseKeys.length > 0 && (
                <div className="px-5 pt-4">
                  <p className="lab mb-2">Defense leans back</p>
                  <div className="grid grid-cols-3 gap-x-5 gap-y-2 sm:grid-cols-5">
                    {defenseKeys.map((key) => (
                      <button
                        type="button"
                        key={key}
                        onClick={() => addToCombo(key)}
                        className="plate plate-white plate-back fx h-12 text-3xl"
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                </div>
                )}

                {/* Movement Keys - only show if available */}
                {movementKeys.length > 0 && (
                  <div className="px-5 pt-4">
                    <p className="lab mb-2">Movement</p>
                    <div className="grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-5">
                      {movementKeys.map((key) => (
                        <button
                          type="button"
                          key={key}
                          onClick={() => addToCombo(key)}
                          className="plate plate-graphite fx h-12 text-3xl"
                        >
                          {key}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        )}

        {/* The run of show's numbers, and the way out */}
        <div className="app-footer">
          <div className="app-footer-inner bg-background">
            <Ticker
              tone="dark"
              items={[
                tally(grindPhases.reduce((sum, phase) => sum + phase.repeats, 0) * megasetRepeats, 'round'),
                tally([...warmupPhases, ...grindPhases, ...cooldownPhases].length, 'phase'),
                tally([...warmupPhases, ...grindPhases, ...cooldownPhases].reduce((sum, phase) => sum + phase.segments.length, 0), 'segment'),
              ]}
            />
            <div className="grid grid-cols-[3fr_2fr] gap-4 px-5 py-2.5 safe-bottom">
              <Button onClick={() => handleSave(false)} variant="steel" className="px-2">
                Save Workout
              </Button>
              <Button onClick={() => handleSave(true)} className="px-2">
                <PlayIcon />
                Start
              </Button>
            </div>
          </div>
        </div>

        {/* AI Builder Modal */}
        {showAIBuilder && (
          <AIBuilderModal onClose={() => setShowAIBuilder(false)} startingPrompt={coachPrompt} />
        )}

        {/* Share to Fight Club Dialog */}
        <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-5xl">Share to Fight Club</DialogTitle>
              <DialogDescription className="prose-w text-base text-muted-foreground">
                Share your workout with the community.
              </DialogDescription>
            </DialogHeader>
            <div className="min-w-0 space-y-5 py-1">
              {/* Workout Name */}
              <div>
                <label htmlFor="share-name" className="lab block">Workout Name</label>
                <Input
                  id="share-name"
                  value={shareName ?? name}
                  onChange={(e) => setShareName(e.target.value)}
                  placeholder="Workout name"
                  className={cn(FX_FIELD, 'h-14 border-volt text-5xl')}
                />
              </div>

              {/* Destination Selector */}
              <div>
                <span className="lab block">Share to</span>
                <div className="mt-2 grid grid-cols-2 gap-4 px-1">
                  <button
                    type="button"
                    onClick={() => { setShareDestination('feed'); setShareClubId(null); }}
                    className={cn('plate fx h-11 text-2xl', shareDestination === 'feed' ? 'plate-lime' : 'plate-graphite')}
                  >
                    Public
                  </button>
                  <button
                    type="button"
                    onClick={() => setShareDestination('club')}
                    className={cn('plate fx h-11 text-2xl', shareDestination === 'club' ? 'plate-lime' : 'plate-graphite')}
                  >
                    Private
                  </button>
                </div>

                {/* Club selector submenu */}
                {shareDestination === 'club' && (
                  <div className="mt-2">
                    {myClubs.length === 0 ? (
                      <p className="prose-w text-base text-muted-foreground">You haven't joined any clubs yet.</p>
                    ) : (
                      myClubs.map((club) => (
                        <button
                          type="button"
                          key={club.id}
                          onClick={() => setShareClubId(club.id)}
                          aria-pressed={shareClubId === club.id}
                          className={cn(
                            'fx flex min-h-11 w-full items-center justify-between gap-3 border-b border-surface-3 py-1 text-left text-3xl',
                            shareClubId === club.id ? 'text-volt' : 'text-foreground'
                          )}
                        >
                          <span className="min-w-0 break-words">{club.name}</span>
                          {shareClubId === club.id && <Check className="size-5 shrink-0" />}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Tags */}
              <div>
                <span className="lab block">Tags</span>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 px-1">
                  {['Boxing', 'HIIT', 'Conditioning', 'Beginner', 'Intermediate', 'Advanced', 'Cardio', 'Speed Bag'].map((tag) => (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => setShareTags(prev => 
                        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                      )}
                      aria-pressed={shareTags.includes(tag)}
                      className={cn('plate fx h-11 px-3 text-xl', shareTags.includes(tag) ? 'plate-white' : 'plate-graphite')}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div>
                <label htmlFor="share-note" className="lab mb-2 block">Note</label>
                <Textarea
                  id="share-note"
                  value={shareMessage}
                  onChange={(e) => setShareMessage(e.target.value)}
                  placeholder="Add a note about this workout... (optional)"
                  className="resize-none bg-surface-2 text-foreground"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter className="gap-3">
              <Button 
                variant="secondary" 
                onClick={() => {
                  setShowShareDialog(false);
                  setShareMessage('');
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  const workout: Workout = {
                    id: workoutId || editId || generateId(),
                    name: shareName || name,
                    icon: '🥊',
                    difficulty,
                    totalDuration: calculateTotalDuration(),
                    isPreset: false,
                    isArchived: false,
                    createdAt: new Date(),
                    timesCompleted: 0,
                    sections: {
                      warmup: warmupPhases,
                      grind: grindPhases,
                      cooldown: cooldownPhases,
                    },
                    combos: undefined,
                  };
                  
                  shareWorkout.mutate(
                    { 
                      workout, 
                      message: shareMessage || undefined,
                      customName: shareName && shareName !== name ? shareName : undefined,
                      tags: shareTags.length > 0 ? shareTags : undefined,
                      destination: shareDestination,
                      clubId: shareDestination === 'club' ? (shareClubId || undefined) : undefined,
                    },
                    {
                      onSuccess: () => {
                        toast.success('Shared to Fight Club!');
                        setShowShareDialog(false);
                        setShareMessage('');
                      },
                      onError: (error) => {
                        toast.error('Failed to share: ' + error.message);
                      },
                    }
                  );
                }}

                disabled={shareWorkout.isPending || (shareDestination === 'club' && !shareClubId)}
              >
                {shareWorkout.isPending ? 'Sharing...' : 'Share'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Exercise Picker Modal */}
        <ExercisePickerModal
          open={showExercisePicker}
          onClose={() => {
            setShowExercisePicker(false);
            setEditingExerciseSegmentId(null);
            setEditingComboIndex(null);
          }}
          onConfirm={(exercises) => {
            if (editingPhaseId) {
              if (editingExerciseSegmentId) {
                updateSegment(editingPhaseId, editingExerciseSegmentId, { name: exercises.join(' & ') });
              } else {
                replaceOrAppendPhaseCombo(editingPhaseId, exercises);
              }
            }
            setEditingExerciseSegmentId(null);
            setEditingComboIndex(null);
          }}
        />
      </BroadcastPage>
    </AppLayout>
  );
};

export default Build;
