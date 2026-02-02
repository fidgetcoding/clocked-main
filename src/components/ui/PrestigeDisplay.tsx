import { cn } from '@/lib/utils';
import { 
  Prestige, 
  Ranking, 
  PRESTIGE_NAMES, 
  RANKING_NAMES,
  getLevelProgress,
  getXPProgressString
} from '@/lib/xpSystem';

interface PrestigeDisplayProps {
  prestige: Prestige;
  ranking: Ranking;
  level: number;
  totalXP: number;
  showProgress?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Prestige tier colors
const PRESTIGE_COLORS: Record<Prestige, { bg: string; text: string; glow: string }> = {
  rookie: { bg: 'bg-slate-500/20', text: 'text-slate-400', glow: 'shadow-slate-500/20' },
  beginner: { bg: 'bg-volt/20', text: 'text-volt', glow: 'shadow-volt/20' },
  intermediate: { bg: 'bg-blue-500/20', text: 'text-blue-400', glow: 'shadow-blue-500/20' },
  advanced: { bg: 'bg-purple-500/20', text: 'text-purple-400', glow: 'shadow-purple-500/20' },
  pro: { bg: 'bg-amber-500/20', text: 'text-amber-400', glow: 'shadow-amber-500/20' },
};

export function PrestigeDisplay({ 
  prestige, 
  ranking, 
  level, 
  totalXP,
  showProgress = true,
  size = 'md',
  className 
}: PrestigeDisplayProps) {
  const colors = PRESTIGE_COLORS[prestige];
  const progress = getLevelProgress(prestige, level, totalXP);
  const xpString = getXPProgressString(prestige, level, totalXP);

  const sizeClasses = {
    sm: {
      badge: 'px-2 py-1 text-xs',
      display: 'text-sm',
      bar: 'h-1',
    },
    md: {
      badge: 'px-3 py-1.5 text-sm',
      display: 'text-base',
      bar: 'h-1.5',
    },
    lg: {
      badge: 'px-4 py-2 text-lg',
      display: 'text-xl',
      bar: 'h-2',
    },
  };

  const sizes = sizeClasses[size];

  return (
    <div className={cn('space-y-2', className)}>
      {/* Main Display: Prestige - Ranking - Level */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Prestige Badge */}
        <div className={cn(
          'rounded-full font-bold uppercase tracking-wide',
          colors.bg,
          colors.text,
          sizes.badge
        )}>
          {PRESTIGE_NAMES[prestige]}
        </div>
        
        {/* Separator */}
        <span className="text-muted-foreground">-</span>
        
        {/* Ranking */}
        <span className={cn('font-semibold text-foreground', sizes.display)}>
          {RANKING_NAMES[ranking]}
        </span>
        
        {/* Separator */}
        <span className="text-muted-foreground">-</span>
        
        {/* Level */}
        <span className={cn('font-bold', colors.text, sizes.display)}>
          Level {level}
        </span>
      </div>

      {/* Progress Bar */}
      {showProgress && (
        <div className="space-y-1">
          <div className={cn(
            'w-full rounded-full bg-surface-3 overflow-hidden',
            sizes.bar
          )}>
            <div 
              className={cn(
                'h-full rounded-full transition-all duration-500 ease-out',
                prestige === 'rookie' ? 'bg-slate-400' :
                prestige === 'beginner' ? 'bg-volt' :
                prestige === 'intermediate' ? 'bg-blue-400' :
                prestige === 'advanced' ? 'bg-purple-400' :
                'bg-amber-400'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{xpString}</p>
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
  const colors = PRESTIGE_COLORS[prestige];
  
  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
      colors.bg,
      colors.text,
      className
    )}>
      <span>{PRESTIGE_NAMES[prestige]}</span>
      <span className="opacity-60">•</span>
      <span>{RANKING_NAMES[ranking]}</span>
      <span className="opacity-60">•</span>
      <span>Lvl {level}</span>
    </div>
  );
}
