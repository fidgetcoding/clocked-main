import { ArrowLeft, Flame, Trophy, Clock, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { XPBar } from '@/components/ui/XPBar';
import { useUserStore } from '@/stores/userStore';
import { RANK_NAMES, RANK_THRESHOLDS, Rank } from '@/types';

function getCurrentRank(xp: number): Rank {
  const ranks = Object.entries(RANK_THRESHOLDS).reverse() as [Rank, number][];
  for (const [rank, threshold] of ranks) {
    if (xp >= threshold) return rank;
  }
  return 'regional';
}

const Stats = () => {
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);

  const totalXP = user?.totalXP || 1247;
  const currentRank = getCurrentRank(totalXP);
  const workoutsCompleted = user?.workoutsCompleted || 24;
  const currentStreak = user?.currentStreak || 3;
  const longestStreak = user?.longestStreak || 14;

  // Calculate total time (mock data)
  const totalMinutes = workoutsCompleted * 35; // avg 35 min per workout
  const totalHours = Math.floor(totalMinutes / 60);

  const stats = [
    {
      icon: Zap,
      label: 'Total XP',
      value: totalXP.toLocaleString(),
      color: 'text-volt',
    },
    {
      icon: Trophy,
      label: 'Workouts',
      value: workoutsCompleted.toString(),
      color: 'text-yellow-500',
    },
    {
      icon: Clock,
      label: 'Training Hours',
      value: `${totalHours}h`,
      color: 'text-blue-400',
    },
    {
      icon: Flame,
      label: 'Current Streak',
      value: `${currentStreak} days`,
      color: 'text-orange-500',
    },
  ];

  return (
    <AppLayout>
      <div className="min-h-screen">
        {/* Header */}
        <header className="px-4 py-4 safe-top border-b border-surface-3">
          <h1 className="text-xl font-bold text-foreground">Your Stats</h1>
        </header>

        <div className="px-4 py-6 space-y-6">
          {/* Rank Card */}
          <div className="card-workout relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-volt/10 to-transparent" />
            <div className="relative">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-volt/20 flex items-center justify-center">
                  <Trophy className="w-8 h-8 text-volt" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Rank</p>
                  <h2 className="text-2xl font-black text-volt uppercase tracking-wide">
                    {RANK_NAMES[currentRank]}
                  </h2>
                </div>
              </div>
              <XPBar currentXP={totalXP} />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="card-workout">
                  <Icon className={`w-5 h-5 ${stat.color} mb-2`} />
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              );
            })}
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

          {/* Rank Ladder */}
          <div className="card-workout">
            <h3 className="font-semibold text-foreground mb-4">Rank Ladder</h3>
            <div className="space-y-2">
              {(Object.entries(RANK_THRESHOLDS) as [Rank, number][])
                .slice(0, 6)
                .map(([rank, threshold]) => {
                  const isCurrentRank = rank === currentRank;
                  const isAchieved = totalXP >= threshold;

                  return (
                    <div
                      key={rank}
                      className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                        isCurrentRank ? 'bg-volt/20' : ''
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
                            isCurrentRank
                              ? 'text-volt'
                              : isAchieved
                              ? 'text-foreground'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {RANK_NAMES[rank]}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {threshold.toLocaleString()} XP
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
