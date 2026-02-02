import { cn } from '@/lib/utils';
import { 
  Prestige, 
  Ranking,
  PRESTIGE_NAMES, 
  RANKING_NAMES,
  getLevelProgress,
  getXPProgressString,
  getRankingFromLevel
} from '@/lib/xpSystem';

interface XPBarProps {
  prestige: Prestige;
  level: number;
  totalXP: number;
  className?: string;
  showRank?: boolean;
}

// Prestige tier colors for the bar
const PRESTIGE_BAR_COLORS: Record<Prestige, string> = {
  rookie: 'bg-slate-400',
  beginner: 'bg-volt',
  intermediate: 'bg-blue-400',
  advanced: 'bg-purple-400',
  pro: 'bg-amber-400',
};

export function XPBar({ prestige, level, totalXP, className, showRank = true }: XPBarProps) {
  const ranking = getRankingFromLevel(level);
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
  // For legacy usage, assume beginner prestige at level 1
  // This maintains backward compatibility during migration
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
