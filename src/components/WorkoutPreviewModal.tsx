import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FitText, SectionChyron } from '@/components/broadcast';
import { TrendingWorkout } from '@/data/trendingWorkouts';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { promptEmailLink } from '@/lib/guest';
import { formatRating } from '@/lib/ratings';
import { useAuth } from '@/contexts/useAuth';
import { useWorkoutRating } from '@/hooks/useWorkoutRating';

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
  const { user: authUser } = useAuth();
  const [showRating, setShowRating] = useState(false);
  const [hoverStar, setHoverStar] = useState(0);
  const { summary, myRating: selectedRating, rate } = useWorkoutRating(workout.id);
  const ratingLabel = formatRating(summary, !!authUser);

  const totalPhases = workout.sections.warmup.length + workout.sections.grind.length + workout.sections.cooldown.length;
  const totalRounds = workout.sections.grind.reduce((acc, phase) => acc + phase.repeats, 0);

  const submitRating = (stars: number) => {
    if (!authUser) {
      promptEmailLink('rate workouts');
      return;
    }
    rate.mutate(stars, {
      onSuccess: () => toast.success(`Rated ${stars} star${stars > 1 ? 's' : ''}!`),
      onError: () => toast.error('Failed to save rating'),
      onSettled: () => setShowRating(false),
    });
  };

  const structure = [
    { key: 'warmup', title: 'Warmup', phases: workout.sections.warmup },
    { key: 'grind', title: 'Main Workout', phases: workout.sections.grind },
    { key: 'cooldown', title: 'Cooldown', phases: workout.sections.cooldown },
  ];
  const combos = workout.combos ?? [];

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/85"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div role="dialog" aria-modal="true" aria-labelledby="preview-title" className="dialog-panel z-50 overflow-x-clip !p-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 pt-3">
          <SectionChyron className="shrink-0">Fight preview</SectionChyron>
          <button 
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="plate plate-graphite mr-4 h-11 w-12 shrink-0"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="px-4 pt-2">
          <h2 id="preview-title" className="fx"><FitText className="h-14" max={72}>{workout.name}</FitText></h2>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4">
            <span className="lab">{workout.authorHandle}</span>
            {ratingLabel && <b className="fx text-2xl text-volt">{ratingLabel}</b>}
          </div>
        </div>

        {/* Stats Row */}
        <div className="mt-2 grid grid-cols-3 border-y border-surface-3 text-center">
          {[
            { value: formatDuration(workout.totalDuration), label: 'Duration' },
            { value: totalRounds, label: 'Rounds' },
            { value: workout.difficulty, label: 'Difficulty' },
          ].map((stat) => (
            <div key={stat.label} className="px-1 py-2">
              <p className="fx"><FitText className="h-9" max={36} align="center">{stat.value}</FitText></p>
              <p className="lab mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tags */}
        <p className="lab px-4 pt-2">{workout.tags.join(', ')}</p>

        {/* Structure Preview */}
        <div className="pt-2">
          <h3 className="sr-only">Structure</h3>
          {structure.filter((section) => section.phases.length > 0).map((section) => (
            <div key={section.key}>
              <p className="lab lab-lime px-4 pb-0.5 pt-2">{section.title}</p>
              {section.phases.map((phase) => (
                <div key={phase.id} className="grid grid-cols-[1fr_auto] items-baseline gap-3 border-b border-surface-2 px-4 py-1">
                  <span className="fx min-w-0 text-2xl">{phase.name}</span>
                  <span className="lab whitespace-nowrap">
                    {phase.repeats > 1 && `× ${phase.repeats}, `}{phase.segments.length} {phase.segments.length === 1 ? 'segment' : 'segments'}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Combos Preview */}
        {combos.length > 0 && (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-surface-3 px-4 py-2">
            <h3 className="lab mr-auto not-italic">Combos</h3>
            {combos.slice(0, 3).map((combo, idx) => (
              <span key={idx} className="fx text-2xl">{combo.join('-')}</span>
            ))}
            {combos.length > 3 && (
              <span className="lab">+{combos.length - 3} more</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3 px-5 pb-4 pt-3">
          {/* Rating, 1 to 5 */}
          {showRating ? (
            <div className="flex flex-col items-center gap-2 py-1">
              <p className="lab lab-w">Rate this workout</p>
              <div className="flex gap-3.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    aria-label={`Rate ${star} out of 5`}
                    onMouseEnter={() => setHoverStar(star)}
                    onMouseLeave={() => setHoverStar(0)}
                    onClick={() => submitRating(star)}
                    disabled={rate.isPending}
                    className={cn('plate fx h-11 w-11 text-2xl', (hoverStar || selectedRating) >= star ? 'plate-lime' : 'plate-graphite')}
                  >
                    {star}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <Button
              onClick={() => setShowRating(true)}
              variant="secondary"
              size="sm"
              className="w-full"
            >
              {selectedRating > 0 ? `You rated ${selectedRating}/5` : 'Rate this Workout'}
            </Button>
          )}

          <Button 
            onClick={() => onSave(workout)}
            className="w-full"
          >
            Save to My Workouts
          </Button>
          <Button 
            onClick={() => onCustomize(workout)}
            variant="steel"
            size="sm"
            className="w-full"
          >
            Customize in the Builder
          </Button>
        </div>
      </div>
    </div>
  );
};
