import { cn } from '@/lib/utils';
import { 
  Prestige, 
  PRESTIGE_NAMES,
  RANKING_NAMES,
  getLevelProgress,
  getRankingFromLevel
} from '@/lib/xpSystem';

interface VerticalXPBarProps {
  prestige: Prestige;
  level: number;
  totalXP: number;
  className?: string;
}

// Prestige tier gradient colors
const PRESTIGE_GRADIENTS: Record<Prestige, string> = {
  rookie: 'linear-gradient(to top, rgb(148 163 184), rgb(203 213 225))',
  beginner: 'linear-gradient(to top, hsl(var(--electric-volt)), hsl(82 100% 65%))',
  intermediate: 'linear-gradient(to top, rgb(96 165 250), rgb(147 197 253))',
  advanced: 'linear-gradient(to top, rgb(168 85 247), rgb(192 132 252))',
  pro: 'linear-gradient(to top, rgb(251 191 36), rgb(253 224 71))',
};

export function VerticalXPBar({ prestige, level, totalXP, className }: VerticalXPBarProps) {
  const ranking = getRankingFromLevel(level);
  const progress = getLevelProgress(prestige, level, totalXP);

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      {/* Next level at top */}
      <span className="text-[10px] font-bold text-muted-foreground">
        Lvl {Math.min(100, level + 1)}
      </span>
      
      {/* Vertical bar */}
      <div className="w-2 h-24 rounded-full bg-surface-3 overflow-hidden relative">
        <div 
          className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-500 ease-out"
          style={{ 
            height: `${progress}%`,
            background: PRESTIGE_GRADIENTS[prestige],
          }}
        />
      </div>
      
      {/* Current level at bottom */}
      <span className="text-[10px] font-bold text-volt">
        Lvl {level}
      </span>

      {/* Ranking name */}
      <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">
        {RANKING_NAMES[ranking]}
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
