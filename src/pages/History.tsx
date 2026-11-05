import { PunchLogDetails } from '@/components/punch/PunchLogView';
import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { BroadcastPage, EmptyPlate, FitText, OnAir, Plate } from '@/components/broadcast';
import { Button } from '@/components/ui/button';
import { useWorkoutHistory, useWorkoutPunchLog, type WorkoutHistoryEntry } from '@/hooks/useWorkoutHistory';
import { useProfile } from '@/hooks/useProfile';
import { AddWorkoutModal } from '@/components/AddWorkoutModal';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  generateCoachRecommendation,
  recommendationToPrompt,
  CoachRecommendation,
  ProfileData,
} from '@/lib/coachEngine';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

function OpenedPunchLog({ workout }: { workout: WorkoutHistoryEntry }) {
  const log = useWorkoutPunchLog(workout);
  if (!log) return null;
  return (
    <div className="mt-3">
      <p className="lab">Punch Log</p>
      <PunchLogDetails log={log} className="mt-1 bg-surface-2 p-3" />
    </div>
  );
}

const History = () => {
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCoach, setShowCoach] = useState(false);
  const [recommendation, setRecommendation] = useState<CoachRecommendation | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { history: completedWorkouts, isLoading } = useWorkoutHistory();
  const { profile } = useProfile();

  const handleCoach = () => {
    if (completedWorkouts.length === 0 && !profile) {
      toast.error('Complete some workouts first to get Coach recommendations');
      return;
    }

    setShowCoach(true);
    setIsGenerating(true);

    // Small timeout for UX (show spinner briefly)
    setTimeout(() => {
      const profileData: ProfileData = {
        prestige: profile?.prestige || null,
        current_level: profile?.current_level || null,
        current_streak: profile?.current_streak || 0,
        longest_streak: profile?.longest_streak || 0,
        workouts_completed: profile?.workouts_completed || 0,
        total_training_seconds: profile?.total_training_seconds || null,
        experience_level: profile?.experience_level || 'beginner',
        equipment: profile?.equipment as Record<string, boolean | string> || null,
        goals: profile?.goals || [],
        last_workout_date: profile?.last_workout_date || null,
        comeback_count: profile?.comeback_count || 0,
        double_days: profile?.double_days || 0,
        morning_workouts: profile?.morning_workouts || 0,
        night_workouts: profile?.night_workouts || 0,
        weekend_workouts: profile?.weekend_workouts || 0,
        weekday_workouts: profile?.weekday_workouts || 0,
        punch_1_count: profile?.punch_1_count || 0,
        punch_2_count: profile?.punch_2_count || 0,
        punch_3_count: profile?.punch_3_count || 0,
        punch_4_count: profile?.punch_4_count || 0,
        punch_5_count: profile?.punch_5_count || 0,
        punch_6_count: profile?.punch_6_count || 0,
        punch_7_count: profile?.punch_7_count || 0,
        punch_8_count: profile?.punch_8_count || 0,
        slips_count: profile?.slips_count || 0,
        rolls_count: profile?.rolls_count || 0,
        pullbacks_count: profile?.pullbacks_count || 0,
        circles_count: profile?.circles_count || 0,
      };

      const rec = generateCoachRecommendation(completedWorkouts, profileData);
      setRecommendation(rec);
      setIsGenerating(false);
    }, 600);
  };

  const handleGenerateWorkout = () => {
    if (!recommendation) return;
    const prompt = recommendationToPrompt(recommendation);
    toast.success('Generating your Coach workout...');
    // In the navigation state, not the URL: only a tap inside the app may start a generation
    navigate('/build', { state: { coachPrompt: prompt } });
  };

  return (
    <AppLayout>
      <BroadcastPage show="History">
        <h1 className="px-4 pt-3">
          <FitText className="fx h-[clamp(3rem,15vw,5rem)]" max={80}>WORKOUT LOG</FitText>
        </h1>

        {/* Action buttons */}
        <div className="flex gap-4 px-5 py-3">
          <Button onClick={handleCoach} variant="steel" size="sm" className="flex-1">AI Coach</Button>
          <Button onClick={() => setShowAddModal(true)} size="sm" className="flex-1">Log Workout</Button>
        </div>

        {/* Workout List */}
        {completedWorkouts.length === 0 ? (
          <EmptyPlate title="No History Yet" body="Complete a workout or log one manually to get started">
            <Button onClick={() => setShowAddModal(true)}>Log a Workout</Button>
          </EmptyPlate>
        ) : (
          completedWorkouts.map((workout) => {
            const isExpanded = expandedId === workout.id;
            return (
              <div key={workout.id} className={cn(isExpanded && 'border-t-2 border-volt bg-surface-1')}>
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : workout.id)}
                  aria-expanded={isExpanded}
                  className={cn(
                    'grid min-h-14 w-full grid-cols-[1fr_auto] items-baseline gap-3 border-b border-surface-2 px-4 py-2 text-left transition-colors hover:bg-surface-1',
                    isExpanded && 'border-transparent',
                  )}
                >
                  <span className="min-w-0">
                    <span className={cn('fx block [overflow-wrap:anywhere]', isExpanded ? 'text-[2.625rem]' : 'text-3xl')}>{workout.workout_name}</span>
                    <span className="lab mt-0.5 block">
                      {formatDistanceToNow(new Date(workout.completed_at), { addSuffix: true })}, {formatDuration(workout.duration)}
                    </span>
                  </span>
                  <b className={cn('fx whitespace-nowrap text-volt', isExpanded ? 'text-4xl' : 'text-[1.75rem]')}>+{workout.xp_earned} XP</b>
                </button>

                {isExpanded && (
                  <div className="border-b border-surface-2 px-4 pb-3">
                    {workout.difficulty && (
                      <div className="flex items-center gap-3 pb-2">
                        <span className="lab">Difficulty</span>
                        <Plate tone={workout.difficulty === 'just_right' ? 'lime' : workout.difficulty === 'too_hard' ? 'white' : 'steel'} className="h-7 px-3 text-lg">
                          {workout.difficulty === 'too_easy' && 'Too Easy'}
                          {workout.difficulty === 'just_right' && 'Just Right'}
                          {workout.difficulty === 'too_hard' && 'Too Hard'}
                        </Plate>
                      </div>
                    )}

                    {workout.round_feedback && workout.round_feedback.length > 0 && (
                      <div className="pt-1">
                        <p className="lab lab-w">Round Ratings</p>
                        <div className="mt-1 grid auto-cols-fr grid-flow-col items-end gap-1 px-1.5">
                          {workout.round_feedback.map((rf) => (
                            <div key={rf.roundNumber} className="flex min-w-0 flex-col items-center justify-end">
                              <span className="fx text-lg">{rf.rating}<span className="sr-only">/5</span></span>
                              <i className="block w-full -skew-x-[14deg] bg-volt" style={{ height: `${rf.rating * 0.75}rem` }} />
                              <span className="lab mt-1 tracking-normal">R{rf.roundNumber}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <OpenedPunchLog workout={workout} />

                    {workout.notes && (
                      <div className="pt-3">
                        <p className="lab">Journal</p>
                        <p className="prose-w mt-0.5 text-lg">{workout.notes}</p>
                      </div>
                    )}

                    <p className="lab pt-3">
                      {format(new Date(workout.completed_at), 'EEEE, MMMM d, yyyy, h:mm a')}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </BroadcastPage>

      <AddWorkoutModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />

      {/* AI Coach: the analyst's desk */}
      {showCoach && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="AI Coach">
          <div className="absolute inset-0 bg-background/80" onClick={() => setShowCoach(false)} />

          <div className="dialog-panel">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="fx text-5xl">AI Coach</h2>
                {recommendation && (
                  <p className="lab lab-lime mt-1">
                    {recommendation.confidence} confidence, {recommendation.dataPointsUsed} sessions analyzed
                  </p>
                )}
              </div>
              {(isGenerating || !recommendation) && (
                <Button variant="secondary" size="sm" onClick={() => setShowCoach(false)}>Close</Button>
              )}
            </div>

            {isGenerating ? (
              <div className="py-10">
                <OnAir>Analyzing your training data...</OnAir>
              </div>
            ) : recommendation ? (
              <>
                <h3 className="fx mt-3 text-4xl">{recommendation.headline}</h3>
                <ul className="mt-2 space-y-1">
                  {recommendation.reasoning.split('\n').map((line, i) => (
                    <li key={i} className="prose-w text-base">{line}</li>
                  ))}
                </ul>

                {/* The numbers for the next one */}
                <div className="mt-3 grid grid-cols-2 border-y border-surface-3 sm:grid-cols-3">
                  {[
                    { label: 'Type', value: recommendation.workoutType },
                    { label: 'Difficulty', value: recommendation.suggestedDifficulty },
                    { label: 'Rounds', value: recommendation.suggestedRounds },
                    { label: 'Round Time', value: `${recommendation.suggestedRoundDuration / 60} min` },
                    { label: 'Rest', value: `${recommendation.suggestedRestDuration}s` },
                    { label: 'Est. Duration', value: `~${recommendation.targetDuration} min` },
                  ].map(({ label, value }) => (
                    <div key={label} className="min-w-0 border-b border-surface-2 px-1 py-1.5">
                      <p className="fx text-[1.625rem] [overflow-wrap:anywhere]">{value}</p>
                      <p className="lab mt-0.5 tracking-[0.04em]">{label}</p>
                    </div>
                  ))}
                </div>

                {recommendation.focusAreas.length > 0 && (
                  <div className="row-rule items-center px-0">
                    <span className="lab lab-w">Focus Areas</span>
                    <span className="fx text-right text-2xl">{recommendation.focusAreas.map((area) => area.replace('_', ' ')).join(', ')}</span>
                  </div>
                )}

                {recommendation.punchEmphasis.length > 0 && (
                  <div className="row-rule items-center px-0">
                    <span className="lab lab-w">Punch Emphasis</span>
                    <span className="flex flex-wrap justify-end gap-2">
                      {recommendation.punchEmphasis.map((punch) => (
                        <Plate key={punch} tone="lime" className="size-11 text-3xl">{punch}</Plate>
                      ))}
                    </span>
                  </div>
                )}

                {recommendation.defenseEmphasis.length > 0 && (
                  <div className="row-rule items-center px-0">
                    <span className="lab lab-w">Defense Work</span>
                    <span className="flex flex-wrap justify-end gap-2">
                      {recommendation.defenseEmphasis.map((defense) => (
                        <Plate key={defense} tone="white" back className="h-9 px-3 text-xl">{defense}</Plate>
                      ))}
                    </span>
                  </div>
                )}

                <div className="pt-3">
                  <p className="lab lab-w">Combo Guidance</p>
                  <p className="prose-w mt-1 text-lg">
                    <span className="capitalize">{recommendation.comboComplexity}</span> complexity, {recommendation.comboLengthRange[0]}-{recommendation.comboLengthRange[1]} moves per combo
                    {recommendation.includeDefenseInCombos && ', includes defense tokens'}
                  </p>
                </div>

                {recommendation.encouragement && (
                  <p className="fx mt-3 text-3xl text-volt">{recommendation.encouragement}</p>
                )}

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 px-1 pb-1">
                  <Button variant="secondary" onClick={() => setShowCoach(false)} className="flex-[1_1_5rem] px-3">Close</Button>
                  <Button onClick={handleGenerateWorkout} className="flex-[2_1_auto] px-3">Generate Workout</Button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default History;
