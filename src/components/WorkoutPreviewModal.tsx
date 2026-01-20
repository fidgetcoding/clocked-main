import { X, Clock, Star, Download, Play, Sparkles, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TrendingWorkout } from '@/data/trendingWorkouts';
import { cn } from '@/lib/utils';

interface WorkoutPreviewModalProps {
  workout: TrendingWorkout;
  onClose: () => void;
  onSave: (workout: TrendingWorkout) => void;
  onCustomize: (workout: TrendingWorkout) => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  return `${mins} min`;
}

export const WorkoutPreviewModal = ({ workout, onClose, onSave, onCustomize }: WorkoutPreviewModalProps) => {
  const totalPhases = workout.sections.warmup.length + workout.sections.grind.length + workout.sections.cooldown.length;
  const totalRounds = workout.sections.grind.reduce((acc, phase) => acc + phase.repeats, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg bg-surface-1 rounded-t-3xl sm:rounded-3xl border border-surface-3 max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="flex items-start gap-4 p-6 border-b border-surface-3">
          <div className="w-14 h-14 rounded-2xl bg-volt/20 flex items-center justify-center text-3xl flex-shrink-0">
            {workout.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black text-foreground uppercase">{workout.name}</h2>
            <p className="text-sm text-muted-foreground">{workout.authorHandle}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                {workout.rating} ({workout.ratingCount})
              </span>
              <span className="flex items-center gap-1">
                <Download className="w-3 h-3" />
                {workout.downloads >= 1000 ? `${(workout.downloads / 1000).toFixed(1)}K` : workout.downloads}
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[50vh] overflow-y-auto">
          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface-2 rounded-xl p-3 text-center">
              <Clock className="w-5 h-5 text-volt mx-auto mb-1" />
              <p className="text-sm font-semibold text-foreground">{formatDuration(workout.totalDuration)}</p>
              <p className="text-xs text-muted-foreground">Duration</p>
            </div>
            <div className="bg-surface-2 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-volt">{totalRounds}</p>
              <p className="text-xs text-muted-foreground">Rounds</p>
            </div>
            <div className="bg-surface-2 rounded-xl p-3 text-center">
              <span className={cn(
                'text-sm font-semibold',
                workout.difficulty === 'beginner' ? 'text-volt' :
                workout.difficulty === 'intermediate' ? 'text-yellow-500' :
                'text-alert-red'
              )}>
                {workout.difficulty.charAt(0).toUpperCase() + workout.difficulty.slice(1)}
              </span>
              <p className="text-xs text-muted-foreground">Difficulty</p>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {workout.tags.map((tag) => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>

          {/* Structure Preview */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Structure</h3>
            
            {workout.sections.warmup.length > 0 && (
              <div className="bg-surface-2 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase mb-1">Warmup</p>
                {workout.sections.warmup.map((phase) => (
                  <p key={phase.id} className="text-sm text-foreground">
                    {phase.name} ({phase.segments.length} segments)
                  </p>
                ))}
              </div>
            )}

            {workout.sections.grind.length > 0 && (
              <div className="bg-surface-2 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase mb-1">Main Workout</p>
                {workout.sections.grind.map((phase) => (
                  <p key={phase.id} className="text-sm text-foreground">
                    {phase.name} × {phase.repeats} ({phase.segments.length} segments each)
                  </p>
                ))}
              </div>
            )}

            {workout.sections.cooldown.length > 0 && (
              <div className="bg-surface-2 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase mb-1">Cooldown</p>
                {workout.sections.cooldown.map((phase) => (
                  <p key={phase.id} className="text-sm text-foreground">
                    {phase.name} ({phase.segments.length} segments)
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Combos Preview */}
          {workout.combos && workout.combos.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Combos</h3>
              <div className="flex flex-wrap gap-2">
                {workout.combos.slice(0, 3).map((combo, idx) => (
                  <span key={idx} className="px-2 py-1 rounded bg-volt/10 text-volt text-xs font-medium">
                    {combo.join(' → ')}
                  </span>
                ))}
                {workout.combos.length > 3 && (
                  <span className="px-2 py-1 rounded bg-surface-2 text-muted-foreground text-xs">
                    +{workout.combos.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-surface-3 space-y-3 safe-bottom">
          <Button 
            onClick={() => onSave(workout)}
            className="w-full bg-volt text-primary-foreground hover:bg-volt/90 h-12 text-base font-semibold"
          >
            <Save className="w-5 h-5 mr-2" />
            Save to My Workouts
          </Button>
          <Button 
            onClick={() => onCustomize(workout)}
            variant="outline"
            className="w-full border-surface-3 text-foreground hover:bg-surface-2 h-12 text-base"
          >
            <Sparkles className="w-5 h-5 mr-2 text-volt" />
            Customize with AI Builder
          </Button>
        </div>
      </div>
    </div>
  );
};
