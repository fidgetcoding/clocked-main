import type { StartCheckHud } from '@/hooks/usePunchTracking';
import { describeCamera, placementAdvice } from '@/lib/punch/startCheck';
import { cn } from '@/lib/utils';

interface StartCheckStatusProps {
  check: StartCheckHud;
  onSkip: () => void;
  onRerun: () => void;
  className?: string;
}

/** The quick check at the start of a session: a countdown while it runs, then what it saw. */
export function StartCheckStatus({ check, onSkip, onRerun, className }: StartCheckStatusProps) {
  if (check.running) {
    return (
      <div role="status" data-testid="start-check" className={cn('px-2 py-1 rounded-lg text-[11px] bg-surface-1 border border-surface-3 text-foreground', className)}>
        Checking your setup, hands up. {check.secondsLeft}
        <button onClick={onSkip} className="block font-bold text-volt">
          Skip
        </button>
      </div>
    );
  }
  const advice = check.result && placementAdvice(check.result);
  return (
    <div data-testid="start-check-result" className={cn('px-2 py-1 rounded-lg text-[11px] bg-surface-1 border border-surface-3 text-foreground', className)}>
      {check.result && <p>{describeCamera(check.result)}</p>}
      {advice && <p className="text-muted-foreground">{advice}</p>}
      <button onClick={onRerun} className="font-bold text-volt">
        Check again
      </button>
    </div>
  );
}
