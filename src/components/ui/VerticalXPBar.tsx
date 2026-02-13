import { cn } from '@/lib/utils';
import { 
  Prestige, 
  PRESTIGE_NAMES,
  getLevelProgress,
} from '@/lib/xpSystem';
import { ALL_BADGES, Badge, getBadgeProgress, BadgeStats } from '@/data/badges';

interface VerticalXPBarProps {
  prestige: Prestige;
  level: number;
  totalXP: number;
  className?: string;
  /** Badge stats for next-badge progress at L100 */
  badgeStats?: BadgeStats;
  /** Earned badge IDs for next-badge calculation */
  earnedBadgeIds?: string[];
  /** Championship round gold override */
  isChampionship?: boolean;
  /** Cooldown blue override */
  isCooldown?: boolean;
}

// Prestige tier gradient colors
const PRESTIGE_GRADIENTS: Record<Prestige, string> = {
  rookie: 'linear-gradient(to top, rgb(148 163 184), rgb(203 213 225))',
  beginner: 'linear-gradient(to top, hsl(var(--electric-volt)), hsl(82 100% 65%))',
  intermediate: 'linear-gradient(to top, rgb(96 165 250), rgb(147 197 253))',
  advanced: 'linear-gradient(to top, rgb(168 85 247), rgb(192 132 252))',
  pro: 'linear-gradient(to top, rgb(251 191 36), rgb(253 224 71))',
};

function getNextBadgeProgress(
  badgeStats: BadgeStats,
  earnedBadgeIds: string[],
): { badge: Badge; progress: number } | null {
  let best: { badge: Badge; progress: number } | null = null;
  for (const badge of ALL_BADGES) {
    if (earnedBadgeIds.includes(badge.id)) continue;
    const progress = getBadgeProgress(badge, badgeStats);
    if (progress >= 1) continue;
    if (!best || progress > best.progress) {
      best = { badge, progress };
    }
  }
  return best;
}

export function VerticalXPBar({ prestige, level, totalXP, className, badgeStats, earnedBadgeIds, isChampionship, isCooldown }: VerticalXPBarProps) {
  const isAtMax = level >= 100;
  
  // At L100, show next-badge progress
  if (isAtMax && badgeStats && earnedBadgeIds) {
    const nextBadge = getNextBadgeProgress(badgeStats, earnedBadgeIds);
    const progress = nextBadge ? Math.min(100, nextBadge.progress * 100) : 100;
    
    return (
      <div className={cn('flex flex-col items-center gap-1', className)}>
        <span className="text-[10px] font-bold text-amber-400">
          🎖️
        </span>
        <div className="w-2 h-24 rounded-full bg-surface-3 overflow-hidden relative">
          <div 
            className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-500 ease-out"
            style={{ 
              height: `${progress}%`,
              background: 'linear-gradient(to top, rgb(251 191 36), rgb(253 224 71))',
            }}
          />
        </div>
        <span className="text-[10px] font-bold text-amber-400">
          L100
        </span>
      </div>
    );
  }
  
  const progress = getLevelProgress(prestige, level, totalXP);

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      {/* Next level at top */}
      <span className={cn("text-[10px] font-bold", isChampionship ? "text-championship-gold/60" : isCooldown ? "text-cooldown-blue/60" : "text-muted-foreground")}>
        Lvl {Math.min(100, level + 1)}
      </span>
      
      {/* Vertical bar */}
      <div className="w-2 h-24 rounded-full bg-surface-3 overflow-hidden relative">
        <div 
          className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-500 ease-out"
          style={{ 
            height: `${progress}%`,
            background: isChampionship 
              ? 'linear-gradient(to top, hsl(var(--championship-gold)), hsl(45 93% 60%))' 
              : isCooldown
              ? 'linear-gradient(to top, hsl(var(--cooldown-blue)), hsl(199 89% 65%))'
              : PRESTIGE_GRADIENTS[prestige],
          }}
        />
      </div>
      
      {/* Current level at bottom */}
      <span className={cn("text-[10px] font-bold", isChampionship ? "text-championship-gold" : isCooldown ? "text-cooldown-blue" : "text-volt")}>
        Lvl {level}
      </span>
    </div>
  );
}

// Legacy support wrapper
interface LegacyVerticalXPBarProps {
  currentXP: number;
  className?: string;
}

export function LegacyVerticalXPBar({ currentXP, className }: LegacyVerticalXPBarProps) {
  return (
    <VerticalXPBar 
      prestige="beginner" 
      level={1} 
      totalXP={currentXP} 
      className={className} 
    />
  );
}
