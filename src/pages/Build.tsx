import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Plus, Trash2, GripVertical, Pencil, Play, X, ChevronDown, ChevronUp, Sparkles, Share2, Shuffle, ListOrdered, Repeat } from 'lucide-react';
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
  PUNCH_KEYS_BY_DIFFICULTY, 
  DEFENSE_KEYS_BY_DIFFICULTY, 
  MOVEMENT_KEYS_BY_DIFFICULTY,
  ComboPreset 
} from '@/data/comboPresets';
import { SPEED_BAG_DRILLS } from '@/data/speedBagDrills';
import { AIBuilderModal } from '@/components/AIBuilderModal';
import { useShareWorkout } from '@/hooks/useCommunityPosts';
import { useClubs } from '@/hooks/useClubs';
import { toast } from 'sonner';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SEGMENT_TYPES: { key: SegmentType; label: string; color: string }[] = [
  { key: 'work', label: 'W', color: 'bg-volt/20 text-volt' },
  { key: 'rest', label: 'R', color: 'bg-zinc-500/20 text-zinc-400' },
  { key: 'shadowboxing', label: 'S', color: 'bg-purple-500/20 text-purple-400' },
  { key: 'combo', label: 'H', color: 'bg-red-500/20 text-red-400' },
  { key: 'speedbag', label: 'SB', color: 'bg-orange-500/20 text-orange-400' },
  { key: 'doubleend', label: 'DB', color: 'bg-sky-500/20 text-sky-400' },
];

