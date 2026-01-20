import { useState } from 'react';
import { Flame, Trophy, Clock, Zap, ChevronRight, TrendingUp, TrendingDown, X, Target, Dumbbell, Heart, Activity } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { XPBar } from '@/components/ui/XPBar';
import { useUserStore } from '@/stores/userStore';
import { RANK_NAMES, RANK_THRESHOLDS, Rank } from '@/types';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Area, AreaChart } from 'recharts';

function getCurrentRank(xp: number): Rank {
  const ranks = Object.entries(RANK_THRESHOLDS).reverse() as [Rank, number][];
  for (const [rank, threshold] of ranks) {
    if (xp >= threshold) return rank;
  }
  return 'regional';
}

// Mock historical data generator
function generateMockData(days: number, baseValue: number, variance: number = 0.2) {
  return Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    date: new Date(Date.now() - (days - i - 1) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: Math.max(0, baseValue + (Math.random() - 0.5) * baseValue * variance * 2 + (i * baseValue * 0.02)),
  }));
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
  change?: { value: number; period: string };
  onClick: () => void;
}

function StatCard({ icon: Icon, label, value, color, change, onClick }: StatCardProps) {
  return (
    <button onClick={onClick} className="card-workout text-left w-full group">
      <div className="flex items-start justify-between">
        <Icon className={`w-5 h-5 ${color} mb-2`} />
        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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
    </button>
  );
}

interface StatDetailModalProps {
  stat: {
    label: string;
    value: string;
    color: string;
    icon: React.ComponentType<{ className?: string }>;
    data: { day: number; date: string; value: number }[];
  } | null;
  onClose: () => void;
  timeframe: '1W' | '1M' | '1Y';
  onTimeframeChange: (tf: '1W' | '1M' | '1Y') => void;
}

