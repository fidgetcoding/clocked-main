import { cn } from '@/lib/utils';
import { SegmentBar } from './SegmentBar';

interface LevelBarProps {
  level: number;
  /** 0 to 100. */
  percent: number;
  gold?: boolean;
  className?: string;
}

const SEGMENTS = 24;

/** Lvl 24, the bar, Lvl 25. At the top level there's nothing after it. */
export function LevelBar({ level, percent, gold, className }: LevelBarProps) {
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * SEGMENTS);
  return (
    <div className={cn('level-bar fx', className)}>
      <span className="whitespace-nowrap">Lvl {level}</span>
      <SegmentBar total={SEGMENTS} filled={filled} height="0.8125rem" gold={gold} label={`${Math.round(percent)}% of the way to the next level`} />
      <span className="whitespace-nowrap text-muted-foreground">{level >= 100 ? 'Max' : `Lvl ${level + 1}`}</span>
    </div>
  );
}
