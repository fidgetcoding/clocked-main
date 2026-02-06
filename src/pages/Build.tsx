import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, GripVertical, Pencil, Play, X, ChevronDown, ChevronUp, Sparkles, Share2 } from 'lucide-react';
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
import { AIBuilderModal } from '@/components/AIBuilderModal';
import { useShareWorkout } from '@/hooks/useCommunityPosts';
import { toast } from 'sonner';

const SEGMENT_TYPES: { key: SegmentType; label: string; color: string }[] = [
  { key: 'work', label: 'W', color: 'bg-volt/20 text-volt' },
  { key: 'rest', label: 'R', color: 'bg-surface-2 text-muted-foreground' },
  { key: 'shadowboxing', label: 'S', color: 'bg-volt/10 text-volt' },
  { key: 'combo', label: 'C', color: 'bg-volt/30 text-volt' },
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

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (secs === 0) return `${mins}m`;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Helper to convert DB workout phases to local format
function dbPhasesToLocal(dbWorkout: DbWorkout): { warmup: WorkoutPhase[], grind: WorkoutPhase[], cooldown: WorkoutPhase[], combos: string[][] } {
  const phases = dbWorkout.phases as any[];
  const warmup = phases?.filter((p: any) => p.section === 'warmup').map(({ section, ...rest }) => rest) || [];
  const grind = phases?.filter((p: any) => p.section === 'grind').map(({ section, ...rest }) => rest) || [];
  const cooldown = phases?.filter((p: any) => p.section === 'cooldown').map(({ section, ...rest }) => rest) || [];
  
  // Use top-level combos from database (the new column), fallback to extracting from phases for legacy data
  let combos: string[][] = dbWorkout.combos || [];
  
  // Fallback: try to extract combos from phases if top-level is empty (legacy support)
  if (combos.length === 0) {
    phases?.forEach((phase: any) => {
      if (phase.combos) {
        combos.push(...phase.combos);
      }
    });
  }
  
  return { warmup, grind, cooldown, combos };
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
  const [combos, setCombos] = useState<string[][]>([]);
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [isPreset, setIsPreset] = useState(false);
  
  // UI state
  const [activeSection, setActiveSection] = useState<'warmup' | 'grind' | 'cooldown'>('grind');
  const [showComboBuilder, setShowComboBuilder] = useState(false);
  const [comboMode, setComboMode] = useState<'custom' | 'presets'>('presets');
  const [currentCombo, setCurrentCombo] = useState<string[]>([]);
  const [editingComboIndex, setEditingComboIndex] = useState<number | null>(null);
  const [showAIBuilder, setShowAIBuilder] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  
  const shareWorkout = useShareWorkout();

  // Load AI-generated workout from URL params
  useEffect(() => {
    if (aiWorkoutData) {
      try {
        const workout = JSON.parse(decodeURIComponent(aiWorkoutData)) as Workout;
        setWorkoutId(workout.id);
        setName(workout.name);
        setDifficulty(workout.difficulty);
        setWarmupPhases(workout.sections.warmup);
        setGrindPhases(workout.sections.grind);
        setCooldownPhases(workout.sections.cooldown);
        setCombos(workout.combos || []);
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
        const { warmup, grind, cooldown, combos: extractedCombos } = dbPhasesToLocal(dbWorkout);
        setWorkoutId(dbWorkout.id);
        setName(dbWorkout.name);
        setDifficulty((dbWorkout.difficulty as 'beginner' | 'intermediate' | 'advanced') || 'beginner');
        setWarmupPhases(warmup);
        setGrindPhases(grind);
        setCooldownPhases(cooldown);
        setCombos(extractedCombos);
        setIsPreset(dbWorkout.is_preset || false);
      }
    }
  }, [editId, workouts]);

  // Count combo segments to determine required combos
  // NOTE: Shadowboxing uses the SAME combo as combo segments, so we only count unique rounds
  const countComboSegments = () => {
    let count = 0;
    [...warmupPhases, ...grindPhases, ...cooldownPhases].forEach(phase => {
      // Check if this phase has combo OR shadowboxing - if either exists, count once per repeat
      const hasComboOrShadow = phase.segments.some(seg => 
        seg.segmentType === 'combo' || seg.segmentType === 'shadowboxing'
      );
      if (hasComboOrShadow) {
        count += phase.repeats;
      }
    });
    return count;
  };

  const requiredCombos = countComboSegments();
  // No minimum required - combos are always optional, just a suggestion
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
    const types: SegmentType[] = ['work', 'rest', 'shadowboxing', 'combo'];
    const currentIndex = types.indexOf(currentType || 'work');
    const nextType = types[(currentIndex + 1) % types.length];
    const isActive = nextType !== 'rest';
    updateSegment(phaseId, segmentId, { 
      segmentType: nextType, 
      type: isActive ? 'active' : 'rest',
      name: nextType.charAt(0).toUpperCase() + nextType.slice(1),
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
    if (currentCombo.length === 0) return;
    
    if (editingComboIndex !== null) {
      const newCombos = [...combos];
      newCombos[editingComboIndex] = currentCombo;
      setCombos(newCombos);
      setEditingComboIndex(null);
    } else {
      setCombos([...combos, currentCombo]);
    }
    setCurrentCombo([]);
    setShowComboBuilder(false);
  };

  const addPresetCombo = (preset: ComboPreset) => {
    setCombos([...combos, preset.combo]);
  };

  const editCombo = (index: number) => {
    setCurrentCombo(combos[index]);
    setEditingComboIndex(index);
    setComboMode('custom');
    setShowComboBuilder(true);
  };

  const deleteCombo = (index: number) => {
    setCombos(combos.filter((_, i) => i !== index));
  };

  // Calculate total duration
  const calculateTotalDuration = () => {
    let total = 0;
    [...warmupPhases, ...grindPhases, ...cooldownPhases].forEach(phase => {
      const phaseTotal = phase.segments.reduce((acc, seg) => acc + seg.duration, 0);
      total += phaseTotal * phase.repeats;
    });
    return total;
  };

  const handleSave = (andStart: boolean = false) => {
    const id = workoutId || editId || generateId();
    const existingWorkout = workouts.find(w => w.id === id);
    
    // Convert to database format
    const phasesForDb = JSON.parse(JSON.stringify([
      ...warmupPhases.map(p => ({ ...p, section: 'warmup' })),
      ...grindPhases.map(p => ({ ...p, section: 'grind' })),
      ...cooldownPhases.map(p => ({ ...p, section: 'cooldown' })),
    ]));
    
    const workoutData = {
      name,
      description: null,
      duration: calculateTotalDuration(),
      difficulty,
      phases: phasesForDb,
      combos: combos,
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
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/');
              }
            }} 
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

                {/* Segments */}
                <div className="divide-y divide-surface-3">
                  {phase.segments.map((segment) => {
                    const segInfo = getSegmentTypeInfo(segment.segmentType);
                    return (
                      <div key={segment.id} className="flex items-center gap-3 p-3">
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

          {/* Combos Section - Only show on Rounds tab */}
          {activeSection === 'grind' && (
            <div className="px-4 py-4 border-t border-surface-3">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-foreground">Combos ({combos.length})</h3>
                  {requiredCombos > 0 && combos.length < requiredCombos && (
                    <p className="text-xs text-muted-foreground">
                      {requiredCombos - combos.length} combo{requiredCombos - combos.length > 1 ? 's' : ''} suggested
                    </p>
                  )}
                </div>
                <Button 
                  onClick={() => { setShowComboBuilder(true); setCurrentCombo([]); setEditingComboIndex(null); }}
                  size="sm" 
                  className="bg-volt text-primary-foreground"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>

              {combos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No combos yet. Add combos for shadowboxing and bag work.
                </p>
              ) : (
                <div className="space-y-2">
                  {combos.map((combo, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-surface-1 rounded-lg p-3 border border-surface-3">
                      <span className="text-xs text-muted-foreground w-6">#{idx + 1}</span>
                      <div className="flex-1 flex flex-wrap gap-1">
                        {combo.map((move, mIdx) => (
                          <span 
                            key={mIdx} 
                            className="px-2 py-0.5 rounded text-xs font-medium bg-volt/20 text-volt"
                          >
                            {move}
                          </span>
                        ))}
                      </div>
                      <button onClick={() => editCombo(idx)} className="text-muted-foreground hover:text-foreground">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteCombo(idx)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Combo Builder Modal */}
        {showComboBuilder && (
          <div className="fixed inset-0 bg-background/95 z-50 flex flex-col">
            <header className="flex items-center justify-between px-4 py-4 border-b border-surface-3">
              <button onClick={() => setShowComboBuilder(false)} className="text-muted-foreground">
                <X className="w-6 h-6" />
              </button>
              <h2 className="font-bold text-foreground">
                {editingComboIndex !== null ? 'Edit Combo' : 'Add Combo'}
              </h2>
              {comboMode === 'custom' ? (
                <Button onClick={saveCombo} size="sm" className="bg-volt text-primary-foreground" disabled={currentCombo.length === 0}>
                  Save
                </Button>
              ) : (
                <div className="w-12" />
              )}
            </header>

            {/* Mode Toggle */}
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

            {comboMode === 'presets' ? (
              /* Presets List */
              <div className="flex-1 overflow-y-auto px-4 py-4">
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
        <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
          <DialogContent className="bg-background border-surface-3">
            <DialogHeader>
              <DialogTitle className="text-foreground">Share to Fight Club</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Share "{name}" with the community. Others will be able to save this workout to their library.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                value={shareMessage}
                onChange={(e) => setShareMessage(e.target.value)}
                placeholder="Add a note about this workout... (optional)"
                className="bg-surface-1 border-surface-3 text-foreground placeholder:text-muted-foreground resize-none"
                rows={3}
              />
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
                    name,
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
                    combos: combos.length > 0 ? combos : undefined,
                  };
                  
                  shareWorkout.mutate(
                    { workout, message: shareMessage || undefined },
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
                disabled={shareWorkout.isPending}
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
