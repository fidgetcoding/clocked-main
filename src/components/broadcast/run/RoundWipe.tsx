import { useEffect, useRef, useState } from 'react';
import { FitText } from '../FitText';
import { Logo } from '../Logo';
import type { RunView } from './types';

const WIPE_MS = 1300;

/** The round start: a full-screen lime wipe, then straight back to the action. Never blocks a tap. */
export function RoundWipe({ view }: { view: RunView }) {
  const [shown, setShown] = useState<{ round: number; id: number } | null>(null);
  const lastRound = useRef<number | null>(view.round);

  useEffect(() => {
    const changed = view.round !== lastRound.current;
    lastRound.current = view.round;
    if (!changed || !view.round || view.paused || view.idle) return;
    setShown({ round: view.round, id: Date.now() });
    const timer = setTimeout(() => setShown(null), WIPE_MS);
    return () => clearTimeout(timer);
    // The moment belongs to the round changing, nothing else
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.round]);

  if (!shown) return null;
  return (
    <div key={shown.id} className="round-wipe" aria-hidden="true" data-testid="round-wipe">
      <Logo className="absolute left-4 top-4 h-4 w-32" />
      <span className="fx absolute left-4 top-[14cqh] text-5xl">{view.phaseName}</span>
      <div className="absolute inset-x-4 top-[22cqh] h-[62cqh]">
        <FitText className="h-full" align="center">
          {`Round ${shown.round}`}
        </FitText>
      </div>
    </div>
  );
}
