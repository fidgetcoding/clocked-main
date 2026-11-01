import { cn } from '@/lib/utils';
import {
  Prestige,
  Ranking,
  PRESTIGE_NAMES,
  RANKING_NAMES,
  getLevelProgress,
  getXPProgressString,
} from '@/lib/xpSystem';
import { SegmentBar } from '@/components/broadcast';

interface PrestigeDisplayProps {
  prestige: Prestige;
  ranking: Ranking;
  level: number;
  totalXP: number;
  showProgress?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: { plate: 'h-7 px-3 text-lg', line: 'text-xl' },
  md: { plate: 'h-8 px-4 text-xl', line: 'text-2xl' },
  lg: { plate: 'h-10 px-5 text-2xl', line: 'text-3xl' },
};

const SEGMENTS = 24;

export function PrestigeDisplay({
  prestige,
  ranking,
  level,
  totalXP,
  showProgress = true,
  size = 'md',
  className,
}: PrestigeDisplayProps) {
  const progress = getLevelProgress(prestige, level, totalXP);
  const xpString = getXPProgressString(prestige, level, totalXP);
  const sizes = SIZES[size];

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={cn('plate plate-white fx', sizes.plate)}>{PRESTIGE_NAMES[prestige]}</span>
        <span className={cn('fx whitespace-nowrap', sizes.line)}>{RANKING_NAMES[ranking]}</span>
        <span className={cn('fx whitespace-nowrap text-volt', sizes.line)}>Level {level}</span>
      </div>

      {showProgress && (
        <div className="space-y-1">
          <SegmentBar
            total={SEGMENTS}
            filled={Math.round((progress / 100) * SEGMENTS)}
            height="0.75rem"
            label={`${Math.round(progress)}% of the way to the next level`}
          />
          <p className="lab">{xpString}</p>
        </div>
      )}
    </div>
  );
}

// Compact version for cards/lists
interface PrestigeBadgeProps {
  prestige: Prestige;
  ranking: Ranking;
  level: number;
  className?: string;
}

export function PrestigeBadge({ prestige, ranking, level, className }: PrestigeBadgeProps) {
  return (
    <span className={cn('plate plate-graphite fx h-8 gap-2 px-4 text-xl', className)}>
      <span className="text-volt">{PRESTIGE_NAMES[prestige]}</span>
      <span>{RANKING_NAMES[ranking]}</span>
      <span className="text-volt">Lvl {level}</span>
    </span>
  );
}
