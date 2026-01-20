import { cn } from '@/lib/utils';
import { RANK_THRESHOLDS, RANK_NAMES, Rank } from '@/types';

interface VerticalXPBarProps {
  currentXP: number;
  className?: string;
}

// Sub-levels within each rank (10 levels per rank)
const LEVELS_PER_RANK = 10;

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

function getSubLevelInfo(xp: number): { 
  currentLevel: number; 
  nextLevel: number; 
  progress: number;
  xpInLevel: number;
  xpNeededForLevel: number;
} {
  const currentRank = getCurrentRank(xp);
  const nextRank = getNextRank(currentRank);
  
  if (!nextRank) {
    return { 
      currentLevel: LEVELS_PER_RANK, 
      nextLevel: LEVELS_PER_RANK, 
      progress: 100,
      xpInLevel: 0,
      xpNeededForLevel: 0,
    };
  }

  const currentThreshold = RANK_THRESHOLDS[currentRank];
  const nextThreshold = RANK_THRESHOLDS[nextRank];
  const xpInRank = xp - currentThreshold;
  const xpPerRank = nextThreshold - currentThreshold;
  const xpPerLevel = xpPerRank / LEVELS_PER_RANK;
  
  const currentLevel = Math.min(LEVELS_PER_RANK, Math.floor(xpInRank / xpPerLevel) + 1);
  const nextLevel = Math.min(LEVELS_PER_RANK, currentLevel + 1);
  
  const xpAtLevelStart = (currentLevel - 1) * xpPerLevel;
  const xpInLevel = xpInRank - xpAtLevelStart;
  const progress = (xpInLevel / xpPerLevel) * 100;

  return {
    currentLevel,
    nextLevel,
    progress: Math.min(100, Math.max(0, progress)),
    xpInLevel: Math.floor(xpInLevel),
    xpNeededForLevel: Math.floor(xpPerLevel),
  };
}

export function VerticalXPBar({ currentXP, className }: VerticalXPBarProps) {
  const rank = getCurrentRank(currentXP);
  const nextRank = getNextRank(rank);
  const { currentLevel, nextLevel, progress, xpInLevel, xpNeededForLevel } = getSubLevelInfo(currentXP);

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      {/* Next level at top */}
      <span className="text-[10px] font-bold text-muted-foreground">
        Lvl {nextLevel}
      </span>
      
      {/* Vertical bar */}
      <div className="w-2 h-24 rounded-full bg-surface-3 overflow-hidden relative">
        <div 
          className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-500 ease-out"
          style={{ 
            height: `${progress}%`,
            background: 'linear-gradient(to top, hsl(var(--electric-volt)), hsl(82 100% 65%))',
          }}
        />
      </div>
      
      {/* Current level at bottom */}
      <span className="text-[10px] font-bold text-volt">
        Lvl {currentLevel}
      </span>

      {/* Rank name */}
      <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">
        {RANK_NAMES[rank]}
      </span>
    </div>
  );
}
