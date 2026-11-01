import { cn } from '@/lib/utils';
import { Prestige, PRESTIGE_ORDER } from '@/lib/xpSystem';
import { SectionChyron, SectionRule, SegmentBar } from '@/components/broadcast';
import { GloveArt } from '@/components/ui/GameArt';

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

const BMF_SESSIONS = 250;
const BMFK_STREAK = 365;
const TIER_SEGMENTS = 20;
const BOSS_SEGMENTS = 30;

function BossLine({ title, current, goal, detail, percent, done }: { title: string; current: number; goal: number; detail: string; percent: number; done: boolean }) {
  return (
    <div className="px-4 pt-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className={cn('fx text-5xl', done && 'text-championship-gold')}>{title}</span>
        <span className="fx whitespace-nowrap text-3xl">
          <span className={done ? 'text-championship-gold' : 'text-volt'}>{current}</span> of {goal}
        </span>
      </div>
      <p className="prose-w mt-1 text-base">{detail}</p>
      <SegmentBar
        className="mt-1.5"
        total={BOSS_SEGMENTS}
        filled={percent > 0 ? Math.max(1, Math.round((percent / 100) * BOSS_SEGMENTS)) : 0}
        height="1rem"
        gold={done}
        label={`${current} of ${goal}`}
      />
    </div>
  );
}

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
    <section>
      <SectionRule title="Road to BMFK" right={`${overallPercent}%`} />

      <div className="space-y-1.5 px-4 pt-3">
        {PRESTIGE_ORDER.map((tier, idx) => {
          const isActive = idx === currentIdx;
          const isCompleted = idx < currentIdx;
          const fillPercent = isCompleted ? 100 : isActive ? Math.min(level, 100) : 0;

          return (
            <div key={tier} className="grid grid-cols-[2.75rem_1fr_2rem] items-center gap-2">
              <span className={cn('lab', isActive && 'lab-lime', isCompleted && 'lab-w')}>{TIER_LABELS[tier]}</span>
              <SegmentBar total={TIER_SEGMENTS} filled={Math.round((fillPercent / 100) * TIER_SEGMENTS)} height="0.75rem" label={`${tier}, ${fillPercent} of 100`} />
              <span className={cn('fx text-right text-xl', !isActive && !isCompleted && 'text-muted-foreground')}>{fillPercent}</span>
            </div>
          );
        })}
      </div>

      <div className="relative mt-4">
        <div className="art-slant absolute right-0 top-0 h-28 w-28 [clip-path:polygon(24.9%_0,100%_0,75.1%_100%,0_100%)]" aria-hidden="true">
          <GloveArt id="bmf" className={cn('h-full w-full', !bmfDone && 'art-off')} />
        </div>
        <SectionChyron tone={bmfDone ? 'white' : 'lime'}>Final Boss</SectionChyron>
        <div className="relative pt-14">
          <BossLine title="BMF" current={totalSessions} goal={BMF_SESSIONS} detail="250 total sessions, Baddest MF" percent={bmfPercent} done={bmfDone} />
          <BossLine title="BMFK" current={longestStreak} goal={BMFK_STREAK} detail="365 consecutive days, Baddest MF Killer" percent={bmfkPercent} done={bmfkDone} />
        </div>
      </div>
    </section>
  );
}
