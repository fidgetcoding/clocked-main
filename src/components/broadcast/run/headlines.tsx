import { cn } from '@/lib/utils';
import { Plate } from '../Plate';
import { PhaseChip } from './parts';
import type { RunView } from './types';

/** The little chyron above the clock: what you're in. */
export function StageHeadline({ view, className, bleed = true }: { view: RunView; className?: string; bleed?: boolean }) {
  if (view.kind === 'prep') return <PhaseChip bleed={bleed} className={className}>Get ready</PhaseChip>;
  if (view.championship) {
    return (
      <Plate tone="gold" bleed={bleed ? 'left' : undefined} className={cn('h-[1.875rem] w-fit max-w-full justify-start pl-1 pr-4 text-[1.3125rem]', !bleed && 'pl-4', className)}>
        <span className="truncate">{view.phaseName}, 2XP</span>
      </Plate>
    );
  }
  return (
    <PhaseChip bleed={bleed} className={className}>
      {view.phaseName}
    </PhaseChip>
  );
}

/** The bell: end of the round, what it earned. */
export function BellPlate({ view, xp, className }: { view: RunView; xp: number; className?: string }) {
  if (!view.round) return null;
  return (
    <div className={cn('plate-slap', className)} data-testid="round-bell">
      <Plate tone="lime" bleed="left" className="h-9 w-fit justify-start pl-1 pr-5 text-[1.625rem]">
        End of round {view.round}
        {xp > 0 && <span className="ml-3">+{xp.toLocaleString()} XP</span>}
      </Plate>
    </div>
  );
}
