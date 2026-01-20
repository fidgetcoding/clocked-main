import { Clock, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Workout } from '@/types';

interface WorkoutCardProps {
  workout: Workout;
  onClick: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

function getDifficultyColor(difficulty: Workout['difficulty']): string {
  switch (difficulty) {
    case 'beginner':
      return 'text-rest-green';
    case 'intermediate':
      return 'text-yellow-500';
    case 'advanced':
      return 'text-alert-red';
    default:
      return 'text-muted-foreground';
  }
}

export function WorkoutCard({ workout, onClick }: WorkoutCardProps) {
  const phaseCount = 
    workout.sections.warmup.length + 
    workout.sections.grind.length + 
    workout.sections.cooldown.length;

  return (
    <button
      onClick={onClick}
      className="card-workout w-full text-left group"
    >
      <div className="flex items-start gap-3 pr-8">
        {/* Icon */}
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center text-2xl">
          {workout.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground truncate">
              {workout.name}
            </h3>
            {workout.isPreset && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-volt/20 text-volt font-medium">
                PRESET
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDuration(workout.totalDuration)}
            </span>
            <span>{phaseCount} phases</span>
            <span className={cn('capitalize', getDifficultyColor(workout.difficulty))}>
              {workout.difficulty}
            </span>
          </div>

          {workout.timesCompleted > 0 && (
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <Flame className="w-3 h-3 text-volt" />
              <span>Completed {workout.timesCompleted}x</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
