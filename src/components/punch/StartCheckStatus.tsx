import { useEffect, useState } from 'react';
import type { StartCheckHud } from '@/hooks/usePunchTracking';
import { useStance } from '@/hooks/useStance';
import { describeCamera, placementAdvice } from '@/lib/punch/startCheck';
import { cn } from '@/lib/utils';

// Long enough to read from where you're standing, then the feed is yours again
const RESULT_MS = 9000;

interface StartCheckStatusProps {
  check: StartCheckHud;
  onSkip: () => void;
  onRerun: () => void;
  className?: string;
}

/** The quick check at the start of a session: a countdown while it runs, then what it saw for a few seconds. */
export function StartCheckStatus({ check, onSkip, onRerun, className }: StartCheckStatusProps) {
  const { stance, setStance } = useStance();
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    setExpired(false);
    if (!check.result) return;
    const timer = setTimeout(() => setExpired(true), RESULT_MS);
    return () => clearTimeout(timer);
  }, [check.result]);

  if (check.running) {
    return (
      <div role="status" data-testid="start-check" className={cn('flex items-center gap-4 bg-background/85 py-2 pl-4 pr-3', className)}>
        <span className="fx text-3xl leading-none">Hands up, checking your setup</span>
        <span className="fx text-5xl leading-none text-volt">{check.secondsLeft}</span>
        <button type="button" onClick={onSkip} className="plate plate-graphite fx h-11 shrink-0 px-4 text-xl">
          Skip
        </button>
      </div>
    );
  }
  if (!check.result || expired) return null;
  const advice = placementAdvice(check.result);
  const switchTo = check.result.stance && check.result.stance !== stance ? check.result.stance : null;
  return (
    <div data-testid="start-check-result" className={cn('bg-background/85 py-2 pl-4 pr-3', className)}>
      <p className="prose-w text-lg leading-snug">{describeCamera(check.result)}</p>
      {advice && <p className="text-base leading-snug text-muted-foreground">{advice}</p>}
      <div className="mt-2 flex flex-wrap gap-3">
        {switchTo && (
          <button type="button" onClick={() => setStance(switchTo)} className="plate plate-lime fx h-11 px-4 text-xl">
            You look {switchTo}. Switch?
          </button>
        )}
        <button type="button" onClick={onRerun} className="plate plate-graphite fx h-11 px-4 text-xl">
          Check again
        </button>
      </div>
    </div>
  );
}
