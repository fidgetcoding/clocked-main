import { cn } from '@/lib/utils';
import { RANK_THRESHOLDS, RANK_NAMES, Rank } from '@/types';

interface XPBarProps {
  currentXP: number;
  className?: string;
  showRank?: boolean;
}

function getCurrentRank(xp: number): Rank {
  const ranks = Object.entries(RANK_THRESHOLDS).reverse() as [Rank, number][];
  for (const [rank, threshold] of ranks) {
    if (xp >= threshold) return rank;
  }
  return 'regional';
}

function getNextRank(currentRank: Rank): Rank | null {
  const ranks = Object.keys(RANK_THRESHOLDS) as Rank[];
  const currentIndex = ranks.indexOf(currentRank);
  if (currentIndex < ranks.length - 1) {
    return ranks[currentIndex + 1];
  }
  return null;
}

function getProgressToNextRank(xp: number): { progress: number; current: number; next: number } {
  const currentRank = getCurrentRank(xp);
  const nextRank = getNextRank(currentRank);
  
  if (!nextRank) {
    return { progress: 100, current: xp, next: xp };
  }

  const currentThreshold = RANK_THRESHOLDS[currentRank];
  const nextThreshold = RANK_THRESHOLDS[nextRank];
  const progress = ((xp - currentThreshold) / (nextThreshold - currentThreshold)) * 100;

  return {
    progress: Math.min(100, Math.max(0, progress)),
    current: xp - currentThreshold,
    next: nextThreshold - currentThreshold,
  };
}

export function XPBar({ currentXP, className, showRank = true }: XPBarProps) {
  const rank = getCurrentRank(currentXP);
  const { progress, current, next } = getProgressToNextRank(currentXP);

  return (
    <div className={cn('w-full', className)}>
      {showRank && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-volt uppercase tracking-wide">
            {RANK_NAMES[rank]}
          </span>
          <span className="text-xs text-muted-foreground">
            {current.toLocaleString()} / {next.toLocaleString()} XP
          </span>
        </div>
      )}
      <div className="xp-bar">
        <div 
          className="xp-bar-fill transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
