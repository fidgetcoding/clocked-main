import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Logo } from './Logo';
import { Plate } from './Plate';
import type { PlateTone } from './plate-class';

interface ScoreBugProps {
  /** Second plate: the round, or the show you're watching. */
  mid?: ReactNode;
  tone?: PlateTone;
  midTone?: PlateTone;
  className?: string;
}

/** Top-left on every screen: the logo plate running off the edge, then what's on. */
export function ScoreBug({ mid, tone = 'lime', midTone = 'graphite', className }: ScoreBugProps) {
  return (
    <div className={cn('score-bug', className)}>
      <Plate tone={tone} bleed="left" className="score-bug-logo">
        <Logo />
      </Plate>
      {mid != null && mid !== '' && <Plate tone={midTone}>{mid}</Plate>}
    </div>
  );
}
