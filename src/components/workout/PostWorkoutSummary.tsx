import { BadgeArt } from '@/components/ui/GameArt';
import type { PostL100Badge } from '@/data/postL100Badges';
import { MIN_REWARD_SECONDS } from '@/lib/sessionEffort';
import { useState } from 'react';
import type { Badge } from '@/data/badges';
import { BroadcastPage, FitText, LevelBar, Plate, SectionRule, StatRow } from '@/components/broadcast';
import { DifficultyPicker } from '@/components/workout/DifficultyPicker';
import { Textarea } from '@/components/ui/textarea';
import { 
  Prestige, PRESTIGE_NAMES, getRankingFromLevel, RANKING_NAMES, 
  getXPWithinCurrentLevel
} from '@/lib/xpSystem';
import { Button } from '@/components/ui/button';
import { RoundFeedbackPanel } from '@/components/workout/RoundFeedbackPanel';
import { PrestigePrompt, MaxLevelCelebration } from '@/components/workout/PrestigePrompt';
import { RoundFeedback } from '@/types';
import type { PunchSessionReport } from '@/lib/punch/round';

export interface SessionXPBreakdown {
  baseXP: number;
  streakMultiplier: number;
  streakBonus: number;
  effectiveBase: number;
  badgeXP: number;
  sessionTotal: number;
  newBadges: (Badge | PostL100Badge)[];
  levelBefore: number;
  levelAfter: number;
  streakBefore: number;
  streakAfter: number;
  streakBroken: boolean;
  didLevelUp: boolean;
  prestige: Prestige;
  totalXPAfter: number;
  prestigeEligible: boolean;
  isMaxLevel: boolean;
  belowRewardMinimum?: boolean;
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
  punchSummary?: PunchSessionReport | null;
  logged: boolean;
  onNavigateHome: () => void;
  onPrestige: () => void;
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
  onLog, punchSummary, logged, onNavigateHome, onPrestige,
}: PostWorkoutSummaryProps) {
  const [showPrestigePrompt, setShowPrestigePrompt] = useState(false);
  const [showMaxLevel, setShowMaxLevel] = useState(false);

  // Level progress calculations
  const progressAfter = getXPWithinCurrentLevel(result.prestige, result.totalXPAfter);
  const levelProgressPctAfter = Math.min(100, (progressAfter.current / progressAfter.required) * 100);

  const rankingBefore = getRankingFromLevel(result.levelBefore);
  const rankingAfter = getRankingFromLevel(result.levelAfter);
  const didRankUp = rankingBefore !== rankingAfter;

  // Show prestige/max level after logging
  if (showPrestigePrompt) {
    return (
      <PrestigePrompt 
        currentPrestige={result.prestige}
        onPrestige={() => {
          onPrestige();
          setShowPrestigePrompt(false);
        }}
        onDefer={() => setShowPrestigePrompt(false)}
      />
    );
  }

  if (showMaxLevel) {
    return <MaxLevelCelebration onDismiss={() => setShowMaxLevel(false)} />;
  }

  const atMax = result.isMaxLevel || result.levelAfter >= 100;

  const badgeRows = (
    <div className="divide-y divide-surface-2">
      {result.newBadges.map((badge) => (
        <div key={badge.id} className="flex items-center gap-3 py-2">
          <BadgeArt id={badge.id} className="size-14 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="fx truncate text-2xl">{badge.name}</p>
            <p className="text-sm text-muted-foreground">{badge.description}</p>
          </div>
          <span className="fx whitespace-nowrap text-2xl text-volt">+{badge.xpReward.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );

  return (
    <BroadcastPage show="Final" className="pb-6">
      <div className="px-4 pt-3">
        <div role="heading" aria-level={1} className="fx h-16">
          <FitText className="h-full" max={72}>WORKOUT COMPLETE!</FitText>
        </div>
        <p className="lab lab-lime mt-1">{workoutName}</p>
      </div>

      {/* The number: what this session earned, on a plate off the edge */}
      <div className="mt-3 flex items-center gap-5">
        <Plate tone="lime" bleed="left" className="h-28 justify-start pl-4 pr-9 text-[6.5rem]">
          +{result.sessionTotal.toLocaleString()}
        </Plate>
        <div>
          <p className="lab">XP Earned</p>
          <p className="fx mt-1 text-4xl">{formatTimeCompact(totalElapsed)}</p>
          <p className="lab">Duration</p>
        </div>
      </div>

      <section className="mt-4">
        <SectionRule title="XP Breakdown" />
        <StatRow label="Base XP" value={`+${result.baseXP.toLocaleString()}`} />
        {result.streakBonus > 0 && <StatRow label={`Streak Bonus (${result.streakMultiplier}x)`} value={`+${result.streakBonus.toLocaleString()}`} lime />}
        {result.badgeXP > 0 && (
          <StatRow label={`Badge XP (${result.newBadges.length} badge${result.newBadges.length !== 1 ? 's' : ''})`} value={`+${result.badgeXP.toLocaleString()}`} lime />
        )}
        <StatRow label="Total" value={`+${result.sessionTotal.toLocaleString()}`} lime />
      </section>

      {atMax ? (
        <section className="mt-4 px-4">
          <SectionRule title="Max Level" right={`${PRESTIGE_NAMES[result.prestige]} L100`} className="-mx-4" />
          <p className="mt-2 text-base">
            {result.prestigeEligible ? 'Prestige available. Advance to the next tier.' : 'All XP goes toward earning badges.'}
          </p>
          {result.prestigeEligible && (
            <Button className="mt-3 w-full" onClick={() => setShowPrestigePrompt(true)}>
              Prestige Ready
            </Button>
          )}
          {result.newBadges.length > 0 ? (
            <div className="mt-3">
              <p className="lab lab-w">
                {result.newBadges.length} Badge{result.newBadges.length !== 1 ? 's' : ''} Earned This Session
              </p>
              {badgeRows}
            </div>
          ) : (
            <p className="mt-3 text-base text-muted-foreground">No new badges this session.</p>
          )}
        </section>
      ) : (
        <section className="mt-4 px-4">
          <SectionRule title="Level Progress" right={`${PRESTIGE_NAMES[result.prestige]} L${result.levelAfter}`} className="-mx-4" />
          {result.didLevelUp && (
            <div className="mt-2">
              <p className="fx text-3xl text-volt">LEVEL UP!</p>
              <p className="text-base">
                Level {result.levelBefore} to {result.levelAfter}
                {didRankUp && `. New Rank: ${RANKING_NAMES[rankingAfter]}`}
              </p>
            </div>
          )}
          <LevelBar level={result.levelAfter} percent={levelProgressPctAfter} className="mt-3" />
          <p className="lab mt-1 text-right">
            {Math.floor(progressAfter.current).toLocaleString()} / {progressAfter.required.toLocaleString()} XP
          </p>
        </section>
      )}

      {result.newBadges.length > 0 && !atMax && (
        <section className="mt-4 px-4">
          <div className="-mx-4 border-b border-surface-3 px-4 pb-1">
            <h3 className="fx text-2xl">Badges Earned ({result.newBadges.length})</h3>
          </div>
          {badgeRows}
        </section>
      )}

      <section className="mt-4 px-4">
        <SectionRule title="Streak" className="-mx-4" />
        {result.streakBroken ? (
          <div className="mt-2">
            <p className="fx text-3xl">Streak reset from {result.streakBefore} days to 0</p>
            <p className="text-base text-muted-foreground">Lost {result.streakMultiplier > 1 ? `${result.streakMultiplier}x` : '1.0x'} multiplier</p>
          </div>
        ) : (
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <p className="fx text-4xl">
              {result.streakAfter} day{result.streakAfter !== 1 ? 's' : ''}
            </p>
            <span className="lab">{result.streakMultiplier > 1 ? `${result.streakMultiplier}x XP` : 'No bonus yet'}</span>
          </div>
        )}
        {result.belowRewardMinimum && (
          <p className="mt-2 text-base text-muted-foreground">
            Train for at least {MIN_REWARD_SECONDS / 60} minutes to earn badges and keep your streak going.
          </p>
        )}
      </section>

      {!!punchSummary?.total && (
        <section className="mt-4 bg-surface-1 px-4 py-3" data-testid="workout-punches">
          <p className="fx text-5xl text-volt">{punchSummary.total}</p>
          <p className="lab lab-w mt-1">{punchSummary.total === 1 ? 'Punch' : 'Punches'} seen, {punchSummary.cleanPercent}% clean</p>
          {punchSummary.topFix && <p className="mt-1 text-base">{punchSummary.topFix.advice}</p>}
        </section>
      )}

      <div className="mt-5 space-y-4 px-4">
        {!logged ? (
          <>
            {roundCount > 0 && (
              <div className="flex gap-3">
                <Button size="sm" variant={feedbackMode === 'basic' ? 'white' : 'secondary'} className="flex-1" onClick={() => setFeedbackMode('basic')}>
                  Basic
                </Button>
                <Button size="sm" variant={feedbackMode === 'advanced' ? 'white' : 'secondary'} className="flex-1" onClick={() => setFeedbackMode('advanced')}>
                  Advanced
                </Button>
              </div>
            )}
            <div>
              <label htmlFor="session-notes" className="fx mb-2 block text-3xl">How did it go?</label>
              <Textarea
                id="session-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about your workout..."
                className="h-24 resize-none"
              />
            </div>
            <DifficultyPicker value={difficultyRating} onChange={setDifficultyRating} />
            {feedbackMode === 'advanced' && roundCount > 0 && (
              <RoundFeedbackPanel roundCount={roundCount} roundFeedback={roundFeedback} onRoundRating={onRoundRating} />
            )}
            <Button size="lg" onClick={onLog} className="w-full">Log Workout</Button>
          </>
        ) : (
          <>
            <p className="fx text-center text-3xl text-volt">Workout Logged!</p>
            {result.prestigeEligible && (
              <Button variant="white" className="w-full" onClick={() => setShowPrestigePrompt(true)}>
                Prestige Available, View
              </Button>
            )}
            {result.isMaxLevel && (
              <Button variant="gold" className="w-full" onClick={() => setShowMaxLevel(true)}>
                Max Level Reached, View
              </Button>
            )}
          </>
        )}
        <Button variant="secondary" onClick={onNavigateHome} className="w-full">
          Back to Home
        </Button>
      </div>
    </BroadcastPage>
  );
}
