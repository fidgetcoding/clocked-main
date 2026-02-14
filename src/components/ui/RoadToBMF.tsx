import { cn } from '@/lib/utils';
import { Prestige, PRESTIGE_NAMES, PRESTIGE_ORDER } from '@/lib/xpSystem';
import { Trophy } from 'lucide-react';

interface RoadToBMFProps {
  prestige: Prestige;
  level: number;
}

const TIER_COLORS: Record<Prestige, { bg: string; fill: string; text: string }> = {
  rookie: { bg: 'bg-slate-700', fill: 'bg-slate-400', text: 'text-slate-400' },
  beginner: { bg: 'bg-volt/20', fill: 'bg-volt', text: 'text-volt' },
  intermediate: { bg: 'bg-blue-500/20', fill: 'bg-blue-400', text: 'text-blue-400' },
  advanced: { bg: 'bg-purple-500/20', fill: 'bg-purple-400', text: 'text-purple-400' },
  pro: { bg: 'bg-amber-500/20', fill: 'bg-amber-400', text: 'text-amber-400' },
};

export function RoadToBMF({ prestige, level }: RoadToBMFProps) {
  const currentIdx = PRESTIGE_ORDER.indexOf(prestige);
  // Total progress: each tier = 100 levels, 5 tiers = 500 total
  const totalProgress = currentIdx * 100 + Math.min(level, 100);
  const totalMax = 500;
  const overallPercent = (totalProgress / totalMax) * 100;

  return (
    <div className="card-workout space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Road to BMF</h3>
        <div className="flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-bold text-amber-400">{Math.round(overallPercent)}%</span>
        </div>
      </div>

      {/* Tier progress bars */}
      <div className="space-y-2">
        {PRESTIGE_ORDER.map((tier, idx) => {
          const colors = TIER_COLORS[tier];
          const isActive = idx === currentIdx;
          const isCompleted = idx < currentIdx;
          const isFuture = idx > currentIdx;
          const fillPercent = isCompleted ? 100 : isActive ? Math.min(level, 100) : 0;

          return (
            <div key={tier} className="flex items-center gap-2">
              <span className={cn(
                "text-[10px] font-bold uppercase w-10 text-right tracking-wide",
                isActive ? colors.text : isCompleted ? 'text-muted-foreground' : 'text-surface-3'
              )}>
                {PRESTIGE_NAMES[tier].slice(0, 4)}
              </span>
              <div className={cn("flex-1 h-3 rounded-full overflow-hidden", colors.bg)}>
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700 ease-out",
                    colors.fill,
                    isFuture && "opacity-0"
                  )}
                  style={{ width: `${fillPercent}%` }}
                />
              </div>
              <span className={cn(
                "text-[10px] font-bold w-8",
                isActive ? 'text-foreground' : isCompleted ? 'text-muted-foreground' : 'text-surface-3'
              )}>
                {isCompleted ? '100' : isActive ? `${Math.min(level, 100)}` : '0'}
              </span>
            </div>
          );
        })}
      </div>

      {/* BMF label */}
      <div className="flex items-center justify-center gap-2 pt-1">
        <div className="h-px flex-1 bg-surface-3" />
        <span className="text-xs font-black text-amber-400 tracking-widest">🏆 BMF</span>
        <div className="h-px flex-1 bg-surface-3" />
      </div>
    </div>
  );
}
