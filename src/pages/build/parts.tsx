// The builder's small pieces: plates, steppers, the phase timeline and sortable rows. Moved out of Build.tsx unchanged.
import { Trash2, GripVertical, Pencil, ChevronDown, ChevronUp } from 'lucide-react';
import { Plate, plateClass, type PlateTone } from '@/components/broadcast';
import { toComboMove } from '@/components/broadcast/run/moves';
import { WorkoutSegment } from '@/types';
import { cn } from '@/lib/utils';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { stopDndEvent, MOVE_PLATE } from '@/pages/build/model';

// Sortable wrapper for phase cards in the builder
export function SortablePhaseWrapper({ id, children }: { id: string; children: (props: { dragHandleProps: React.HTMLAttributes<HTMLElement>; style: React.CSSProperties; setNodeRef: (node: HTMLElement | null) => void; isDragging: boolean }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return <>{children({ dragHandleProps: { ...attributes, ...listeners }, style, setNodeRef, isDragging })}</>;
}

export function MovePlates({ combo }: { combo: string[] }) {
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

export function Stepper({ noun, value, onChange, lime }: { noun: string; value: number; onChange: (next: number) => void; lime?: boolean }) {
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

export function PhaseTimeline({ segments, tone }: { segments: WorkoutSegment[]; tone: (segment: WorkoutSegment) => PlateTone }) {
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

// Sortable combo item component
export function SortableComboItem({ id, combo, index, onEdit, onDelete }: { 
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
