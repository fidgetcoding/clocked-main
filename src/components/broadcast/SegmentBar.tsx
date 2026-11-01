import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

interface SegmentBarProps {
  total: number;
  /** How many are filled. */
  filled: number;
  /** The one happening now, drawn in white. */
  current?: number;
  height?: string;
  gold?: boolean;
  className?: string;
  label?: string;
}

const MAX_DRAWN = 40;

/** Progress as slanted segments. Long workouts are scaled so the marks stay readable. */
export function SegmentBar({ total, filled, current = -1, height, gold, className, label }: SegmentBarProps) {
  const drawn = Math.max(1, Math.min(total, MAX_DRAWN));
  const scale = total > 0 ? drawn / total : 0;
  const on = Math.round(filled * scale);
  const now = current >= 0 ? Math.min(drawn - 1, Math.floor(current * scale)) : -1;
  return (
    <div
      className={cn('seg-bar', gold && 'seg-bar-gold', className)}
      style={height ? ({ '--seg-height': height } as CSSProperties) : undefined}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      {Array.from({ length: drawn }, (_, index) => (
        <i key={index} className={index === now ? 'seg-now' : index < on ? 'seg-on' : undefined} />
      ))}
    </div>
  );
}
