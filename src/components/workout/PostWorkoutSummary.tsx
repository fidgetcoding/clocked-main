import { useState, useEffect } from 'react';
import { Badge, BADGE_CATEGORY_COLORS, BADGE_CATEGORY_NAMES, BadgeCategory } from '@/data/badges';
import { 
  Prestige, PRESTIGE_NAMES, getRankingFromLevel, RANKING_NAMES, 
  getXPWithinCurrentLevel, getLevelFromXP 
} from '@/lib/xpSystem';
import { Button } from '@/components/ui/button';
import { RoundFeedbackPanel } from '@/components/workout/RoundFeedbackPanel';
import { RoundFeedback } from '@/types';
import { cn } from '@/lib/utils';
import { Zap, Trophy, Flame, Star, Award, TrendingUp } from 'lucide-react';

// Badge shape components
function BadgeShape({ shape, category, earned, size = 'md' }: { 
  shape: string; category: BadgeCategory; earned: boolean; size?: 'sm' | 'md' 
}) {
  const colors = BADGE_CATEGORY_COLORS[category];
  const dim = size === 'sm' ? 'w-10 h-10' : 'w-14 h-14';
  
  if (!earned) {
    return (
      <div className={cn(dim, 'rounded-full bg-surface-2 border border-surface-3 flex items-center justify-center opacity-40')}>
        <Award className="w-5 h-5 text-muted-foreground" />
      </div>
    );
  }
  
  const baseClasses = cn(dim, 'flex items-center justify-center', colors.bg, colors.text);
  
  switch (shape) {
    case 'hexagon':
      return <div className={cn(baseClasses, 'rounded-lg rotate-0 border-2 border-current/20 shadow-lg', colors.glow)}><Star className="w-5 h-5" /></div>;
    case 'shield':
      return <div className={cn(baseClasses, 'rounded-t-full rounded-b-lg border-2 border-current/20 shadow-lg', colors.glow)}><Award className="w-5 h-5" /></div>;
    case 'star':
      return <div className={cn(baseClasses, 'rounded-full border-2 border-current/20 shadow-lg', colors.glow)}><Star className="w-5 h-5 fill-current" /></div>;
    case 'diamond':
      return <div className={cn(baseClasses, 'rounded-lg rotate-45 border-2 border-current/20 shadow-lg', colors.glow)}><Trophy className="w-4 h-4 -rotate-45" /></div>;
    default: // circle
      return <div className={cn(baseClasses, 'rounded-full border-2 border-current/20 shadow-lg', colors.glow)}><Zap className="w-5 h-5" /></div>;
  }
}

export interface SessionXPBreakdown {
  baseXP: number;
  streakMultiplier: number;
  streakBonus: number;
  effectiveBase: number;
  badgeXP: number;
  sessionTotal: number;
  newBadges: Badge[];
  levelBefore: number;
  levelAfter: number;
  streakBefore: number;
  streakAfter: number;
  streakBroken: boolean;
  didLevelUp: boolean;
  prestige: Prestige;
  totalXPAfter: number;
}

interface PostWorkoutSummaryProps {
  result: SessionXPBreakdown;
  workoutName: string;
  totalElapsed: number;
  notes: string;
  setNotes: (v: string) => void;
  difficultyRating: 'too_easy' | 'just_right' | 'too_hard' | null;
  setDifficultyRating: (v: 'too_easy' | 'just_right' | 'too_hard' | null) => void;
  feedbackMode: 'basic' | 'advanced';
  setFeedbackMode: (v: 'basic' | 'advanced') => void;
  roundFeedback: RoundFeedback[];
  roundCount: number;
  onRoundRating: (round: number, rating: number) => void;
  onLog: () => void;
  logged: boolean;
  onNavigateHome: () => void;
}

