import { cn } from '@/lib/utils';
import { 
  Prestige, 
  getXPWithinCurrentLevel,
  getLevelProgress,
} from '@/lib/xpSystem';

interface TimerXPBarProps {
  prestige: Prestige;
  level: number;
  totalXP: number;
  className?: string;
}

// Compact horizontal XP bar for the timer screen
// Shows: "L23 — 847 / 1,275 XP" with a thin progress bar
const PRESTIGE_BAR_BG: Record<Prestige, string> = {
  rookie: 'bg-slate-400',
  beginner: 'bg-volt',
  intermediate: 'bg-blue-400',
  advanced: 'bg-purple-400',
  pro: 'bg-amber-400',
};

export function TimerXPBar({ prestige, level, totalXP, className }: TimerXPBarProps) {
  const { current, required } = getXPWithinCurrentLevel(prestige, totalXP);
  const progress = getLevelProgress(prestige, level, totalXP);

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] font-black text-volt tracking-wide">
          L{level}
        </span>
        <span className="text-[10px] font-medium text-muted-foreground">
          {Math.floor(current).toLocaleString()} / {required.toLocaleString()} XP
        </span>
      </div>
      <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
        <div 
          className={cn(
            'h-full rounded-full transition-all duration-300 ease-out',
            PRESTIGE_BAR_BG[prestige]
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
