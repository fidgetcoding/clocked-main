import { cn } from '@/lib/utils';
import { RANK_THRESHOLDS, RANK_NAMES, Rank } from '@/types';

interface VerticalXPBarProps {
  currentXP: number;
  className?: string;
}

// 100 XP per level
const XP_PER_LEVEL = 100;

function getCurrentRank(xp: number): Rank {
  const ranks = Object.entries(RANK_THRESHOLDS).reverse() as [Rank, number][];
  for (const [rank, threshold] of ranks) {
    if (xp >= threshold) return rank;
  }
  return 'regional';
}

function getLevelInfo(xp: number): { 
  currentLevel: number; 
  progress: number;
  xpInLevel: number;
} {
  const currentLevel = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpInLevel = xp % XP_PER_LEVEL;
  const progress = (xpInLevel / XP_PER_LEVEL) * 100;

  return {
    currentLevel,
    progress,
    xpInLevel,
  };
}

export function VerticalXPBar({ currentXP, className }: VerticalXPBarProps) {
  const rank = getCurrentRank(currentXP);
  const { currentLevel, progress, xpInLevel } = getLevelInfo(currentXP);

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      {/* Next level at top */}
      <span className="text-[10px] font-bold text-muted-foreground">
        Lvl {currentLevel + 1}
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
