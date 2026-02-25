import { useState, useMemo } from 'react';
import { Flame, Trophy, Clock, Zap, TrendingUp, TrendingDown, Target, Dumbbell, Activity, Award, Calendar as CalendarIcon, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { XPBar } from '@/components/ui/XPBar';
import { PrestigeDisplay } from '@/components/ui/PrestigeDisplay';
import { useProfile } from '@/hooks/useProfile';
import { useWorkoutStats, WeeklyChange } from '@/hooks/useWorkoutStats';
import { useBadges } from '@/hooks/useBadges';
import { useGloves } from '@/hooks/useGloves';
import { GLOVES } from '@/data/gloves';
import { BADGE_CATEGORY_COLORS, BADGE_CATEGORY_NAMES } from '@/data/badges';
import { 
  Prestige, 
  PRESTIGE_NAMES,
  RANKING_NAMES, 
  RANKING_ORDER,
  getRankingFromLevel,
  getLevelRangeForRanking,
  isPrestigeEligible,
  getStreakMultiplier,
} from '@/lib/xpSystem';
import { PrestigeAvailableBanner, PrestigePrompt } from '@/components/workout/PrestigePrompt';
import { cn } from '@/lib/utils';
import { RoadToBMF } from '@/components/ui/RoadToBMF';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, getDay } from 'date-fns';

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
  change?: WeeklyChange | null;
  onClick?: () => void;
}

