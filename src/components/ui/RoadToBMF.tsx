import { cn } from '@/lib/utils';
import { Prestige, PRESTIGE_ORDER } from '@/lib/xpSystem';
import { Trophy, Flame } from 'lucide-react';

interface RoadToBMFProps {
  prestige: Prestige;
  level: number;
  totalSessions: number;
  longestStreak: number;
}

const TIER_LABELS: Record<Prestige, string> = {
  rookie: 'ROOK',
  beginner: 'BEG',
  intermediate: 'INT',
  advanced: 'ADV',
  pro: 'PRO',
};

const TIER_COLORS: Record<Prestige, { bg: string; fill: string; text: string }> = {
  rookie: { bg: 'bg-slate-700', fill: 'bg-slate-400', text: 'text-slate-400' },
  beginner: { bg: 'bg-volt/20', fill: 'bg-volt', text: 'text-volt' },
  intermediate: { bg: 'bg-blue-500/20', fill: 'bg-blue-400', text: 'text-blue-400' },
  advanced: { bg: 'bg-purple-500/20', fill: 'bg-purple-400', text: 'text-purple-400' },
  pro: { bg: 'bg-amber-500/20', fill: 'bg-amber-400', text: 'text-amber-400' },
};

const BMF_SESSIONS = 250;
const BMFK_STREAK = 365;

export function RoadToBMF({ prestige, level, totalSessions, longestStreak }: RoadToBMFProps) {
  const currentIdx = PRESTIGE_ORDER.indexOf(prestige);

  const bmfPercent = Math.min(100, (totalSessions / BMF_SESSIONS) * 100);
  const bmfDone = totalSessions >= BMF_SESSIONS;
  const bmfkPercent = Math.min(100, (longestStreak / BMFK_STREAK) * 100);
  const bmfkDone = longestStreak >= BMFK_STREAK;

  // Overall completion: 5 tier bars + BMF + BMFK = 7 equal parts
  const tierProgress = PRESTIGE_ORDER.reduce((sum, _tier, idx) => {
    if (idx < currentIdx) return sum + 100;
    if (idx === currentIdx) return sum + Math.min(level, 100);
    return sum;
  }, 0);
  const overallPercent = Math.round((tierProgress + bmfPercent + bmfkPercent) / 7);

  return (
    <div className="card-workout space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Road to BMF</h3>
        <span className="text-xs font-black text-volt">{overallPercent}%</span>
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
                {TIER_LABELS[tier]}
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

      {/* Divider */}
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-surface-3" />
        <span className="text-[10px] font-black text-amber-400 tracking-widest uppercase">Final Boss</span>
        <div className="h-px flex-1 bg-surface-3" />
      </div>

      {/* BMF + BMFK */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-[10px] font-bold uppercase w-10 text-right tracking-wide",
            bmfDone ? 'text-amber-400' : bmfPercent > 0 ? 'text-red-400' : 'text-surface-3'
          )}>
            BMF
          </span>
          <div className="flex-1 h-3 rounded-full overflow-hidden bg-red-500/20">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700 ease-out",
                bmfDone ? "bg-amber-400" : "bg-red-400"
              )}
              style={{ width: `${bmfPercent}%` }}
            />
          </div>
          <span className={cn(
            "text-[10px] font-bold w-12 text-right",
            bmfDone ? 'text-amber-400' : bmfPercent > 0 ? 'text-foreground' : 'text-surface-3'
          )}>
            {totalSessions}/{BMF_SESSIONS}
          </span>
        </div>
        <p className="text-[9px] text-muted-foreground pl-12">
          <Trophy className="w-3 h-3 inline mr-1 text-red-400" />
          250 total sessions — Baddest MF
        </p>

        <div className="flex items-center gap-2 mt-1">
          <span className={cn(
            "text-[10px] font-bold uppercase w-10 text-right tracking-wide",
            bmfkDone ? 'text-amber-400' : bmfkPercent > 0 ? 'text-red-400' : 'text-surface-3'
          )}>
            BMFK
          </span>
          <div className="flex-1 h-3 rounded-full overflow-hidden bg-red-500/20">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700 ease-out",
                bmfkDone ? "bg-amber-400" : "bg-red-400"
              )}
              style={{ width: `${bmfkPercent}%` }}
            />
          </div>
          <span className={cn(
            "text-[10px] font-bold w-12 text-right",
            bmfkDone ? 'text-amber-400' : bmfkPercent > 0 ? 'text-foreground' : 'text-surface-3'
          )}>
            {longestStreak}/{BMFK_STREAK}
          </span>
        </div>
        <p className="text-[9px] text-muted-foreground pl-12">
          <Flame className="w-3 h-3 inline mr-1 text-red-400" />
          365 consecutive days — Baddest MF Killer
        </p>
      </div>
    </div>
  );
}
