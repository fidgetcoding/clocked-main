import { Flame, Trophy, Clock, Zap, TrendingUp, TrendingDown, Target, Dumbbell, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { XPBar } from '@/components/ui/XPBar';
import { PrestigeDisplay } from '@/components/ui/PrestigeDisplay';
import { useProfile } from '@/hooks/useProfile';
import { useWorkoutStats, WeeklyChange } from '@/hooks/useWorkoutStats';
import { 
  Prestige, 
  RANKING_NAMES, 
  RANKING_ORDER,
  getRankingFromLevel,
  getLevelRangeForRanking,
} from '@/lib/xpSystem';
import { cn } from '@/lib/utils';

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

const Stats = () => {
  const { profile } = useProfile();
  const { stats: workoutStats, history } = useWorkoutStats();
  const navigate = useNavigate();
  // Get prestige data from profile
  const prestige: Prestige = profile?.prestige || 'beginner';
  const currentLevel = profile?.current_level || 1;
  const ranking = getRankingFromLevel(currentLevel);
  const totalXP = profile?.total_xp || 0;
  const historyCount = history?.length || 0;
  const workoutsCompleted = Math.max(profile?.workouts_completed || 0, historyCount);
  const currentStreak = profile?.current_streak || 0;
  const longestStreak = profile?.longest_streak || 0;

  // Use real data from workout history
  const totalHours = workoutStats.totalTrainingHours || 0;
  const totalRounds = workoutStats.totalRounds || 0;
  const avgIntensity = workoutStats.avgIntensity;
  const caloriesBurned = workoutStats.totalCalories || 0;
  const { changes } = workoutStats;

  // Gamification stats (XP, achievements, streaks)
  const progressStats = [
    { id: 'xp', icon: Zap, label: 'Total XP', value: totalXP.toLocaleString(), color: 'text-muted-foreground', change: changes.xp },
    { id: 'workouts', icon: Trophy, label: 'Workouts', value: workoutsCompleted.toString(), color: 'text-muted-foreground', change: changes.workouts, onClick: () => navigate('/history') },
    { id: 'streak', icon: Flame, label: 'Current Streak', value: `${currentStreak} days`, color: 'text-muted-foreground', change: null },
  ];

  // Training stats (time, rounds, effort)
  const trainingStats = [
    { id: 'hours', icon: Clock, label: 'Training Hours', value: `${totalHours}h`, color: 'text-muted-foreground', change: changes.hours },
    { id: 'rounds', icon: Target, label: 'Total Rounds', value: totalRounds.toLocaleString(), color: 'text-muted-foreground', change: changes.rounds },
    { id: 'calories', icon: Activity, label: 'Calories (est.)', value: caloriesBurned.toLocaleString(), color: 'text-muted-foreground', change: changes.calories },
    { id: 'intensity', icon: Dumbbell, label: 'Avg Intensity', value: avgIntensity !== null ? `${avgIntensity}/5` : '--', color: 'text-muted-foreground', change: changes.intensity },
  ];

  return (
    <AppLayout>
      <div className="min-h-screen pb-24">
        {/* Header */}
        <header className="px-4 py-4 safe-top border-b border-surface-3">
          <h1 className="text-xl font-bold text-foreground">My Stats</h1>
        </header>

        <div className="px-4 py-6 space-y-6">
          {/* Prestige/Ranking Card */}
          <div className="card-workout relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-volt/10 to-transparent" />
            <div className="relative">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-volt/20 flex items-center justify-center">
                  <Trophy className="w-8 h-8 text-volt" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Status</p>
                  <PrestigeDisplay 
                    prestige={prestige}
                    ranking={ranking}
                    level={currentLevel}
                    totalXP={totalXP}
                    showProgress={false}
                    size="md"
                  />
                </div>
              </div>
              <XPBar 
                prestige={prestige}
                level={currentLevel}
                totalXP={totalXP}
              />
            </div>
          </div>

          {/* Progress Stats (Gamification) */}
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

          {/* Streak Record */}
          <div className="card-workout">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Longest Streak</p>
                <p className="text-xl font-bold text-foreground">{longestStreak} days</p>
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(7, longestStreak) }).map((_, i) => (
                  <div
                    key={i}
                    className="w-3 h-3 rounded-full bg-volt"
                    style={{ opacity: 0.4 + (i * 0.1) }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Ranking Ladder */}
          <div className="card-workout">
            <h3 className="font-semibold text-foreground mb-4">Ranking Ladder</h3>
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