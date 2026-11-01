import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { BroadcastPage, EmptyPlate, SectionChyron, SectionRule, SegmentBar, TaleOfTape } from '@/components/broadcast';
import { XPBar } from '@/components/ui/XPBar';
import { BadgeArt, GloveArt } from '@/components/ui/GameArt';
import { useProfile } from '@/hooks/useProfile';
import { useWorkoutStats, WeeklyChange } from '@/hooks/useWorkoutStats';
import { useBadges } from '@/hooks/useBadges';
import { useGloves } from '@/hooks/useGloves';
import { GLOVES } from '@/data/gloves';
import { BADGE_CATEGORY_NAMES } from '@/data/badges';
import { 
  Prestige, 
  PRESTIGE_NAMES,
  RANKING_NAMES, 
  RANKING_ORDER,
  getRankingFromLevel,
  getLevelRangeForRanking,
  getXPProgressString,
  isPrestigeEligible,
  getStreakMultiplier,
} from '@/lib/xpSystem';
import { tapeHours, weeklyTape } from '@/lib/weeklyTape';
import { PrestigeAvailableBanner, PrestigePrompt } from '@/components/workout/PrestigePrompt';
import { cn } from '@/lib/utils';
import { RoadToBMF } from '@/components/ui/RoadToBMF';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, getDay } from 'date-fns';

interface StatLineProps {
  label: string;
  value: string;
  change?: WeeklyChange | null;
  onClick?: () => void;
}

/** One line on the stat sheet: label and how it moved on the left, the number on the right. */
function StatLine({ label, value, change, onClick }: StatLineProps) {
  const body = (
    <>
      <span className="min-w-0">
        <span className="lab block">{label}</span>
        {change && (
          <span className={cn('lab mt-0.5 block normal-case tracking-[0.04em]', change.value >= 0 && 'lab-lime')}>
            {change.value >= 0 ? '+' : ''}{change.value}% {change.period}
          </span>
        )}
      </span>
      <b className="fx">{value}</b>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="row-rule min-h-11 w-full items-center text-left transition-colors hover:bg-surface-1">
      {body}
    </button>
  ) : (
    <div className="row-rule items-center">{body}</div>
  );
}