function StatCard({ icon: Icon, label, value, color, change, onClick }: StatCardProps) {
  return (
    <div className={cn("card-workout text-left w-full", onClick && "cursor-pointer active:scale-[0.98] transition-transform")} onClick={onClick}>
      <div className="flex items-start justify-between">
        <Icon className={`w-5 h-5 ${color} mb-2`} />
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
      {change && (
        <div className={cn(
          'flex items-center gap-1 mt-2 text-xs font-medium',
          change.value >= 0 ? 'text-volt' : 'text-alert-red'
        )}>
          {change.value >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          <span>{change.value >= 0 ? '+' : ''}{change.value}% {change.period}</span>
        </div>
      )}
    </div>
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
  
  return (
    <div className="card-workout">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-foreground text-sm">{format(now, 'MMMM yyyy')}</h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {workoutDates.filter(d => d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()).length} days
        </span>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-[10px] text-muted-foreground text-center font-medium">{d}</div>
        ))}
      </div>
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: padDays }).map((_, i) => (
          <div key={`pad-${i}`} className="w-full aspect-square" />
        ))}
        {days.map((day) => {
          const worked = hasWorkout(day);
          const today = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                'w-full aspect-square rounded-sm flex items-center justify-center text-[10px] font-medium',
                worked ? 'bg-volt/80 text-primary-foreground' : 'bg-surface-2 text-muted-foreground',
                today && !worked && 'ring-1 ring-volt/40',
                today && worked && 'ring-1 ring-volt',
              )}
            >
              {day.getDate()}
            </div>
          );
        })}
      </div>
    </div>
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
    } as any);
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
    { id: 'xp', icon: Zap, label: 'Total XP', value: totalXP.toLocaleString(), color: 'text-muted-foreground', change: changes.xp },
    { id: 'workouts', icon: Trophy, label: 'Workouts', value: workoutsCompleted.toString(), color: 'text-muted-foreground', change: changes.workouts, onClick: () => navigate('/history') },
    { id: 'streak', icon: Flame, label: 'Current Streak', value: `${currentStreak}d`, color: 'text-muted-foreground', change: null },
  ];

  // Training stats
  const trainingStats = [
    { id: 'hours', icon: Clock, label: 'Training Hours', value: `${totalHours}h`, color: 'text-muted-foreground', change: changes.hours },
    { id: 'rounds', icon: Target, label: 'Total Rounds', value: totalRounds.toLocaleString(), color: 'text-muted-foreground', change: changes.rounds },
    { id: 'calories', icon: Activity, label: 'Calories (est.)', value: caloriesBurned.toLocaleString(), color: 'text-muted-foreground', change: changes.calories },
    { id: 'intensity', icon: Dumbbell, label: 'Avg Intensity', value: avgIntensity !== null ? `${avgIntensity}/5` : '--', color: 'text-muted-foreground', change: changes.intensity },
  ];

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
      <div className="min-h-screen pb-24">
        {/* Header */}
        <header className="px-4 py-4 safe-top border-b border-surface-3">
          <h1 className="text-xl font-bold text-foreground">My Stats</h1>
        </header>

        <div className="px-4 py-6 space-y-6">
          {/* Prestige Available Banner */}
          {prestigeEligible && (
            <PrestigeAvailableBanner 
              currentPrestige={prestige} 
              onClick={() => setShowPrestigePrompt(true)} 
            />
          )}

          {/* Prestige/Ranking Card */}
          <div className="card-workout relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-volt/10 to-transparent" />
            <div className="relative">
              <div className="mb-2">
                <XPBar 
                  prestige={prestige}
                  level={currentLevel}
                  totalXP={totalXP}
                  badgeStats={currentStats}
                  earnedBadgeIds={earnedBadgeIds}
                />
              </div>
            </div>
          </div>

          {/* Glove Card */}
          <button
            onClick={() => navigate('/gloves')}
            className="card-workout flex items-center gap-3 w-full text-left"
          >
            <div
              className="w-10 h-10 rounded-lg ring-1 ring-volt/40 shrink-0"
              style={{ backgroundColor: equippedGloveData.tierThemeColor }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">{equippedGloveData.name}</p>
              <p className="text-xs text-muted-foreground">{unlockedGloves.length}/52 Gloves Unlocked</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
          </button>

          {/* Badge Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Badges</h3>
              <span className="text-xs font-bold text-volt">{earnedCount} / {totalBadgeCount}</span>
            </div>
            
            {/* Recently earned */}
            {recentBadges.length > 0 && (
              <div className="card-workout mb-3">
                <p className="text-xs text-muted-foreground mb-2">Recently Earned</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {recentBadges.map(badge => {
                    // Find badge details from all badges
                    const details = badgesByCategory
                      .flatMap(c => c.badges)
                      .find(b => b.id === badge.badge_id);
                    if (!details) return null;
                    const colors = BADGE_CATEGORY_COLORS[details.category];
                    return (
                      <div key={badge.id} className={cn(
                        "flex-shrink-0 px-3 py-2 rounded-lg border",
                        colors.bg, `border-current/10`
                      )}>
                        <p className={cn("text-xs font-bold", colors.text)}>{details.name}</p>
                        <p className="text-[10px] text-muted-foreground">+{details.xpReward} XP</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Category summary */}
            <div className="grid grid-cols-4 gap-2">
              {badgesByCategory.slice(0, 4).map(({ category, badges }) => {
                const earned = badges.filter(b => b.earned).length;
                const colors = BADGE_CATEGORY_COLORS[category];
                return (
                  <div key={category} className={cn("rounded-lg p-2 text-center", colors.bg)}>
                    <p className={cn("text-lg font-black", colors.text)}>{earned}</p>
                    <p className="text-[10px] text-muted-foreground">{BADGE_CATEGORY_NAMES[category]}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Progress Stats */}
          <div>
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Progress</h3>
            <div className="grid grid-cols-3 gap-3">
              {progressStats.map((stat) => (
                <StatCard
                  key={stat.id}
                  icon={stat.icon}
                  label={stat.label}
                  value={stat.value}
                  color={stat.color}
                  change={stat.change}
                  onClick={stat.onClick}
                />
              ))}
            </div>
          </div>

          {/* Training Stats */}
          <div>
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Training</h3>
            <div className="grid grid-cols-2 gap-3">
              {trainingStats.map((stat) => (
                <StatCard
                  key={stat.id}
                  icon={stat.icon}
                  label={stat.label}
                  value={stat.value}
                  color={stat.color}
                  change={stat.change}
                />
              ))}
            </div>
          </div>


          {/* Calendar Heatmap */}
          <WorkoutCalendar workoutDates={workoutDates} />

          {/* Session XP History (Last 20) */}
          <div>
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Recent Sessions</h3>
            {recentSessions.length > 0 ? (
              <div className="space-y-2">
                {recentSessions.map((session) => (
                  <div key={session.id} className="card-workout flex items-center justify-between py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{session.workout_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(parseISO(session.completed_at), 'MMM d, h:mm a')} · {Math.round(session.duration / 60)}m
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Zap className="w-3.5 h-3.5 text-volt" />
                      <span className="text-sm font-black text-volt">+{session.xp_earned.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card-workout text-center py-6">
                <p className="text-muted-foreground text-sm">No sessions yet. Complete a workout to see your history!</p>
              </div>
            )}
          </div>

          {/* Road to BMFK */}
          <RoadToBMF prestige={prestige} level={currentLevel} totalSessions={workoutsCompleted} longestStreak={longestStreak} />

          {/* Ranking Ladder */}
          <div className="card-workout">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Ranking Ladder</h3>
              <span className="text-xs font-bold text-volt uppercase tracking-wide">
                {PRESTIGE_NAMES[prestige]}
              </span>
            </div>
            <div className="space-y-2">
              {RANKING_ORDER.map((rankItem) => {
                const isCurrentRanking = rankItem === ranking;
                const levelRange = getLevelRangeForRanking(rankItem);
                const isAchieved = currentLevel >= levelRange.min;

                return (
                  <div
                    key={rankItem}
                    className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                      isCurrentRanking ? 'bg-volt/20' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          isAchieved ? 'bg-volt' : 'bg-surface-3'
                        }`}
                      />
                      <span
                        className={`font-medium ${
                          isCurrentRanking
                            ? 'text-volt'
                            : isAchieved
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {RANKING_NAMES[rankItem]}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Lvl {levelRange.min}-{levelRange.max}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Stats;