function formatTimeCompact(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function PostWorkoutSummary({
  result, workoutName, totalElapsed,
  notes, setNotes, difficultyRating, setDifficultyRating,
  feedbackMode, setFeedbackMode, roundFeedback, roundCount, onRoundRating,
  onLog, logged, onNavigateHome,
}: PostWorkoutSummaryProps) {
  const [showBadgeDetails, setShowBadgeDetails] = useState<Badge | null>(null);
  const [animateXP, setAnimateXP] = useState(false);
  const [animateLevel, setAnimateLevel] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setAnimateXP(true), 300);
    const t2 = setTimeout(() => setAnimateLevel(true), 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Level progress calculations
  const xpBefore = result.totalXPAfter - result.sessionTotal;
  const progressBefore = getXPWithinCurrentLevel(result.prestige, xpBefore);
  const progressAfter = getXPWithinCurrentLevel(result.prestige, result.totalXPAfter);
  const levelProgressPctBefore = Math.min(100, (progressBefore.current / progressBefore.required) * 100);
  const levelProgressPctAfter = Math.min(100, (progressAfter.current / progressAfter.required) * 100);

  const rankingBefore = getRankingFromLevel(result.levelBefore);
  const rankingAfter = getRankingFromLevel(result.levelAfter);
  const didRankUp = rankingBefore !== rankingAfter;

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8 bg-background safe-top safe-bottom">
      {/* Header */}
      <div className="text-6xl mb-4">🏆</div>
      <h1 className="text-3xl font-black text-foreground mb-1">WORKOUT COMPLETE!</h1>
      <p className="text-muted-foreground mb-6">{workoutName}</p>

      {/* Duration + Total XP cards */}
      <div className="grid grid-cols-2 gap-3 mb-6 w-full max-w-sm">
        <div className="card-workout text-center">
          <p className="text-2xl font-bold text-volt">{formatTimeCompact(totalElapsed)}</p>
          <p className="text-xs text-muted-foreground">Duration</p>
        </div>
        <div className="card-workout text-center">
          <p className={cn("text-2xl font-bold text-volt transition-all duration-700", animateXP && "scale-110")}>
            +{result.sessionTotal.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">XP Earned</p>
        </div>
      </div>

      {/* XP Breakdown */}
      <div className="w-full max-w-sm card-workout mb-4">
        <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-bold">XP Breakdown</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Base XP</span>
            <span className="font-bold text-foreground">+{result.baseXP.toLocaleString()}</span>
          </div>
          {result.streakBonus > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                Streak Bonus ({result.streakMultiplier}x)
              </span>
              <span className="font-bold text-orange-400">+{result.streakBonus.toLocaleString()}</span>
            </div>
          )}
          {result.badgeXP > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                Badge XP ({result.newBadges.length} badge{result.newBadges.length !== 1 ? 's' : ''})
              </span>
              <span className="font-bold text-amber-400">+{result.badgeXP.toLocaleString()}</span>
            </div>
          )}
          <div className="border-t border-surface-3 pt-2 flex justify-between">
            <span className="font-bold text-foreground">Total</span>
            <span className="font-black text-volt text-lg">+{result.sessionTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Level Progress */}
      <div className="w-full max-w-sm card-workout mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Level Progress</h3>
          <span className="text-xs font-bold text-foreground">
            {PRESTIGE_NAMES[result.prestige]} L{result.levelAfter}
          </span>
        </div>
        
        {/* Level up celebration */}
        {result.didLevelUp && (
          <div className={cn(
            "mb-3 p-3 rounded-xl bg-volt/10 border border-volt/30 text-center transition-all duration-500",
            animateLevel ? "opacity-100 scale-100" : "opacity-0 scale-95"
          )}>
            <div className="flex items-center justify-center gap-2 mb-1">
              <TrendingUp className="w-5 h-5 text-volt" />
              <span className="text-lg font-black text-volt">LEVEL UP!</span>
              <TrendingUp className="w-5 h-5 text-volt" />
            </div>
            <p className="text-sm text-foreground">
              Level {result.levelBefore} → <span className="font-black text-volt">{result.levelAfter}</span>
            </p>
            {didRankUp && (
              <p className="text-xs text-volt mt-1 font-bold">
                New Rank: {RANKING_NAMES[rankingAfter]}!
              </p>
            )}
          </div>
        )}

        {/* XP Bar */}
        <div className="mb-1">
          <div className="h-3 bg-surface-2 rounded-full overflow-hidden relative">
            {/* Before bar (faded) */}
            <div 
              className="absolute inset-y-0 left-0 bg-volt/30 rounded-full transition-all duration-300"
              style={{ width: `${result.didLevelUp ? 100 : levelProgressPctBefore}%` }}
            />
            {/* After bar (bright) */}
            <div 
              className={cn(
                "absolute inset-y-0 left-0 bg-volt rounded-full transition-all duration-1000",
                animateLevel ? "opacity-100" : "opacity-0"
              )}
              style={{ width: `${levelProgressPctAfter}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>L{result.levelAfter}</span>
            <span>{Math.floor(progressAfter.current).toLocaleString()} / {progressAfter.required.toLocaleString()} XP</span>
          </div>
        </div>
      </div>

      {/* Badges Earned */}
      {result.newBadges.length > 0 && (
        <div className="w-full max-w-sm card-workout mb-4">
          <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-bold">
            Badges Earned ({result.newBadges.length})
          </h3>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {result.newBadges.map(badge => {
              const colors = BADGE_CATEGORY_COLORS[badge.category];
              return (
                <div 
                  key={badge.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-surface-2/50 border border-surface-3"
                  onClick={() => setShowBadgeDetails(showBadgeDetails?.id === badge.id ? null : badge)}
                >
                  <BadgeShape shape={badge.shape} category={badge.category} earned size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-bold truncate", colors.text)}>{badge.name}</p>
                    <p className="text-[10px] text-muted-foreground">{badge.description}</p>
                  </div>
                  <span className="text-xs font-bold text-amber-400 whitespace-nowrap">+{badge.xpReward.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Streak Update */}
      <div className="w-full max-w-sm card-workout mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Flame className="w-4 h-4 text-orange-400" />
          <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Streak</h3>
        </div>
        {result.streakBroken ? (
          <div>
            <p className="text-sm text-alert-red font-bold">
              Streak reset from {result.streakBefore} days to 0
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Lost {result.streakMultiplier > 1 ? `${result.streakMultiplier}x` : '1.0x'} multiplier
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-foreground font-bold">
              🔥 {result.streakAfter} day{result.streakAfter !== 1 ? 's' : ''}
            </p>
            <span className="text-xs font-bold text-orange-400">
              {result.streakMultiplier > 1 ? `${result.streakMultiplier}x XP` : 'No bonus yet'}
            </span>
          </div>
        )}
      </div>

      {/* Journal */}
      {!logged ? (
        <div className="w-full max-w-sm space-y-4 mb-6">
          {roundCount > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => setFeedbackMode('basic')}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                  feedbackMode === 'basic' ? 'bg-volt text-primary-foreground' : 'bg-surface-1 text-muted-foreground'
                )}
              >Basic</button>
              <button
                onClick={() => setFeedbackMode('advanced')}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                  feedbackMode === 'advanced' ? 'bg-volt text-primary-foreground' : 'bg-surface-1 text-muted-foreground'
                )}
              >Advanced</button>
            </div>
          )}
          
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">How did it go?</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about your workout..."
              className="w-full h-24 p-3 rounded-xl bg-surface-1 border border-surface-3 text-foreground placeholder:text-muted-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-volt"
            />
          </div>
          
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Difficulty</label>
            <div className="flex gap-2">
              {[
                { value: 'too_easy', label: 'Too Easy' },
                { value: 'just_right', label: 'Just Right' },
                { value: 'too_hard', label: 'Too Hard' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDifficultyRating(opt.value as typeof difficultyRating)}
                  className={cn(
                    'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors',
                    difficultyRating === opt.value
                      ? 'bg-volt text-primary-foreground'
                      : 'bg-surface-1 border border-surface-3 text-muted-foreground hover:bg-surface-2'
                  )}
                >{opt.label}</button>
              ))}
            </div>
          </div>
          
          {feedbackMode === 'advanced' && roundCount > 0 && (
            <RoundFeedbackPanel
              roundCount={roundCount}
              roundFeedback={roundFeedback}
              onRoundRating={onRoundRating}
            />
          )}
          
          <Button onClick={onLog} className="btn-primary-glow w-full">
            Log Workout
          </Button>
        </div>
      ) : (
        <div className="w-full max-w-sm mb-6">
          <div className="card-workout text-center">
            <p className="text-volt font-semibold">Workout Logged! ✅</p>
          </div>
        </div>
      )}

      <Button onClick={onNavigateHome} variant="outline" className="w-full max-w-sm bg-surface-1 border-surface-3">
        Back to Home
      </Button>
    </div>
  );
}
