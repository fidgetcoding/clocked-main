import { splitStoredPhases } from '@/lib/storedPhases';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Pencil, Trash2, GripVertical } from 'lucide-react';
import { PlayIcon } from '@/components/broadcast/icons';
import { useNavigate } from 'react-router-dom';
import { DbWorkout } from '@/hooks/useWorkouts';
import { cn } from '@/lib/utils';

interface SortableWorkoutCardProps {
  workout: DbWorkout;
  onDelete: (id: string) => void;
  isReorderMode: boolean;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  return mins === 0 && seconds > 0 ? '<1 MIN' : `${mins} MIN`;
}

function getWorkoutStats(workout: DbWorkout) {
  const { warmup, grind, cooldown } = splitStoredPhases(Array.isArray(workout.phases) ? workout.phases : []).sections;
  const totalPhases = warmup.length + grind.length + cooldown.length;
  return { totalPhases };
}

export function SortableWorkoutCard({ workout, onDelete, isReorderMode }: SortableWorkoutCardProps) {
  const navigate = useNavigate();
  const { totalPhases } = getWorkoutStats(workout);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: workout.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'border-b border-surface-2 px-4 py-2.5',
        isDragging && 'relative z-50 bg-surface-2',
        isReorderMode && 'cursor-grab active:cursor-grabbing'
      )}
    >
      <div className="flex items-center gap-3">
        {/* Drag Handle - only show in reorder mode */}
        {isReorderMode && (
          <div
            {...attributes}
            {...listeners}
            aria-label={`Move ${workout.name}`}
            className="flex h-11 w-8 flex-shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
          >
            <GripVertical className="w-5 h-5 text-muted-foreground" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="fx truncate text-3xl">{workout.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span className="lab">{formatDuration(workout.duration)}</span>
            <span className="lab">{totalPhases} {totalPhases === 1 ? 'PHASE' : 'PHASES'}</span>
            <span className="lab">{(workout.difficulty || 'beginner').toUpperCase()}</span>
            <span className="lab">BOXING</span>
          </div>
        </div>

        {!isReorderMode && (
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/build?edit=${workout.id}`); }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={`Edit ${workout.name}`}
              className="flex h-11 w-9 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(workout.id); }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={`Remove ${workout.name}`}
              className="flex h-11 w-9 items-center justify-center text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate(`/workout/${workout.id}`)}
              aria-label={`Start ${workout.name}`}
              className="plate plate-lime h-11 w-14"
            >
              <PlayIcon className="size-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
