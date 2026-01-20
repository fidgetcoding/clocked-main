import { useState } from 'react';
import { X, Clock, Play, Save, Edit3, Plus, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Workout, WorkoutPhase } from '@/types';
import { cn } from '@/lib/utils';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface GeneratedWorkoutPreviewProps {
  workout: Workout;
  onClose: () => void;
  onWorkoutUpdate?: (workout: Workout) => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

export const GeneratedWorkoutPreview = ({ workout: initialWorkout, onClose, onWorkoutUpdate }: GeneratedWorkoutPreviewProps) => {
  const navigate = useNavigate();
  const addWorkout = useWorkoutStore((state) => state.addWorkout);
  const updateWorkout = useWorkoutStore((state) => state.updateWorkout);
  const workouts = useWorkoutStore((state) => state.workouts);
  
  const [workout, setWorkout] = useState<Workout>(initialWorkout);
  const [isEditing, setIsEditing] = useState(false);
  const [expandedSection, setExpandedSection] = useState<'warmup' | 'grind' | 'cooldown' | null>('grind');
  
  const totalRounds = workout.sections.grind.reduce((acc, phase) => acc + phase.repeats, 0);
  const isAlreadySaved = workouts.some(w => w.id === workout.id);

  const recalculateDuration = (sections: typeof workout.sections) => {
    let total = 0;
    ['warmup', 'grind', 'cooldown'].forEach((section) => {
      const phases = sections[section as keyof typeof sections];
      phases.forEach((phase: WorkoutPhase) => {
        const phaseDur = phase.segments.reduce((acc, s) => acc + s.duration, 0);
        total += phaseDur * phase.repeats;
      });
    });
    return total;
  };

  const handleNameChange = (name: string) => {
    const updated = { ...workout, name };
    setWorkout(updated);
    onWorkoutUpdate?.(updated);
  };

  const handleRoundsChange = (delta: number) => {
    const newSections = { ...workout.sections };
    newSections.grind = newSections.grind.map(phase => ({
      ...phase,
      repeats: Math.max(1, phase.repeats + delta)
    }));
    const updated = { 
      ...workout, 
      sections: newSections,
      totalDuration: recalculateDuration(newSections)
    };
    setWorkout(updated);
    onWorkoutUpdate?.(updated);
  };

  const handleDifficultyChange = (difficulty: 'beginner' | 'intermediate' | 'advanced') => {
    const updated = { ...workout, difficulty };
    setWorkout(updated);
    onWorkoutUpdate?.(updated);
  };

  const handleSaveOnly = () => {
    if (!isAlreadySaved) {
      addWorkout(workout);
    } else {
      updateWorkout(workout.id, workout);
    }
    toast.success(`"${workout.name}" saved to My Workouts`);
    onClose();
    navigate('/');
  };

  const handleLaunchAndSave = () => {
    if (!isAlreadySaved) {
      addWorkout(workout);
    } else {
      updateWorkout(workout.id, workout);
    }
    toast.success(`Starting "${workout.name}"`);
    onClose();
    navigate(`/workout/${workout.id}/session`);
  };

  const renderSection = (sectionKey: 'warmup' | 'grind' | 'cooldown', label: string) => {
    const phases = workout.sections[sectionKey];
    if (phases.length === 0) return null;
    
    const isExpanded = expandedSection === sectionKey;
    
    return (
      <div className="bg-surface-2 rounded-lg overflow-hidden">
        <button
          onClick={() => setExpandedSection(isExpanded ? null : sectionKey)}
          className="w-full flex items-center justify-between p-3"
        >
          <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        {isExpanded && (
          <div className="px-3 pb-3 space-y-2">
            {phases.map((phase) => (
              <div key={phase.id} className="text-sm">
                <p className="text-foreground font-medium">
                  {phase.name} {phase.repeats > 1 && `× ${phase.repeats}`}
                </p>
                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                  {phase.segments.map((seg) => (
                    <p key={seg.id}>
                      • {seg.name}: {Math.floor(seg.duration / 60)}:{(seg.duration % 60).toString().padStart(2, '0')}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg bg-surface-1 rounded-t-3xl sm:rounded-3xl border border-surface-3 max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom duration-300 flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-4 p-6 border-b border-surface-3 flex-shrink-0">
          <div className="w-14 h-14 rounded-2xl bg-volt/20 flex items-center justify-center text-3xl flex-shrink-0">
            {workout.icon}
          </div>
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <Input
                value={workout.name}
                onChange={(e) => handleNameChange(e.target.value)}
                onBlur={() => setIsEditing(false)}
                autoFocus
                className="text-xl font-black uppercase bg-transparent border-volt h-auto py-1"
              />
            ) : (
              <button 
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 group"
              >
                <h2 className="text-xl font-black text-foreground uppercase">{workout.name}</h2>
                <Edit3 className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
            <p className="text-sm text-volt font-medium mt-1">AI Generated Workout</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Editable Stats Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface-2 rounded-xl p-3 text-center">
              <Clock className="w-5 h-5 text-volt mx-auto mb-1" />
              <p className="text-sm font-semibold text-foreground">{formatDuration(workout.totalDuration)}</p>
              <p className="text-xs text-muted-foreground">Duration</p>
            </div>
            
            <div className="bg-surface-2 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <button
                  onClick={() => handleRoundsChange(-1)}
                  className="w-5 h-5 rounded bg-surface-3 flex items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-lg font-bold text-volt w-8">{totalRounds}</span>
                <button
                  onClick={() => handleRoundsChange(1)}
                  className="w-5 h-5 rounded bg-surface-3 flex items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Rounds</p>
            </div>
            
            <div className="bg-surface-2 rounded-xl p-3 text-center">
              <select
                value={workout.difficulty}
                onChange={(e) => handleDifficultyChange(e.target.value as any)}
                className="bg-transparent border-none text-sm font-semibold text-center w-full cursor-pointer focus:outline-none"
                style={{
                  color: workout.difficulty === 'beginner' ? 'hsl(var(--electric-volt))' :
                         workout.difficulty === 'intermediate' ? '#eab308' : '#ef4444'
                }}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
              <p className="text-xs text-muted-foreground">Difficulty</p>
            </div>
          </div>

          {/* Structure Preview */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Structure</h3>
            {renderSection('warmup', 'Warmup')}
            {renderSection('grind', 'Main Workout')}
            {renderSection('cooldown', 'Cooldown')}
          </div>

          {/* Combos Preview */}
          {workout.combos && workout.combos.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Combos</h3>
              <div className="flex flex-wrap gap-2">
                {workout.combos.slice(0, 5).map((combo, idx) => (
                  <span key={idx} className="px-2 py-1 rounded bg-volt/10 text-volt text-xs font-medium">
                    {combo.join(' → ')}
                  </span>
                ))}
                {workout.combos.length > 5 && (
                  <span className="px-2 py-1 rounded bg-surface-2 text-muted-foreground text-xs">
                    +{workout.combos.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-surface-3 space-y-3 safe-bottom flex-shrink-0">
          <Button 
            onClick={handleLaunchAndSave}
            className="w-full bg-volt text-primary-foreground hover:bg-volt/90 h-12 text-base font-semibold"
          >
            <Play className="w-5 h-5 mr-2" />
            Start Workout
          </Button>
          <Button 
            onClick={handleSaveOnly}
            variant="outline"
            className="w-full border-surface-3 text-foreground hover:bg-surface-2 h-12 text-base"
          >
            <Save className="w-5 h-5 mr-2" />
            Save for Later
          </Button>
        </div>
      </div>
    </div>
  );
};