function StatDetailModal({ stat, onClose, timeframe, onTimeframeChange }: StatDetailModalProps) {
  if (!stat) return null;

  const Icon = stat.icon;
  const data = stat.data.slice(timeframe === '1W' ? -7 : timeframe === '1M' ? -30 : -365);
  
  // Calculate change percentage
  const firstValue = data[0]?.value || 0;
  const lastValue = data[data.length - 1]?.value || 0;
  const changePercent = firstValue > 0 ? Math.round(((lastValue - firstValue) / firstValue) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-background/95 z-50 flex flex-col">
      <header className="flex items-center justify-between px-4 py-4 border-b border-surface-3">
        <button onClick={onClose} className="text-muted-foreground">
          <X className="w-6 h-6" />
        </button>
        <h2 className="font-bold text-foreground">{stat.label}</h2>
        <div className="w-6" />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {/* Current Value */}
        <div className="text-center mb-6">
          <Icon className={`w-8 h-8 ${stat.color} mx-auto mb-2`} />
          <p className="text-4xl font-black text-foreground">{stat.value}</p>
          <div className={cn(
            'flex items-center justify-center gap-1 mt-2 text-sm font-medium',
            changePercent >= 0 ? 'text-volt' : 'text-alert-red'
          )}>
            {changePercent >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span>{changePercent >= 0 ? '+' : ''}{changePercent}% this {timeframe === '1W' ? 'week' : timeframe === '1M' ? 'month' : 'year'}</span>
          </div>
        </div>

        {/* Timeframe Toggle */}
        <div className="flex gap-2 mb-6">
          {(['1W', '1M', '1Y'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              className={cn(
                'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                timeframe === tf
                  ? 'bg-volt text-primary-foreground'
                  : 'bg-surface-1 text-muted-foreground'
              )}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="h-64 bg-surface-1 rounded-xl p-4 border border-surface-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--electric-volt))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--electric-volt))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--text-secondary))', fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--text-secondary))', fontSize: 10 }}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--surface-1))',
                  border: '1px solid hsl(var(--surface-3))',
                  borderRadius: '8px',
                  color: 'hsl(var(--text-primary))',
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--electric-volt))"
                strokeWidth={2}
                fill="url(#colorValue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <div className="bg-surface-1 rounded-lg p-3 text-center border border-surface-3">
            <p className="text-xs text-muted-foreground">Min</p>
            <p className="font-bold text-foreground">{Math.round(Math.min(...data.map(d => d.value)))}</p>
          </div>
          <div className="bg-surface-1 rounded-lg p-3 text-center border border-surface-3">
            <p className="text-xs text-muted-foreground">Avg</p>
            <p className="font-bold text-foreground">{Math.round(data.reduce((a, b) => a + b.value, 0) / data.length)}</p>
          </div>
          <div className="bg-surface-1 rounded-lg p-3 text-center border border-surface-3">
            <p className="text-xs text-muted-foreground">Max</p>
            <p className="font-bold text-foreground">{Math.round(Math.max(...data.map(d => d.value)))}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const Stats = () => {
  const user = useUserStore((state) => state.user);
  const [selectedStat, setSelectedStat] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<'1W' | '1M' | '1Y'>('1M');

  const totalXP = user?.totalXP || 1247;
  const currentRank = getCurrentRank(totalXP);
  const workoutsCompleted = user?.workoutsCompleted || 24;
  const currentStreak = user?.currentStreak || 3;
  const longestStreak = user?.longestStreak || 14;

  // Calculate total time (mock data)
  const totalMinutes = workoutsCompleted * 35;
  const totalHours = Math.floor(totalMinutes / 60);

  // Mock fitness stats
  const avgHeartRate = 142;
  const caloriesBurned = workoutsCompleted * 320;
  const punchesThrown = workoutsCompleted * 450;
  const avgIntensity = 7.2;

  // Generate mock historical data
  const statsData = {
    xp: { data: generateMockData(365, totalXP, 0.1), change: { value: 12, period: 'this week' } },
    workouts: { data: generateMockData(365, workoutsCompleted, 0.3), change: { value: 8, period: 'this week' } },
    hours: { data: generateMockData(365, totalHours, 0.25), change: { value: 15, period: 'this week' } },
    streak: { data: generateMockData(365, currentStreak, 0.5), change: { value: -5, period: 'this week' } },
    heartRate: { data: generateMockData(365, avgHeartRate, 0.1), change: { value: 3, period: 'this week' } },
    calories: { data: generateMockData(365, caloriesBurned, 0.2), change: { value: 18, period: 'this week' } },
    punches: { data: generateMockData(365, punchesThrown, 0.3), change: { value: 22, period: 'this week' } },
    intensity: { data: generateMockData(365, avgIntensity * 10, 0.15).map(d => ({ ...d, value: d.value / 10 })), change: { value: 5, period: 'this week' } },
  };

  const stats = [
    { id: 'xp', icon: Zap, label: 'Total XP', value: totalXP.toLocaleString(), color: 'text-muted-foreground', ...statsData.xp },
    { id: 'workouts', icon: Trophy, label: 'Workouts', value: workoutsCompleted.toString(), color: 'text-muted-foreground', ...statsData.workouts },
    { id: 'hours', icon: Clock, label: 'Training Hours', value: `${totalHours}h`, color: 'text-muted-foreground', ...statsData.hours },
    { id: 'streak', icon: Flame, label: 'Current Streak', value: `${currentStreak} days`, color: 'text-muted-foreground', ...statsData.streak },
  ];

  const fitnessStats = [
    { id: 'heartRate', icon: Heart, label: 'Avg Heart Rate', value: `${avgHeartRate} BPM`, color: 'text-muted-foreground', ...statsData.heartRate },
    { id: 'calories', icon: Activity, label: 'Calories Burned', value: caloriesBurned.toLocaleString(), color: 'text-muted-foreground', ...statsData.calories },
    { id: 'punches', icon: Target, label: 'Punches Thrown', value: punchesThrown.toLocaleString(), color: 'text-muted-foreground', ...statsData.punches },
    { id: 'intensity', icon: Dumbbell, label: 'Avg Intensity', value: `${avgIntensity}/10`, color: 'text-muted-foreground', ...statsData.intensity },
  ];

  const allStats = [...stats, ...fitnessStats];
  const selectedStatData = selectedStat ? allStats.find(s => s.id === selectedStat) : null;

  return (
    <AppLayout>
      <div className="min-h-screen pb-24">
        {/* Header */}
        <header className="px-4 py-4 safe-top border-b border-surface-3">
          <h1 className="text-xl font-bold text-foreground">My Stats</h1>
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

          {/* XP Stats */}
          <div>
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">XP & Progress</h3>
            <div className="grid grid-cols-2 gap-3">
              {stats.map((stat) => (
                <StatCard
                  key={stat.id}
                  icon={stat.icon}
                  label={stat.label}
                  value={stat.value}
                  color={stat.color}
                  change={stat.change}
                  onClick={() => setSelectedStat(stat.id)}
                />
              ))}
            </div>
          </div>

          {/* Fitness Stats */}
          <div>
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Fitness Stats</h3>
            <div className="grid grid-cols-2 gap-3">
              {fitnessStats.map((stat) => (
                <StatCard
                  key={stat.id}
                  icon={stat.icon}
                  label={stat.label}
                  value={stat.value}
                  color={stat.color}
                  change={stat.change}
                  onClick={() => setSelectedStat(stat.id)}
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

      {/* Stat Detail Modal */}
      {selectedStatData && (
        <StatDetailModal
          stat={selectedStatData}
          onClose={() => setSelectedStat(null)}
          timeframe={timeframe}
          onTimeframeChange={setTimeframe}
        />
      )}
    </AppLayout>
  );
};

export default Stats;
