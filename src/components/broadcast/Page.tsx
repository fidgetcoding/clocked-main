import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Plate } from './Plate';
import { ScoreBug } from './ScoreBug';
import type { PlateTone } from './plate-class';

interface BroadcastPageProps {
  /** What's on: the second plate in the bug. */
  show?: ReactNode;
  /** Colour of the show plate. Defaults to graphite. */
  showTone?: PlateTone;
  /** The right of the top row. Defaults to nothing. */
  air?: ReactNode;
  /** Back button, for screens off the main channels. */
  onBack?: () => void;
  backLabel?: string;
  className?: string;
  children: ReactNode;
}

/** The frame every non-training screen sits in: the bug on top, one column of graphics under it. */
export function BroadcastPage({ show, showTone, air, onBack, backLabel = 'Back', className, children }: BroadcastPageProps) {
  return (
    <div className={cn('page-frame', className)}>
      <div className="flex items-center justify-between gap-3 pt-[max(0.625rem,env(safe-area-inset-top))]">
        <ScoreBug mid={show} midTone={showTone} className="min-w-0" />
        <div className="flex shrink-0 items-center gap-3 pr-4">
          {air}
          {onBack && (
            <button type="button" onClick={onBack} className="plate plate-graphite fx h-11 px-4 text-xl">
              {backLabel}
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}


/** A chyron running off the left edge, labelling what's under it. */
export function SectionChyron({ children, tone = 'lime', className }: { children: ReactNode; tone?: 'lime' | 'graphite' | 'white' | 'red'; className?: string }) {
  return (
    <Plate tone={tone} bleed="left" className={cn('h-[1.875rem] w-fit justify-start pl-4 pr-6 text-2xl', className)}>
      {children}
    </Plate>
  );
}

/** Small print over a ruled line. */
export function SectionRule({ title, right, className }: { title: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 border-b border-surface-3 px-4 pb-1 pt-3', className)}>
      <span className="fx text-2xl">{title}</span>
      {right && <span className="lab">{right}</span>}
    </div>
  );
}

/** Label left, on-air number right. */
export function StatRow({ label, value, lime, className }: { label: ReactNode; value: ReactNode; lime?: boolean; className?: string }) {
  return (
    <div className={cn('row-rule', className)}>
      <span className="lab">{label}</span>
      <b className={cn('fx', lime && 'text-volt')}>{value}</b>
    </div>
  );
}

/** Nothing to show yet, said plainly, with a way forward. */
export function EmptyPlate({ title, body, children, className }: { title: ReactNode; body?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn('px-4 py-6', className)}>
      <p className="fx text-4xl">{title}</p>
      {body && <p className="prose-w mt-2 text-lg">{body}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