// Calendar heatmap component
function WorkoutCalendar({ workoutDates }: { workoutDates: Date[] }) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Pad beginning with empty cells for alignment
  const startDayOfWeek = getDay(monthStart); // 0=Sun
  const padDays = startDayOfWeek; // number of empty cells before month starts
  
  const hasWorkout = (day: Date) => workoutDates.some(d => isSameDay(d, day));
  const isToday = (day: Date) => isSameDay(day, now);
  const trainedDays = days.filter(hasWorkout).length;
  
  return (
    <section>
      <SectionRule title={format(now, 'MMMM yyyy')} right={`${trainedDays} ${trainedDays === 1 ? 'day' : 'days'}`} />
      <div className="px-4 pt-2">
        <div className="mb-1 grid grid-cols-7 gap-1.5">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="lab text-center">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: padDays }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {days.map((day) => {
            const worked = hasWorkout(day);
            const today = isToday(day);
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'plate fx h-9 text-xl',
                  worked ? 'plate-lime' : today ? 'plate-white' : 'plate-graphite text-muted-foreground',
                )}
              >
                {day.getDate()}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const Stats = () => {
  const { profile, updateProfile } = useProfile();
  const { stats: workoutStats, history } = useWorkoutStats();
  const { earnedBadges, earnedBadgeIds, earnedCount, totalBadgeCount, getBadgesByCategory, currentStats } = useBadges();
  const navigate = useNavigate();
  const [showPrestigePrompt, setShowPrestigePrompt] = useState(false);
  const { equippedGlove, unlockedGloves } = useGloves();
  const equippedGloveData = GLOVES[equippedGlove] || GLOVES.default;

  // Get prestige data from profile
  const prestige: Prestige = profile?.prestige || 'beginner';
  const currentLevel = profile?.current_level || 1;
  const ranking = getRankingFromLevel(currentLevel);
  const totalXP = profile?.total_xp || 0;
  const historyCount = history?.length || 0;
  const workoutsCompleted = Math.max(profile?.workouts_completed || 0, historyCount);
  const currentStreak = profile?.current_streak || 0;
  const longestStreak = profile?.longest_streak || 0;
  const prestigeEligible = isPrestigeEligible(prestige, totalXP);
  const streakMult = getStreakMultiplier(currentStreak);

  const handlePrestige = () => {
    const order: Prestige[] = ['rookie', 'beginner', 'intermediate', 'advanced', 'pro'];
    const idx = order.indexOf(prestige);
    const next = idx < order.length - 1 ? order[idx + 1] : null;
    if (!next) return;
    updateProfile.mutate({
      prestige: next,
      current_level: 1,
      total_xp: 0,
      experience_level: next,
    });
    setShowPrestigePrompt(false);
  };

  // Session XP history (last 20)
  const recentSessions = useMemo(() => {
    if (!history) return [];
    return history.slice(0, 20);
  }, [history]);

  // Recently earned badges (last 5, sorted by earned_at desc)
  const recentBadges = useMemo(() => {
    return [...earnedBadges]
      .sort((a, b) => new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime())
      .slice(0, 5);
  }, [earnedBadges]);

  // Get badge details for display
  const badgesByCategory = useMemo(() => getBadgesByCategory(), [getBadgesByCategory]);

  // Workout dates for calendar heatmap
  const workoutDates = useMemo(() => {
    if (!history) return [];
    return history.map(h => parseISO(h.completed_at));
  }, [history]);

  // Use real data from workout history
  const totalHours = workoutStats.totalTrainingHours || 0;
  const totalRounds = workoutStats.totalRounds || 0;
  const avgIntensity = workoutStats.avgIntensity;
  const caloriesBurned = workoutStats.totalCalories || 0;
  const { changes } = workoutStats;

  // Gamification stats
  const progressStats = [
    { id: 'xp', label: 'Total XP', value: totalXP.toLocaleString(), change: changes.xp },
    { id: 'workouts', label: 'Workouts', value: workoutsCompleted.toString(), change: changes.workouts, onClick: () => navigate('/history') },
    { id: 'streak', label: 'Current Streak', value: `${currentStreak}d`, change: null },
  ];

  // Training stats
  const trainingStats = [
    { id: 'hours', label: 'Training Hours', value: `${totalHours}h`, change: changes.hours },
    { id: 'rounds', label: 'Total Rounds', value: totalRounds.toLocaleString(), change: changes.rounds },
    { id: 'calories', label: 'Calories (est.)', value: caloriesBurned.toLocaleString(), change: changes.calories },
    { id: 'intensity', label: 'Avg Intensity', value: avgIntensity !== null ? `${avgIntensity}/5` : '--', change: changes.intensity },
  ];

  // Tale of the tape, same as home
  const tape = weeklyTape(history ?? []);
  const fighterName = profile?.name?.split(' ')[0] || 'You';

  // Where the ladder goes next
  const rankIndex = RANKING_ORDER.indexOf(ranking);
  const nextRank = RANKING_ORDER[rankIndex + 1];
  const rankRange = getLevelRangeForRanking(ranking);

  if (showPrestigePrompt) {
    return (
      <AppLayout>
        <PrestigePrompt
          currentPrestige={prestige}
          onPrestige={handlePrestige}
          onDefer={() => setShowPrestigePrompt(false)}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <BroadcastPage show="My Stats">
        <h1 className="sr-only">My Stats</h1>

        {prestigeEligible && (
          <div className="px-4 pt-3">
            <PrestigeAvailableBanner
              currentPrestige={prestige}
              onClick={() => setShowPrestigePrompt(true)}
            />
          </div>
        )}

        {/* Lower third: who you are on the card */}
        <section className="relative overflow-hidden pt-3">
          <GloveArt
            id={equippedGloveData.id}
            className="pointer-events-none absolute -right-8 top-0 size-52 mix-blend-screen sm:size-64"
          />
          <div className="relative px-4">
            <p className="lab lab-lime">{PRESTIGE_NAMES[prestige]} tier</p>
            <p className="fx mt-1 text-[clamp(4rem,22vw,6.5rem)] leading-[0.86]">{RANKING_NAMES[ranking]}</p>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3">
              <span className="fx whitespace-nowrap text-5xl">Lvl {currentLevel}</span>
              <span className="lab lab-w">{getXPProgressString(prestige, currentLevel, totalXP)}</span>
            </div>
            <XPBar
              className="mt-2"
              showRank={currentLevel >= 100}
              prestige={prestige}
              level={currentLevel}
              totalXP={totalXP}
              badgeStats={currentStats}
              earnedBadgeIds={earnedBadgeIds}
            />
          </div>
          <button
            type="button"
            onClick={() => navigate('/gloves')}
            className="relative mt-1 flex min-h-11 w-full flex-wrap items-baseline justify-between gap-x-3 px-4 py-2 text-left transition-colors hover:bg-surface-1"
          >
            <span className="fx text-2xl">{equippedGloveData.name}</span>
            <span className="lab lab-w shrink-0">{unlockedGloves.length}/52 Gloves Unlocked</span>
          </button>
        </section>

        {/* Tale of the tape: you against you, from the log */}
        <section className="bg-surface-1 pb-1.5" data-testid="tale-of-tape">
          <SectionChyron>Tale of the tape</SectionChyron>
          {tape.hasTape ? (
            <TaleOfTape
              left={fighterName}
              right={<span className="text-[clamp(1.875rem,10vw,2.75rem)]">Last week</span>}
              rows={[
                { label: 'Sessions', left: tape.thisWeek.sessions, right: tape.lastWeek.sessions || '-' },
                { label: 'Time', left: tapeHours(tape.thisWeek.seconds), right: tape.lastWeek.seconds ? tapeHours(tape.lastWeek.seconds) : '-' },
                { label: 'XP', left: tape.thisWeek.xp.toLocaleString(), right: tape.lastWeek.xp ? tape.lastWeek.xp.toLocaleString() : '-' },
              ]}
            />
          ) : (
            <p className="px-4 pb-2 pt-2.5 text-lg text-foreground">
              <span className="fx mb-1 block text-3xl">No tape on you yet</span>
              Log your first session. Next week, the one you have to beat is you.
            </p>
          )}
        </section>

        {/* Badges */}
        <section>
          <SectionRule title="Badges" right={`${earnedCount} / ${totalBadgeCount}`} />
          <div className="grid grid-cols-4 border-b border-surface-2">
            {badgesByCategory.slice(0, 4).map(({ category, badges }) => (
              <div key={category} className="min-w-0 py-2 text-center">
                <p className="fx text-3xl text-volt">{badges.filter(b => b.earned).length}</p>
                <p className="lab mt-0.5 truncate tracking-[0.04em]">{BADGE_CATEGORY_NAMES[category]}</p>
              </div>
            ))}
          </div>
          {recentBadges.length > 0 && (
            <div className="pt-2">
              <p className="lab px-4">Recently Earned</p>
              <div className="no-scrollbar mt-1 flex gap-3 overflow-x-auto px-4 pb-1">
                {recentBadges.map(badge => {
                  // Find badge details from all badges
                  const details = badgesByCategory
                    .flatMap(c => c.badges)
                    .find(b => b.id === badge.badge_id);
                  if (!details) return null;
                  return (
                    <div key={badge.id} className="w-20 shrink-0 text-center">
                      <BadgeArt id={details.id} className="size-20 mix-blend-screen" />
                      <p className="fx mt-0.5 line-clamp-2 text-base leading-none">{details.name}</p>
                      <p className="lab lab-lime mt-0.5 tracking-[0.04em]">+{details.xpReward} XP</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Stat sheet */}
        <section>
          <SectionRule title="Progress" />
          {progressStats.map(({ id, ...stat }) => <StatLine key={id} {...stat} />)}
        </section>

        <section>
          <SectionRule title="Training" />
          {trainingStats.map(({ id, ...stat }) => <StatLine key={id} {...stat} />)}
        </section>

        {/* Calendar Heatmap */}
        <WorkoutCalendar workoutDates={workoutDates} />

        {/* Session XP History (Last 20) */}
        <section className="pt-2">
          <SectionRule title="Recent Sessions" />
          {recentSessions.length > 0 ? (
            recentSessions.map((session) => (
              <div key={session.id} className="row-rule items-center">
                <div className="min-w-0">
                  <p className="fx truncate text-2xl">{session.workout_name}</p>
                  <p className="lab mt-0.5">
                    {format(parseISO(session.completed_at), 'MMM d, h:mm a')}, {Math.round(session.duration / 60)}m
                  </p>
                </div>
                <b className="fx text-volt">+{session.xp_earned.toLocaleString()}</b>
              </div>
            ))
          ) : (
            <EmptyPlate title="No sessions yet" body="Complete a workout to see your history!" />
          )}
        </section>

        {/* Road to BMFK */}
        <div className="pt-2">
          <RoadToBMF prestige={prestige} level={currentLevel} totalSessions={workoutsCompleted} longestStreak={longestStreak} />
        </div>

        {/* Ranking Ladder */}
        <section className="pb-5 pt-2">
          <SectionRule title="Ranking Ladder" right={PRESTIGE_NAMES[prestige]} className="mb-2" />
          <div className="space-y-1">
            {[...RANKING_ORDER].reverse().map((rankItem, index) => {
              const isCurrentRanking = rankItem === ranking;
              const levelRange = getLevelRangeForRanking(rankItem);
              const isAchieved = currentLevel >= levelRange.min;
              return (
                <div key={rankItem} style={{ marginLeft: `calc(0.75rem + ${(RANKING_ORDER.length - 1 - index) * 2.2}%)` }}>
                  <div
                    aria-current={isCurrentRanking || undefined}
                    className={cn(
                      'plate plate-bleed-r fx w-full justify-between gap-3 pl-4 pr-4',
                      isCurrentRanking ? 'plate-lime h-14 text-5xl' : isAchieved ? 'plate-steel h-9 text-3xl' : 'plate-graphite h-9 text-3xl text-muted-foreground',
                    )}
                  >
                    <span>{RANKING_NAMES[rankItem]}</span>
                    <span className={isCurrentRanking ? 'text-2xl' : 'text-xl'}>Lvl {levelRange.min}-{levelRange.max}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {nextRank && (
            <div className="px-4 pt-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="lab lab-w">To {RANKING_NAMES[nextRank]} at {getLevelRangeForRanking(nextRank).min}</span>
                <span className="fx text-2xl text-volt">Lvl {currentLevel}</span>
              </div>
              <SegmentBar
                className="mt-1"
                total={10}
                filled={currentLevel - rankRange.min + 1}
                height="0.875rem"
                label={`Level ${currentLevel}, next rank at ${getLevelRangeForRanking(nextRank).min}`}
              />
            </div>
          )}
        </section>
      </BroadcastPage>
    </AppLayout>
  );
};

export default Stats;
