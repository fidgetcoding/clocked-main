import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Play, Pencil, Trash2, Clock, RotateCcw, GripVertical } from 'lucide-react';
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
  return `${mins} MIN`;
}

function getWorkoutStats(workout: DbWorkout) {
  const raw = workout.phases;
  const phases: any[] = Array.isArray(raw) ? raw : [];
  const warmupPhases = phases.filter((p: any) => p.section === 'warmup');
  const grindPhases = phases.filter((p: any) => p.section === 'grind');
  const cooldownPhases = phases.filter((p: any) => p.section === 'cooldown');
  const totalPhases = warmupPhases.length + grindPhases.length + cooldownPhases.length;
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
        'card-workout group',
        isDragging && 'opacity-50 shadow-2xl z-50',
        isReorderMode && 'cursor-grab active:cursor-grabbing'
      )}
    >
      <div className="flex items-start gap-4">
        {/* Drag Handle - only show in reorder mode */}
        {isReorderMode && (
          <div
            {...attributes}
            {...listeners}
            className="flex-shrink-0 p-2 -ml-2 cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="w-5 h-5 text-muted-foreground" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1">
          <h3 className="text-xl font-black text-foreground uppercase mb-1 transition-colors group-hover:text-volt">
            {workout.name}
          </h3>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {formatDuration(workout.duration)}
            </span>
            <span className="flex items-center gap-1">
              <RotateCcw className="w-4 h-4" />
              {totalPhases} PHASES
            </span>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            <span className="tag">{(workout.difficulty || 'beginner').toUpperCase()}</span>
            <span className="tag">BOXING</span>
          </div>
        </div>

        {/* Play button and actions column - hide in reorder mode */}
        {!isReorderMode && (
          <div className="flex flex-col items-center gap-3 flex-shrink-0">
            {/* Play Button */}
            <button
              onClick={() => navigate(`/workout/${workout.id}`)}
              className="w-12 h-12 rounded-full bg-volt flex items-center justify-center transition-transform duration-200 group-hover:scale-125 active:scale-95"
            >
              <Play className="w-5 h-5 text-primary-foreground ml-0.5" fill="currentColor" />
            </button>

            {/* Edit and Delete */}
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/build?edit=${workout.id}`); }}
                onPointerDown={(e) => e.stopPropagation()}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(workout.id); }}
                onPointerDown={(e) => e.stopPropagation()}
                className="text-muted-foreground hover:text-destructive transition-colors p-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
