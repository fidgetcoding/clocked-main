import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface OnAirProps {
  /** live blinks, on holds steady, off goes dark, grind is the lime work light. */
  state?: 'live' | 'on' | 'off' | 'grind';
  className?: string;
  children?: ReactNode;
}

/** The little red light. Red only ever means live or here's what to fix. */
export function OnAir({ state = 'live', className, children }: OnAirProps) {
  return (
    <span className={cn('on-air', state === 'live' && 'on-air-live', state === 'off' && 'on-air-off', state === 'grind' && 'on-air-grind', className)}>
      {children}
    </span>
  );
}
