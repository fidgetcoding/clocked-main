import { cn } from '@/lib/utils';
import { RANK_THRESHOLDS, RANK_NAMES, Rank } from '@/types';

interface VerticalXPBarProps {
  currentXP: number;
  className?: string;
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

export function VerticalXPBar({ currentXP, className }: VerticalXPBarProps) {
  const rank = getCurrentRank(currentXP);
  const nextRank = getNextRank(rank);
  const { progress } = getProgressToNextRank(currentXP);

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      {/* Next rank at top */}
      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
        {nextRank ? RANK_NAMES[nextRank] : 'MAX'}
      </span>
      
      {/* Vertical bar */}
      <div className="w-3 h-32 rounded-full bg-surface-3 overflow-hidden relative">
        <div 
          className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-500 ease-out"
          style={{ 
            height: `${progress}%`,
            background: 'linear-gradient(to top, hsl(var(--electric-volt)), hsl(82 100% 65%))',
          }}
        />
      </div>
      
      {/* Current rank at bottom */}
      <span className="text-[10px] font-bold text-volt uppercase tracking-wider">
        {RANK_NAMES[rank]}
      </span>
    </div>
  );
}
