import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Plus, Trash2, GripVertical, Pencil, Play, X, ChevronDown, ChevronUp, Sparkles, Share2, Shuffle, ListOrdered, Repeat, Layers, Search, Check } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
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
import { ExercisePickerModal, isBuiltinExercise } from '@/components/ExercisePickerModal';
import { useCustomExercises } from '@/hooks/useCustomExercises';
import { AIBuilderModal } from '@/components/AIBuilderModal';
import { useShareWorkout } from '@/hooks/useCommunityPosts';
import { useClubs } from '@/hooks/useClubs';
import { toast } from 'sonner';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SEGMENT_TYPES: { key: SegmentType; label: string; color: string }[] = [
  { key: 'shadowboxing', label: 'S', color: 'bg-purple-500/20 text-purple-400' },
  { key: 'speedbag', label: 'SB', color: 'bg-orange-500/20 text-orange-400' },
  { key: 'combo', label: 'H', color: 'bg-red-500/20 text-red-400' },
  { key: 'doubleend', label: 'DB', color: 'bg-sky-500/20 text-sky-400' },
  { key: 'sparring', label: 'SP', color: 'bg-amber-500/20 text-amber-400' },
  { key: 'exercise', label: 'E', color: 'bg-emerald-500/20 text-emerald-400' },
  { key: 'rest', label: 'R', color: 'bg-zinc-500/20 text-zinc-400' },
];

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 bg-surface-1 rounded-lg p-3 border border-surface-3',
        isDragging && 'opacity-50 shadow-2xl z-50'
      )}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none p-1 -ml-1">
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>
      <span className="text-xs text-muted-foreground w-6">#{index + 1}</span>
      <div className="flex-1 flex flex-wrap gap-1">
        {combo.map((move, mIdx) => (
          <span key={mIdx} className="px-2 py-0.5 rounded text-xs font-medium bg-volt/20 text-volt">
            {move}
          </span>
        ))}
      </div>
      <button onClick={() => onEdit(index)} className="text-muted-foreground hover:text-foreground">
        <Pencil className="w-4 h-4" />
      </button>
      <button onClick={() => onDelete(index)} className="text-muted-foreground hover:text-destructive">
        <Trash2 className="w-4 h-4" />
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
  const phases = dbWorkout.phases as any[];
  const metaEntry = phases?.find((p: any) => p._meta);
  const megasetRepeats = metaEntry?.megasetRepeats || metaEntry?.supersetRepeats || 1;
  const actualPhases = phases?.filter((p: any) => !p._meta) || [];
  const warmup = actualPhases.filter((p: any) => p.section === 'warmup').map(({ section, ...rest }: any) => rest) || [];
  const grind = actualPhases.filter((p: any) => p.section === 'grind').map(({ section, ...rest }: any) => rest) || [];
  const cooldown = actualPhases.filter((p: any) => p.section === 'cooldown').map(({ section, ...rest }: any) => rest) || [];
  
  // Migrate: if top-level combos exist but no phase has combos, attach to first grind phase with combo segments
  const topLevelCombos: string[][] = dbWorkout.combos || [];
  const anyPhaseHasCombos = [...warmup, ...grind, ...cooldown].some((p: any) => p.combos && p.combos.length > 0);
  
  if (topLevelCombos.length > 0 && !anyPhaseHasCombos) {
    // Find first grind phase with combo/shadowboxing segments
    const targetPhase = grind.find((p: any) => 
      p.segments?.some((s: any) => s.segmentType === 'combo' || s.segmentType === 'shadowboxing')
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
  const [showAIBuilder, setShowAIBuilder] = useState(false);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [editingSegmentContext, setEditingSegmentContext] = useState<'speedbag' | 'combo' | 'exercises'>('combo');
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [shareName, setShareName] = useState('');
  const [shareDestination, setShareDestination] = useState<'feed' | 'club'>('feed');
  const [shareTags, setShareTags] = useState<string[]>([]);
  const [shareClubId, setShareClubId] = useState<string | null>(null);
  const [expandedLibraries, setExpandedLibraries] = useState<Map<string, boolean>>(new Map());
  
  const shareWorkout = useShareWorkout();
  const { myMemberships, clubs } = useClubs();
  const myClubs = clubs.filter(c => myMemberships.some(m => m.club_id === c.id));

  // Combo drag-and-drop
  const comboSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );
  
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
  
  const editingPhaseCombos = editingPhaseId ? getPhaseCombos(editingPhaseId) : [];
  const comboIds = useMemo(() => editingPhaseCombos.map((_, i) => `combo-${i}`), [editingPhaseCombos]);
  
  const handleComboDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !editingPhaseId) return;
    const oldIndex = comboIds.indexOf(active.id);
    const newIndex = comboIds.indexOf(over.id);
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
            if (seg.segmentType === 'exercise' && seg.name && !isBuiltinExercise(seg.name) && !isInLibrary(seg.name)) {
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
                    addCustomExercise.mutate({ name: n });
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
  }, [aiWorkoutData]);

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
    const phaseCombos = getPhaseCombos(editingPhaseId);
    setPhaseCombos(editingPhaseId, [...phaseCombos, preset.combo]);
  };

  const addSpeedBagDrill = (drillName: string) => {
    if (!editingPhaseId) return;
    const phaseCombos = getPhaseCombos(editingPhaseId);
    setPhaseCombos(editingPhaseId, [...phaseCombos, [drillName]]);
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
        toast.success(`Starting "${name}"`);
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
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-4 safe-top border-b border-surface-3">
          <button 
            onClick={() => navigate('/')}
            className="text-muted-foreground"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold text-muted-foreground">
            {editId ? 'Edit Set' : 'Create New Set'}
          </h1>
          {editId ? (
            <button
              onClick={() => setShowShareDialog(true)}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-volt transition-colors text-sm font-medium"
              title="Share to Fight Club"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          ) : (
            <div className="w-14" /> 
          )}
        </header>

        {/* Mode Toggle - Custom first, AI second */}
        <div className="px-4 py-3 border-b border-surface-3">
          <div className="flex gap-2">
            <button
              onClick={() => {/* Stay in custom mode */}}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-volt text-primary-foreground"
            >
              Custom Build
            </button>
            <button
              onClick={() => setShowAIBuilder(true)}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-surface-1 border border-surface-3 text-muted-foreground hover:bg-surface-2 transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-volt" />
              AI Builder
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-32">
          {/* Workout Name */}
          <div className="px-4 py-4 border-b border-surface-3">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workout Name"
              className="text-xl font-bold bg-transparent border-none text-foreground placeholder:text-muted-foreground p-0 h-auto focus-visible:ring-0"
            />
            <p className="text-sm text-muted-foreground mt-2">
              Total: {formatDuration(calculateTotalDuration())}
            </p>
          </div>

          {/* Section Tabs */}
          <div className="flex border-b border-surface-3">
            {[
              { key: 'warmup', label: 'WARMUP' },
              { key: 'grind', label: 'ROUNDS' },
              { key: 'cooldown', label: 'COOLDOWN' },
            ].map((section) => (
              <button
                key={section.key}
                onClick={() => setActiveSection(section.key as 'warmup' | 'grind' | 'cooldown')}
                className={cn(
                  'flex-1 py-3 text-sm font-semibold uppercase tracking-wider transition-colors',
                  activeSection === section.key 
                    ? 'text-volt border-b-2 border-volt' 
                    : 'text-muted-foreground'
                )}
              >
                {section.label}
              </button>
            ))}
          </div>

          {/* Megaset + phase repeat info - only visible when ROUNDS tab is active */}
          {activeSection === 'grind' && (
            <div className="flex items-center justify-between px-4 py-2 border-b border-surface-3">
              <div className="flex items-center gap-2">
                <Repeat className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Megaset</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMegasetRepeats(Math.max(1, megasetRepeats - 1))}
                  className={cn(
                    'w-6 h-6 rounded bg-surface-2 flex items-center justify-center text-muted-foreground transition-opacity',
                    megasetRepeats <= 1 && 'opacity-30 pointer-events-none'
                  )}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <span className={cn(
                  'w-8 text-center text-sm font-semibold',
                  megasetRepeats > 1 ? 'text-volt' : 'text-muted-foreground'
                )}>
                  ×{megasetRepeats}
                </span>
                <button
                  onClick={() => setMegasetRepeats(megasetRepeats + 1)}
                  className="w-6 h-6 rounded bg-surface-2 flex items-center justify-center text-muted-foreground"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Phases */}
          <div className="px-4 py-4 space-y-4">
            {getActivePhases().map((phase) => {
              const activeSegmentCount = phase.segments.filter(s => s.type === 'active').length;
              const phaseCtx = getPhaseSegmentContext(phase);
              // Superset only when 2+ active segments AND not an exercise-library phase
              const isSuperset = activeSegmentCount >= 2 && phaseCtx !== 'exercises';
              return (
              <div key={phase.id} className="bg-surface-1 rounded-xl border border-surface-3 overflow-hidden">
                {/* Phase Header */}
                <div className="p-3 border-b border-surface-3 space-y-1">
                  {/* Row 1: drag handle + name + trash */}
                  <div className="flex items-center gap-3">
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    <Input
                      value={phase.name}
                      onChange={(e) => updatePhase(phase.id, { name: e.target.value })}
                      className="flex-1 bg-transparent border-none font-semibold text-foreground p-0 h-auto focus-visible:ring-0"
                    />
                    <button
                      onClick={() => removePhase(phase.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Row 2: superset badge (left) + repeat controls (right) */}
                  <div className="flex items-center justify-between pl-7">
                    {isSuperset ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                        <Layers className="w-3 h-3" />
                        Superset
                      </span>
                    ) : <span />}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updatePhase(phase.id, { repeats: Math.max(1, phase.repeats - 1) })}
                        className="w-6 h-6 rounded bg-surface-2 flex items-center justify-center text-muted-foreground"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium text-foreground">
                        ×{phase.repeats}
                      </span>
                      <button
                        onClick={() => updatePhase(phase.id, { repeats: phase.repeats + 1 })}
                        className="w-6 h-6 rounded bg-surface-2 flex items-center justify-center text-muted-foreground"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Combo/Drill/Exercise Order Toggle */}
                {((phase.segments.some(s => ['combo', 'shadowboxing', 'speedbag', 'doubleend', 'exercise'].includes(s.segmentType || '')) || phaseCtx === 'exercises') && (phase.combos?.length || 0) > 0) && (
                  <div className="flex items-center justify-between px-3 py-2 border-b border-surface-3">
                    <span className="text-xs text-muted-foreground">
                      {phaseCtx === 'speedbag' ? 'Drill Order' : phaseCtx === 'exercises' ? 'Exercise Order' : 'Combo Order'}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => updatePhase(phase.id, { comboOrder: 'sequential' })}
                        className={cn(
                          'flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors',
                          (phase.comboOrder || 'sequential') === 'sequential'
                            ? 'bg-volt/20 text-volt'
                            : 'bg-surface-2 text-muted-foreground'
                        )}
                      >
                        <ListOrdered className="w-3 h-3" />
                        In Order
                      </button>
                      <button
                        onClick={() => updatePhase(phase.id, { comboOrder: 'random' })}
                        className={cn(
                          'flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors',
                          phase.comboOrder === 'random'
                            ? 'bg-volt/20 text-volt'
                            : 'bg-surface-2 text-muted-foreground'
                        )}
                      >
                        <Shuffle className="w-3 h-3" />
                        Random
                      </button>
                    </div>
                  </div>
                )}

                {/* Segments */}
                <div className="divide-y divide-surface-3">
                  {phase.segments.map((segment, segIdx) => {
                    const segInfo = getSegmentTypeInfo(segment.segmentType);
                    const hasComboSupport = segment.segmentType === 'combo' || segment.segmentType === 'shadowboxing' || segment.segmentType === 'speedbag' || segment.segmentType === 'doubleend' || segment.segmentType === 'exercise';
                    // Every non-rest segment shows its own library with + Add
                    const showLibrary = hasComboSupport;
                    return (
                      <div key={segment.id}>
                        <div className="flex items-center gap-3 p-3">
                          <button
                            onClick={() => cycleSegmentType(phase.id, segment.id, segment.segmentType)}
                            className={cn(
                              'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold',
                              segInfo.color
                            )}
                          >
                            {segInfo.label}
                          </button>
                          <Input
                            value={segment.name}
                            onChange={(e) => updateSegment(phase.id, segment.id, { name: e.target.value })}
                            className="flex-1 bg-surface-2 border-surface-3 text-foreground text-sm h-8"
                          />
                          <Input
                            type="number"
                            value={segment.duration}
                            onChange={(e) => updateSegment(phase.id, segment.id, { duration: parseInt(e.target.value) || 0 })}
                            className="w-16 bg-surface-2 border-surface-3 text-foreground text-sm h-8 text-center"
                          />
                          <span className="text-xs text-muted-foreground">sec</span>
                          <button
                            onClick={() => removeSegment(phase.id, segment.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="w-4 h-4" />
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
                            } else {
                              // Non-E segment in superset (DB, H, etc.): show phase.combos only
                              // if they contain actual combo notation, not leaked exercise names
                              segmentLibrary = (phase.combos || []).filter(combo => 
                                combo.some(token => /^\d/.test(token) || /^[A-Z]-/.test(token))
                              );
                            }
                          } else if (ctx === 'exercises') {
                            // Non-superset exercise segment: synthesize library from segment name
                            const generic = ['exercise', 'exercise a', 'exercise b'];
                            if (segment.name && !generic.includes(segment.name.toLowerCase())) {
                              segmentLibrary = [[segment.name]];
                            } else {
                              segmentLibrary = [];
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
                          <div className="px-3 pb-3 pt-1">
                            <div className="flex items-center justify-between mb-2">
                              <button
                                onClick={toggleLibrary}
                                className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 hover:text-foreground transition-colors"
                              >
                                <ChevronDown className={cn("w-3 h-3 transition-transform", !isLibraryExpanded && "-rotate-90")} />
                                {labelWord} ({libraryEntries.length})
                              </button>
                              <button
                                onClick={() => {
                                  setEditingPhaseId(phase.id);
                                  if (ctx === 'exercises') {
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
                                className="text-xs font-medium text-volt hover:text-volt/80 flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                Add
                              </button>
                            </div>
                            {isLibraryExpanded && (
                              <>
                                {libraryEntries.length === 0 ? (
                                  <p className="text-xs text-muted-foreground text-center py-2">
                                    {emptyText}
                                  </p>
                                ) : (
                                  <DndContext
                                    sensors={comboSensors}
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
                                      <div className="space-y-1.5">
                                        {libraryEntries.map((combo, idx) => (
                                          <SortableComboItem
                                            key={`combo-${phase.id}-${segIdx}-${idx}`}
                                            id={`combo-${phase.id}-${segIdx}-${idx}`}
                                            combo={combo}
                                            index={idx}
                                            onEdit={(i) => {
                                              if (isSuperset) return;
                                              setEditingPhaseId(phase.id);
                                              setEditingSegmentContext(ctx);
                                              setCurrentCombo((phase.combos || [])[i]);
                                              setEditingComboIndex(i);
                                              setComboMode(ctx === 'speedbag' ? 'presets' : 'custom');
                                              setShowComboBuilder(true);
                                            }}
                                            onDelete={(i) => {
                                              if (isSuperset) return;
                                              setPhaseCombos(phase.id, (phase.combos || []).filter((_, ci) => ci !== i));
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
                  onClick={() => addSegment(phase.id)}
                  className="w-full p-2 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors flex items-center justify-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add Segment
                </button>
              </div>
              );
            })}

            {/* Add Phase */}
            <button
              onClick={addPhase}
              className="w-full p-4 rounded-xl border-2 border-dashed border-surface-3 text-muted-foreground hover:text-foreground hover:border-volt transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Phase
            </button>
          </div>

        </div>

        {/* Combo Builder Modal */}
        {showComboBuilder && (
          <div className="fixed inset-0 bg-background/95 z-50 flex flex-col">
            <header className="flex items-center justify-between px-4 py-4 border-b border-surface-3">
              <button onClick={() => setShowComboBuilder(false)} className="text-muted-foreground">
                <X className="w-6 h-6" />
              </button>
              <h2 className="font-bold text-foreground">
                {editingSegmentContext === 'speedbag' 
                  ? (editingComboIndex !== null ? 'Edit Drill' : 'Add Drill')
                  : editingSegmentContext === 'exercises'
                  ? (editingComboIndex !== null ? 'Edit Exercise' : 'Add Exercise')
                  : (editingComboIndex !== null ? 'Edit Combo' : 'Add Combo')}
              </h2>
              {comboMode === 'custom' ? (
                <Button onClick={saveCombo} size="sm" className="bg-volt text-primary-foreground" disabled={currentCombo.length === 0}>
                  Save
                </Button>
              ) : (
                <div className="w-12" />
              )}
            </header>

            {/* Difficulty + Mode Toggle */}
            {editingSegmentContext !== 'exercises' && (
            <div className="px-4 py-3 border-b border-surface-3 space-y-3">
              {/* Difficulty Tabs */}
              <div className="space-y-2 border border-surface-3 rounded-xl p-2.5 bg-surface-1/30">
                <div className="flex gap-2">
                  {(['rookie', 'beginner', 'intermediate'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={cn(
                        'flex-1 py-1.5 rounded-full text-xs font-medium uppercase transition-colors',
                        difficulty === d 
                          ? 'bg-volt text-primary-foreground' 
                          : 'bg-surface-2 text-muted-foreground'
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  {(['advanced', 'pro'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={cn(
                        'flex-1 py-1.5 rounded-full text-xs font-medium uppercase transition-colors',
                        difficulty === d 
                          ? 'bg-volt text-primary-foreground' 
                          : 'bg-surface-2 text-muted-foreground'
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              {/* Mode Toggle - only for combos */}
              {editingSegmentContext !== 'speedbag' && (
              <div className="relative flex bg-surface-2 rounded-lg p-0.5 h-9">
                <div
                  className="absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] bg-volt rounded-md transition-transform duration-200 ease-out"
                  style={{ transform: comboMode === 'custom' ? 'translateX(calc(100% + 4px))' : 'translateX(0)' }}
                />
                <button
                  onClick={() => setComboMode('presets')}
                  className={cn(
                    'relative z-10 flex-1 text-xs font-semibold uppercase tracking-wide transition-colors',
                    comboMode === 'presets' ? 'text-background' : 'text-muted-foreground'
                  )}
                >
                  Presets
                </button>
                <button
                  onClick={() => setComboMode('custom')}
                  className={cn(
                    'relative z-10 flex-1 text-xs font-semibold uppercase tracking-wide transition-colors',
                    comboMode === 'custom' ? 'text-background' : 'text-muted-foreground'
                  )}
                >
                  Custom
                </button>
              </div>
              )}
            </div>
            )}

            {/* Exercise name input mode */}
            {editingSegmentContext === 'exercises' ? (
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                  ADD EXERCISE SET
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  Type the exercises for this round. Use "&" to combine multiple exercises in one set.
                </p>
                <div className="space-y-3">
                  <Input
                    id="exercise-name-input"
                    placeholder="e.g. Mountain Climbers & Squat Jumps"
                    className="bg-surface-2 border-surface-3 text-foreground"
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
                    className="w-full bg-volt text-primary-foreground"
                  >
                    Add Exercise Set
                  </Button>
                </div>
              </div>
            ) : (comboMode === 'presets' || editingSegmentContext === 'speedbag') ? (
              /* Presets List */
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {editingSegmentContext === 'speedbag' ? (
                  <>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                      {difficulty.toUpperCase()} DRILLS
                    </p>
                    <div className="space-y-2">
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
                            key={drill.id}
                            onClick={() => {
                              addSpeedBagDrill(drill.name);
                              setShowComboBuilder(false);
                            }}
                            className="w-full flex items-center gap-3 bg-surface-1 rounded-lg p-3 border border-surface-3 hover:border-volt/50 transition-colors text-left"
                          >
                            <div className="flex-1">
                              <p className="font-medium text-foreground text-sm">{drill.name}</p>
                              <p className="text-xs text-muted-foreground mt-1">{drill.description}</p>
                            </div>
                            <Plus className="w-5 h-5 text-volt/60" />
                          </button>
                        ));
                      })()}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Search bar */}
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search combos (e.g. slip, 7, roll)..."
                        value={presetSearch}
                        onChange={(e) => setPresetSearch(e.target.value)}
                        className="pl-9 bg-surface-2 border-surface-3 text-foreground text-sm h-9"
                      />
                    </div>
                    {/* Category filter pills */}
                    <div className="flex flex-wrap gap-1 mb-3">
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
                            key={catIdx}
                            onClick={() => setSelectedPresetCategory(isActive ? null : cat.name)}
                            className={cn(
                              'px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors whitespace-nowrap',
                              isActive
                                ? 'bg-volt text-background border-volt'
                                : 'bg-surface-2 text-muted-foreground border-surface-3 hover:border-foreground/30'
                            )}
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
                        return <p className="text-muted-foreground text-sm text-center py-8">No combos found</p>;
                      }

                      return (
                        <div className="space-y-1.5">
                          {visibleCombos.map(({ combo, catName, idx }) => {
                            const added = isComboAdded(combo);
                            const comboKey = `${difficulty}-${catName}-${idx}`;
                            return (
                              <button
                                key={comboKey}
                                onClick={() => {
                                  if (!added) {
                                    addPresetCombo({ id: comboKey, name: combo.join('-'), combo, difficulty });
                                  }
                                }}
                                disabled={added}
                                className={cn(
                                  'w-full flex items-center gap-3 rounded-lg p-2.5 border transition-colors text-left',
                                  added
                                    ? 'bg-surface-1/50 border-surface-3/50 opacity-60'
                                    : 'bg-surface-1 border-surface-3 hover:border-volt'
                                )}
                              >
                                <div className="flex-1">
                                  <div className="flex flex-wrap gap-1">
                                    {combo.map((move, mIdx) => {
                                      const isDefense = move.includes('SLIP') || move.includes('ROLL') || move.includes('PULL');
                                      const isMovement = move.includes('CIRCLE');
                                      const isBody = ['7', '8', '9', '10'].includes(move);
                                      return (
                                        <span
                                          key={mIdx}
                                          className={cn(
                                            'px-1.5 py-0.5 rounded text-[10px] font-medium',
                                            isDefense ? 'bg-yellow-500/20 text-yellow-500'
                                              : isMovement ? 'bg-blue-500/20 text-blue-400'
                                              : isBody ? 'bg-orange-500/20 text-orange-400'
                                              : 'bg-volt/20 text-volt'
                                          )}
                                        >
                                          {move}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                                {added ? (
                                  <Check className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <Plus className="w-4 h-4 text-volt" />
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
              <div className="flex-1 overflow-y-auto">
                {/* Current Combo Display */}
                <div className="px-4 py-6 border-b border-surface-3">
                  <div className="min-h-[60px] flex flex-wrap items-center gap-2 justify-center">
                    {currentCombo.length === 0 ? (
                      <p className="text-muted-foreground">Tap keys to build combo</p>
                    ) : (
                      currentCombo.map((move, idx) => (
                        <button
                          key={idx}
                          onClick={() => removeFromCombo(idx)}
                          className={cn(
                            'px-4 py-2 rounded-lg font-bold text-lg',
                            move.includes('SLIP') || move.includes('ROLL') || move.includes('PULL') || move.includes('BLOCK')
                              ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30'
                              : move.includes('CIRCLE') || move.includes('STEP')
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : 'bg-volt/20 text-volt border border-volt/30'
                          )}
                        >
                          {move}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Punch Keys */}
                <div className="px-4 py-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Punches</p>
                  <div className="grid grid-cols-4 gap-2">
                    {punchKeys.map((key) => (
                      <button
                        key={key}
                        onClick={() => addToCombo(key)}
                        className="aspect-square rounded-xl bg-surface-1 border border-surface-3 text-foreground font-bold text-xl hover:bg-volt hover:text-primary-foreground transition-colors"
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Defense Keys */}
                <div className="px-4 py-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Defense</p>
                  <div className="grid grid-cols-3 gap-2">
                    {defenseKeys.map((key) => (
                      <button
                        key={key}
                        onClick={() => addToCombo(key)}
                        className="py-3 rounded-xl bg-surface-1 border border-surface-3 text-foreground font-medium text-sm hover:bg-volt hover:text-primary-foreground transition-colors"
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Movement Keys - only show if available */}
                {movementKeys.length > 0 && (
                  <div className="px-4 py-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Movement</p>
                    <div className="grid grid-cols-2 gap-2">
                      {movementKeys.map((key) => (
                        <button
                          key={key}
                          onClick={() => addToCombo(key)}
                          className="py-3 rounded-xl bg-surface-1 border border-surface-3 text-foreground font-medium text-sm hover:bg-volt hover:text-primary-foreground transition-colors"
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
        )}

        {/* Fixed Save Button at Bottom */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-surface-3 safe-bottom">
          <div className="flex gap-2">
            <Button onClick={() => handleSave(false)} variant="outline" className="flex-1 border-surface-3">
              Save Workout
            </Button>
            <Button onClick={() => handleSave(true)} className="flex-1 bg-volt text-primary-foreground hover:bg-volt/90">
              <Play className="w-4 h-4 mr-2" />
              Start
            </Button>
          </div>
        </div>

        {/* AI Builder Modal */}
        {showAIBuilder && (
          <AIBuilderModal
            onClose={() => setShowAIBuilder(false)}
            onGenerate={(prompt) => {
              toast.success('AI workout generation coming soon!');
              setShowAIBuilder(false);
            }}
          />
        )}

        {/* Share to Fight Club Dialog */}
        <Dialog open={showShareDialog} onOpenChange={(open) => {
          setShowShareDialog(open);
          if (open) {
            setShareName(name);
            setShareDestination('feed');
            setShareClubId(null);
            setShareTags([]);
            setShareMessage('');
          }
        }}>
          <DialogContent className="bg-background border-surface-3 max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">Share to Fight Club</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Share your workout with the community.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 py-2">
              {/* Workout Name */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Workout Name</label>
                <Input
                  value={shareName}
                  onChange={(e) => setShareName(e.target.value)}
                  placeholder="Workout name"
                  className="bg-surface-1 border-surface-3 text-foreground"
                />
              </div>

              {/* Destination Selector */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Share to</label>
                <div className="flex gap-2 p-1 bg-surface-1 rounded-lg">
                  <button
                    onClick={() => { setShareDestination('feed'); setShareClubId(null); }}
                    className={cn(
                      'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all',
                      shareDestination === 'feed'
                        ? 'bg-volt text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Public
                  </button>
                  <button
                    onClick={() => setShareDestination('club')}
                    className={cn(
                      'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all',
                      shareDestination === 'club'
                        ? 'bg-volt text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Private
                  </button>
                </div>

                {/* Club selector submenu */}
                {shareDestination === 'club' && (
                  <div className="space-y-2 mt-2">
                    {myClubs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">You haven't joined any clubs yet.</p>
                    ) : (
                      myClubs.map((club) => (
                        <button
                          key={club.id}
                          onClick={() => setShareClubId(club.id)}
                          className={cn(
                            'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
                            shareClubId === club.id
                              ? 'border-volt bg-volt/10'
                              : 'border-surface-3 bg-surface-1 hover:border-muted-foreground'
                          )}
                        >
                          <span className="text-xl">{club.icon}</span>
                          <span className="text-sm font-medium text-foreground">{club.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {['Boxing', 'HIIT', 'Conditioning', 'Beginner', 'Intermediate', 'Advanced', 'Cardio', 'Speed Bag'].map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setShareTags(prev => 
                        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                      )}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                        shareTags.includes(tag)
                          ? 'bg-volt text-primary-foreground border-volt'
                          : 'bg-surface-1 text-muted-foreground border-surface-3 hover:border-muted-foreground'
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Note</label>
                <Textarea
                  value={shareMessage}
                  onChange={(e) => setShareMessage(e.target.value)}
                  placeholder="Add a note about this workout... (optional)"
                  className="bg-surface-1 border-surface-3 text-foreground placeholder:text-muted-foreground resize-none"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowShareDialog(false);
                  setShareMessage('');
                }}
                className="border-surface-3"
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
                      customName: shareName !== name ? shareName : undefined,
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
                className="bg-volt text-primary-foreground hover:bg-volt/90"
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
          onClose={() => setShowExercisePicker(false)}
          onConfirm={(exercises) => {
            if (editingPhaseId) {
              const phaseCombos = getPhaseCombos(editingPhaseId);
              setPhaseCombos(editingPhaseId, [...phaseCombos, exercises]);
            }
          }}
        />
      </div>
    </AppLayout>
  );
};

export default Build;
