import { cn } from '@/lib/utils';
import { 
  Prestige, 
  Ranking,
  PRESTIGE_NAMES, 
  RANKING_NAMES,
  getLevelProgress,
  getXPProgressString,
  getRankingFromLevel,
  getLevelFromXP,
} from '@/lib/xpSystem';
import { ALL_BADGES, Badge, getBadgeProgress, BadgeStats, BADGE_CATEGORY_COLORS } from '@/data/badges';

interface XPBarProps {
  prestige: Prestige;
  level: number;
  totalXP: number;
  className?: string;
  showRank?: boolean;
  /** Badge stats for next-badge progress at L100 */
  badgeStats?: BadgeStats;
  /** Earned badge IDs for next-badge calculation */
  earnedBadgeIds?: string[];
}

// Prestige tier colors for the bar
const PRESTIGE_BAR_COLORS: Record<Prestige, string> = {
  rookie: 'bg-slate-400',
  beginner: 'bg-volt',
  intermediate: 'bg-blue-400',
  advanced: 'bg-purple-400',
  pro: 'bg-amber-400',
};

/**
 * Find the next unearned badge closest to completion.
 */
function getNextBadgeProgress(
  badgeStats: BadgeStats,
  earnedBadgeIds: string[],
): { badge: Badge; progress: number } | null {
  let best: { badge: Badge; progress: number } | null = null;
  
  for (const badge of ALL_BADGES) {
    if (earnedBadgeIds.includes(badge.id)) continue;
    const progress = getBadgeProgress(badge, badgeStats);
    if (progress >= 1) continue; // Should be earned already
    if (!best || progress > best.progress) {
      best = { badge, progress };
    }
  }
  
  return best;
}

export function XPBar({ prestige, level, totalXP, className, showRank = true, badgeStats, earnedBadgeIds }: XPBarProps) {
  const isAtMax = level >= 100;
  const ranking = getRankingFromLevel(level);
  
  // At L100, show next-badge progress instead of level XP
  if (isAtMax && badgeStats && earnedBadgeIds) {
    const nextBadge = getNextBadgeProgress(badgeStats, earnedBadgeIds);
    const progress = nextBadge ? Math.min(100, nextBadge.progress * 100) : 100;
    const colors = nextBadge ? BADGE_CATEGORY_COLORS[nextBadge.badge.category] : null;
    
    return (
      <div className={cn('w-full', className)}>
        {showRank && (
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-volt uppercase tracking-wide">
                {PRESTIGE_NAMES[prestige]}
              </span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs font-bold text-amber-400">
                MAX LEVEL
              </span>
            </div>
            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
              {nextBadge ? `Next: ${nextBadge.badge.name}` : 'All badges earned!'}
            </span>
          </div>
        )}
        <div className="xp-bar">
          <div 
            className={cn(
              'xp-bar-fill transition-all duration-500 ease-out',
              colors ? '' : 'bg-amber-400',
            )}
            style={{ 
              width: `${progress}%`,
              ...(colors ? {} : {}),
            }}
          />
        </div>
        {nextBadge && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {Math.round(progress)}% toward {nextBadge.badge.name}
          </p>
        )}
      </div>
    );
  }
  
  // Normal level progress
  const progress = getLevelProgress(prestige, level, totalXP);
  const xpString = getXPProgressString(prestige, level, totalXP);

  return (
    <div className={cn('w-full', className)}>
      {showRank && (
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-volt uppercase tracking-wide">
              {PRESTIGE_NAMES[prestige]}
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs font-medium text-foreground">
              {RANKING_NAMES[ranking]}
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs font-bold text-volt">
              Lvl {level}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {xpString}
          </span>
        </div>
      )}
      <div className="xp-bar">
        <div 
          className={cn(
            'xp-bar-fill transition-all duration-500 ease-out',
            PRESTIGE_BAR_COLORS[prestige]
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// Legacy support - converts old XP-only format to new format
interface LegacyXPBarProps {
  currentXP: number;
  className?: string;
  showRank?: boolean;
}

export function LegacyXPBar({ currentXP, className, showRank = true }: LegacyXPBarProps) {
  return (
    <XPBar 
      prestige="beginner" 
      level={1} 
      totalXP={currentXP} 
      className={className} 
      showRank={showRank} 
    />
  );
}
