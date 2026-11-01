import { cn } from '@/lib/utils';
import {
  Prestige,
  PRESTIGE_NAMES,
  RANKING_NAMES,
  getLevelProgress,
  getXPProgressString,
  getRankingFromLevel,
} from '@/lib/xpSystem';
import { ALL_BADGES, Badge, getBadgeProgress, BadgeStats } from '@/data/badges';
import { SegmentBar } from '@/components/broadcast';

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

const SEGMENTS = 24;

const Meter = ({ percent, label }: { percent: number; label: string }) => (
  <SegmentBar total={SEGMENTS} filled={Math.round((percent / 100) * SEGMENTS)} height="0.8125rem" label={label} />
);

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

    return (
      <div className={cn('w-full', className)}>
        {showRank && (
          <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span className="lab lab-lime">{PRESTIGE_NAMES[prestige]}, max level</span>
            <span className="lab min-w-0 truncate">
              {nextBadge ? `Next: ${nextBadge.badge.name}` : 'All badges earned!'}
            </span>
          </div>
        )}
        <Meter percent={progress} label={nextBadge ? `${Math.round(progress)}% toward ${nextBadge.badge.name}` : 'All badges earned'} />
        {nextBadge && (
          <p className="lab mt-1">
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
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <span className="lab lab-w">
            <span className="lab-lime">{PRESTIGE_NAMES[prestige]}</span>, {RANKING_NAMES[ranking]}, <span className="lab-lime">Lvl {level}</span>
          </span>
          <span className="lab">{xpString}</span>
        </div>
      )}
      <Meter percent={progress} label={`${Math.round(progress)}% of the way to the next level`} />
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