const DEFAULT_SEGMENT: Omit<WorkoutSegment, 'id'> = {
  name: 'Work',
  type: 'active',
  segmentType: 'work',
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
function dbPhasesToLocal(dbWorkout: DbWorkout): { warmup: WorkoutPhase[], grind: WorkoutPhase[], cooldown: WorkoutPhase[], supersetRepeats: number } {
  const phases = dbWorkout.phases as any[];
  const metaEntry = phases?.find((p: any) => p._meta);
  const supersetRepeats = metaEntry?.supersetRepeats || 1;
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
  
  return { warmup, grind, cooldown, supersetRepeats };
}

const Build = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const aiWorkoutData = searchParams.get('ai');
  
  const { workouts, addWorkout, updateWorkout } = useWorkouts();
  const user = useUserStore((state) => state.user);
  
  // Get default difficulty based on user's experience level
  const getDefaultDifficulty = (): 'beginner' | 'intermediate' | 'advanced' => {
    const level = user?.experienceLevel;
    if (level === 'complete_beginner' || level === 'beginner') return 'beginner';
    if (level === 'intermediate') return 'intermediate';
    if (level === 'advanced' || level === 'pro') return 'advanced';
    return 'beginner';
  };
  
  // Form state
  const [name, setName] = useState('New Workout');
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>(getDefaultDifficulty());
  const [warmupPhases, setWarmupPhases] = useState<WorkoutPhase[]>([]);
  const [grindPhases, setGrindPhases] = useState<WorkoutPhase[]>([]);
  const [cooldownPhases, setCooldownPhases] = useState<WorkoutPhase[]>([]);
  const [supersetRepeats, setSupersetRepeats] = useState(1);
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
  const [editingSegmentContext, setEditingSegmentContext] = useState<'speedbag' | 'combo'>('combo');
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [shareName, setShareName] = useState('');
  const [shareDestination, setShareDestination] = useState<'feed' | 'club'>('feed');
  const [shareTags, setShareTags] = useState<string[]>([]);
  const [shareClubId, setShareClubId] = useState<string | null>(null);
  
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
        setIsPreset(false);
        toast.success(`Loaded "${workout.name}" - customize and save or start!`);
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
        const { warmup, grind, cooldown, supersetRepeats: sr } = dbPhasesToLocal(dbWorkout);
        setWorkoutId(dbWorkout.id);
        setName(dbWorkout.name);
        setDifficulty((dbWorkout.difficulty as 'beginner' | 'intermediate' | 'advanced') || 'beginner');
        setWarmupPhases(warmup);
        setGrindPhases(grind);
        setCooldownPhases(cooldown);
        setSupersetRepeats(sr);
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
    const types: SegmentType[] = ['work', 'rest', 'shadowboxing', 'combo', 'speedbag', 'doubleend'];
    const currentIndex = types.indexOf(currentType || 'work');
    const nextType = types[(currentIndex + 1) % types.length];
    const isActive = nextType !== 'rest';
    const nameMap: Record<string, string> = { work: 'Work', rest: 'Rest', shadowboxing: 'Shadowboxing', combo: 'Heavy Bag', speedbag: 'Speed Bag', doubleend: 'Double End Bag' };
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

  // Determine if a phase has speed bag segments (for context-aware labels)
  const getPhaseSegmentContext = (phase: WorkoutPhase): 'speedbag' | 'combo' => {
    return phase.segments.some(s => s.segmentType === 'speedbag') ? 'speedbag' : 'combo';
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

  // Calculate total duration (factoring in superset repeats)
  const calculateTotalDuration = () => {
    let total = 0;
    [...warmupPhases, ...grindPhases, ...cooldownPhases].forEach(phase => {
      const phaseTotal = phase.segments.reduce((acc, seg) => acc + seg.duration, 0);
      total += phaseTotal * phase.repeats;
    });
    return total * supersetRepeats;
  };

  const handleSave = (andStart: boolean = false) => {
    const id = workoutId || editId || generateId();
    const existingWorkout = workouts.find(w => w.id === id);
    
    // Convert to database format — include superset metadata
    const phasesForDb = JSON.parse(JSON.stringify([
      ...warmupPhases.map(p => ({ ...p, section: 'warmup' })),
      ...grindPhases.map(p => ({ ...p, section: 'grind' })),
      ...cooldownPhases.map(p => ({ ...p, section: 'cooldown' })),
      // Store superset repeats as metadata entry
      ...(supersetRepeats > 1 ? [{ _meta: true, supersetRepeats }] : []),
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

  const getSegmentTypeInfo = (segType?: SegmentType) => {
    return SEGMENT_TYPES.find(t => t.key === (segType || 'work')) || SEGMENT_TYPES[0];
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
            <div className="flex gap-2 mt-3">
              {(['beginner', 'intermediate', 'advanced'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium uppercase transition-colors',
                    difficulty === d 
                      ? 'bg-volt text-primary-foreground' 
                      : 'bg-surface-1 text-muted-foreground'
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
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

          {/* Superset toggle - only visible when ROUNDS tab is active */}
          {activeSection === 'grind' && (
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-3">
              <div className="flex items-center gap-2">
                <Repeat className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Superset</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setSupersetRepeats(Math.max(1, supersetRepeats - 1))}
                  className={cn(
                    'w-6 h-6 rounded bg-surface-2 flex items-center justify-center text-muted-foreground transition-opacity',
                    supersetRepeats <= 1 && 'opacity-30 pointer-events-none'
                  )}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <span className={cn(
                  'w-8 text-center text-sm font-semibold',
                  supersetRepeats > 1 ? 'text-volt' : 'text-muted-foreground'
                )}>
                  ×{supersetRepeats}
                </span>
                <button
                  onClick={() => setSupersetRepeats(supersetRepeats + 1)}
                  className="w-6 h-6 rounded bg-surface-2 flex items-center justify-center text-muted-foreground"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Phases */}
          <div className="px-4 py-4 space-y-4">
            {getActivePhases().map((phase) => (
              <div key={phase.id} className="bg-surface-1 rounded-xl border border-surface-3 overflow-hidden">
                {/* Phase Header */}
                <div className="flex items-center gap-3 p-3 border-b border-surface-3">
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                  <Input
                    value={phase.name}
                    onChange={(e) => updatePhase(phase.id, { name: e.target.value })}
                    className="flex-1 bg-transparent border-none font-semibold text-foreground p-0 h-auto focus-visible:ring-0"
                  />
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
                  <button
                    onClick={() => removePhase(phase.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Combo Order Toggle - show if phase has combo or shadowboxing segments */}
                {phase.segments.some(s => ['combo', 'shadowboxing', 'speedbag', 'doubleend'].includes(s.segmentType || '')) && (phase.combos?.length || 0) > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 border-b border-surface-3">
                    <span className="text-xs text-muted-foreground">
                      {getPhaseSegmentContext(phase) === 'speedbag' ? 'Drill Order' : 'Combo Order'}
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
                    const hasComboSupport = segment.segmentType === 'combo' || segment.segmentType === 'shadowboxing' || segment.segmentType === 'speedbag' || segment.segmentType === 'doubleend';
                    // Only show combos after the LAST combo-capable segment in the phase
                    const isLastComboSegment = hasComboSupport && !phase.segments.slice(segIdx + 1).some(
                      s => s.segmentType === 'combo' || s.segmentType === 'shadowboxing' || s.segmentType === 'speedbag' || s.segmentType === 'doubleend'
                    );
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
                        {isLastComboSegment && (() => {
                          const ctx = getPhaseSegmentContext(phase);
                          const labelWord = ctx === 'speedbag' ? 'Drills' : 'Combos';
                          const emptyText = ctx === 'speedbag' 
                            ? 'No drills — segments will be freestyle' 
                            : 'No combos — segments will be freestyle';
                          return (
                          <div className="px-3 pb-3 pt-1">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                {labelWord} ({phase.combos?.length || 0})
                              </span>
                              <button
                                onClick={() => {
                                  setEditingPhaseId(phase.id);
                                  setEditingSegmentContext(ctx);
                                  setCurrentCombo([]);
                                  setEditingComboIndex(null);
                                  setComboMode('presets');
                                  setShowComboBuilder(true);
                                }}
                                className="text-xs font-medium text-volt hover:text-volt/80 flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                Add
                              </button>
                            </div>
                            {(phase.combos?.length || 0) === 0 ? (
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
                                  const ids = (phase.combos || []).map((_, i) => `combo-${phase.id}-${i}`);
                                  const oldIndex = ids.indexOf(active.id as string);
                                  const newIndex = ids.indexOf(over.id as string);
                                  setPhaseCombos(phase.id, arrayMove(phase.combos || [], oldIndex, newIndex));
                                }}
                              >
                                <SortableContext 
                                  items={(phase.combos || []).map((_, i) => `combo-${phase.id}-${i}`)} 
                                  strategy={verticalListSortingStrategy}
                                >
                                  <div className="space-y-1.5">
                                    {(phase.combos || []).map((combo, idx) => (
                                      <SortableComboItem
                                        key={`combo-${phase.id}-${idx}`}
                                        id={`combo-${phase.id}-${idx}`}
                                        combo={combo}
                                        index={idx}
                                        onEdit={(i) => {
                                          setEditingPhaseId(phase.id);
                                          setEditingSegmentContext(ctx);
                                          setCurrentCombo((phase.combos || [])[i]);
                                          setEditingComboIndex(i);
                                          setComboMode(ctx === 'speedbag' ? 'presets' : 'custom');
                                          setShowComboBuilder(true);
                                        }}
                                        onDelete={(i) => {
                                          setPhaseCombos(phase.id, (phase.combos || []).filter((_, ci) => ci !== i));
                                        }}
                                      />
                                    ))}
                                  </div>
                                </SortableContext>
                              </DndContext>
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
            ))}

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

            {/* Mode Toggle - hide Custom tab for speed bag */}
            {editingSegmentContext !== 'speedbag' && (
            <div className="px-4 py-3 border-b border-surface-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setComboMode('presets')}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                    comboMode === 'presets'
                      ? 'bg-volt text-primary-foreground'
                      : 'bg-surface-1 text-muted-foreground'
                  )}
                >
                  Presets
                </button>
                <button
                  onClick={() => setComboMode('custom')}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                    comboMode === 'custom'
                      ? 'bg-volt text-primary-foreground'
                      : 'bg-surface-1 text-muted-foreground'
                  )}
                >
                  Custom
                </button>
              </div>
            </div>
            )}

            {(comboMode === 'presets' || editingSegmentContext === 'speedbag') ? (
              /* Presets List */
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {editingSegmentContext === 'speedbag' ? (
                  <>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                      SPEED BAG DRILLS
                    </p>
                    <div className="space-y-2">
                      {SPEED_BAG_DRILLS.filter(d => d.id !== 'freestyle').map((drill) => (
                        <button
                          key={drill.id}
                          onClick={() => {
                            addSpeedBagDrill(drill.name);
                            setShowComboBuilder(false);
                          }}
                          className="w-full flex items-center gap-3 bg-surface-1 rounded-lg p-3 border border-surface-3 hover:border-orange-500 transition-colors text-left"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-foreground text-sm">{drill.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">{drill.description}</p>
                          </div>
                          <Plus className="w-5 h-5 text-orange-400" />
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                      {difficulty.toUpperCase()} PRESETS
                    </p>
                    <div className="space-y-2">
                      {presets.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => {
                            addPresetCombo(preset);
                            setShowComboBuilder(false);
                          }}
                          className="w-full flex items-center gap-3 bg-surface-1 rounded-lg p-3 border border-surface-3 hover:border-volt transition-colors text-left"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-foreground text-sm">{preset.name}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {preset.combo.map((move, idx) => (
                                <span 
                                  key={idx} 
                                  className={cn(
                                    'px-1.5 py-0.5 rounded text-[10px] font-medium',
                                    move.includes('SLIP') || move.includes('ROLL') || move.includes('PULL') || move.includes('BLOCK')
                                      ? 'bg-yellow-500/20 text-yellow-500'
                                      : move.includes('CIRCLE') || move.includes('STEP')
                                      ? 'bg-blue-500/20 text-blue-400'
                                      : 'bg-volt/20 text-volt'
                                  )}
                                >
                                  {move}
                                </span>
                              ))}
                            </div>
                          </div>
                          <Plus className="w-5 h-5 text-volt" />
                        </button>
                      ))}
                    </div>
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
      </div>
    </AppLayout>
  );
};

export default Build;
