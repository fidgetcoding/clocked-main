import { useState } from 'react';
import { History as HistoryIcon, Plus, ChevronRight, Calendar, Brain, X, Wand2, Zap, Target, Shield, Activity } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useWorkoutHistory } from '@/hooks/useWorkoutHistory';
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

const FOCUS_ICONS: Record<string, string> = {
  power: '💥', speed: '⚡', defense: '🛡️', body_work: '🎯',
  footwork: '👣', endurance: '🫁', technique: '🥋', variety: '🔄',
  conditioning: '🏋️', recovery: '💆',
};

const CONFIDENCE_COLORS = {
  high: 'text-green-400 bg-green-500/10',
  medium: 'text-volt bg-volt/10',
  low: 'text-orange-400 bg-orange-500/10',
};

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
    // Navigate to build with AI prompt
    navigate(`/build?coachPrompt=${encodeURIComponent(prompt)}`);
  };

  return (
    <AppLayout>
      <div className="min-h-screen pb-24">
        {/* Header */}
        <header className="px-4 pt-8 pb-4 safe-top">
          <div className="flex items-center gap-3 mb-4">
            <HistoryIcon className="w-6 h-6 text-volt" />
            <h1 className="text-2xl font-black text-foreground tracking-wider">
              WORKOUT LOG
            </h1>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleCoach}
              variant="outline"
              className="flex-1 border-volt text-volt hover:bg-volt/10"
            >
              <Brain className="w-4 h-4 mr-2" />
              AI Coach
            </Button>
            <Button
              onClick={() => setShowAddModal(true)}
              className="flex-1 bg-volt text-primary-foreground"
            >
              <Plus className="w-4 h-4 mr-2" />
              Log Workout
            </Button>
          </div>
        </header>

        {/* Workout List */}
        <div className="px-4 space-y-3">
          {completedWorkouts.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-surface-3 p-8 text-center">
              <p className="text-muted-foreground uppercase tracking-wider mb-2">
                No History Yet
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Complete a workout or log one manually to get started
              </p>
              <Button
                onClick={() => setShowAddModal(true)}
                className="btn-primary-glow"
              >
                Log a Workout
              </Button>
            </div>
          ) : (
            completedWorkouts.map((workout) => {
              const isExpanded = expandedId === workout.id;
              return (
                <div
                  key={workout.id}
                  className="bg-surface-1 rounded-xl border border-surface-3 overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : workout.id)}
                    className="w-full flex items-center gap-3 p-4"
                  >
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-foreground">{workout.workout_name}</h3>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDistanceToNow(new Date(workout.completed_at), { addSuffix: true })}
                        </span>
                        <span>{formatDuration(workout.duration)}</span>
                        <span className="text-volt font-semibold">+{workout.xp_earned} XP</span>
                      </div>
                    </div>
                    <ChevronRight
                      className={cn(
                        'w-5 h-5 text-muted-foreground transition-transform',
                        isExpanded && 'rotate-90'
                      )}
                    />
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t border-surface-3">
                      {workout.difficulty && (
                        <div className="flex items-center gap-2 mt-3 mb-2">
                          <span className="text-xs text-muted-foreground">Difficulty:</span>
                          <span
                            className={cn(
                              'text-xs font-medium px-2 py-0.5 rounded',
                              workout.difficulty === 'too_easy' && 'bg-accent/20 text-accent-foreground',
                              workout.difficulty === 'just_right' && 'bg-volt/20 text-volt',
                              workout.difficulty === 'too_hard' && 'bg-destructive/20 text-destructive'
                            )}
                          >
                            {workout.difficulty === 'too_easy' && 'Too Easy'}
                            {workout.difficulty === 'just_right' && 'Just Right'}
                            {workout.difficulty === 'too_hard' && 'Too Hard'}
                          </span>
                        </div>
                      )}

                      {workout.round_feedback && workout.round_feedback.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-muted-foreground mb-2">Round Ratings</p>
                          <div className="flex flex-wrap gap-1">
                            {workout.round_feedback.map((rf: any) => (
                              <div
                                key={rf.roundNumber}
                                className="flex items-center gap-1 bg-surface-2 rounded px-2 py-1"
                              >
                                <span className="text-[10px] text-muted-foreground">R{rf.roundNumber}</span>
                                <span className="text-xs font-bold text-volt">{rf.rating}/5</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {workout.notes && (
                        <div className="mt-3">
                          <p className="text-xs text-muted-foreground mb-1">Journal</p>
                          <p className="text-sm text-foreground leading-relaxed bg-surface-2 rounded-lg p-3">
                            {workout.notes}
                          </p>
                        </div>
                      )}

                      <p className="text-[10px] text-muted-foreground mt-3">
                        {format(new Date(workout.completed_at), 'EEEE, MMMM d, yyyy • h:mm a')}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <AddWorkoutModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />

      {/* AI Coach Modal */}
      {showCoach && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowCoach(false)}
          />

          <div className="relative w-full max-w-md max-h-[75vh] bg-surface-1 rounded-2xl border border-surface-3 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-surface-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-volt/20 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-volt" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground uppercase tracking-wide">
                    AI Coach
                  </h2>
                  {recommendation && (
                    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', CONFIDENCE_COLORS[recommendation.confidence])}>
                      {recommendation.confidence.toUpperCase()} confidence • {recommendation.dataPointsUsed} sessions analyzed
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowCoach(false)}
                className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-12 h-12 border-2 border-volt/30 border-t-volt rounded-full animate-spin mb-4" />
                  <p className="text-muted-foreground">Analyzing your training data...</p>
                </div>
              ) : recommendation ? (
                <>
                  {/* Headline + Reasoning */}
                  <div className="pb-1">
                    <h3 className="text-lg font-black text-foreground">{recommendation.headline}</h3>
                    <ul className="mt-2 space-y-1">
                      {recommendation.reasoning.split('\n').map((line, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="text-volt mt-0.5">•</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Workout Parameters Card */}
                  <div className="bg-surface-2 rounded-xl p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Type</p>
                        <p className="text-sm font-bold text-foreground capitalize">{recommendation.workoutType}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Difficulty</p>
                        <p className="text-sm font-bold text-foreground capitalize">{recommendation.suggestedDifficulty}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Rounds</p>
                        <p className="text-sm font-bold text-foreground">{recommendation.suggestedRounds}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Round Time</p>
                        <p className="text-sm font-bold text-foreground">{recommendation.suggestedRoundDuration / 60} min</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Rest</p>
                        <p className="text-sm font-bold text-foreground">{recommendation.suggestedRestDuration}s</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Est. Duration</p>
                        <p className="text-sm font-bold text-foreground">~{recommendation.targetDuration} min</p>
                      </div>
                    </div>
                  </div>

                  {/* Focus Areas */}
                  {recommendation.focusAreas.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Focus Areas</p>
                      <div className="flex flex-wrap gap-1.5">
                        {recommendation.focusAreas.map(area => (
                          <span key={area} className="text-xs bg-volt/10 text-volt px-2 py-1 rounded-lg font-medium">
                            {FOCUS_ICONS[area] || '🎯'} {area.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Punch Emphasis */}
                  {recommendation.punchEmphasis.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Punch Emphasis</p>
                      <div className="flex gap-1.5">
                        {recommendation.punchEmphasis.map(p => (
                          <span key={p} className="text-xs bg-surface-2 text-foreground px-2.5 py-1 rounded-lg font-bold">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Defense */}
                  {recommendation.defenseEmphasis.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Defense Work</p>
                      <div className="flex flex-wrap gap-1.5">
                        {recommendation.defenseEmphasis.map(d => (
                          <span key={d} className="text-xs bg-surface-2 text-foreground px-2 py-1 rounded-lg font-medium">
                            🛡️ {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Combo Guidance */}
                  <div className="bg-surface-2 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Combo Guidance</p>
                    <p className="text-sm text-foreground">
                      <span className="font-bold capitalize">{recommendation.comboComplexity}</span> complexity, {recommendation.comboLengthRange[0]}-{recommendation.comboLengthRange[1]} moves per combo
                      {recommendation.includeDefenseInCombos && ' • includes defense tokens'}
                    </p>
                  </div>

                  {/* Encouragement */}
                  {recommendation.encouragement && (
                    <div className="bg-volt/5 border border-volt/20 rounded-xl p-3">
                      <p className="text-sm text-volt font-medium">💪 {recommendation.encouragement}</p>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Actions */}
            {!isGenerating && recommendation && (
              <div className="p-4 border-t border-surface-3 flex gap-3 flex-shrink-0">
                <Button
                  variant="outline"
                  onClick={() => setShowCoach(false)}
                  className="flex-1 border-surface-3 text-foreground hover:bg-surface-2"
                >
                  Close
                </Button>
                <Button
                  onClick={handleGenerateWorkout}
                  className="flex-1 bg-volt text-primary-foreground hover:bg-volt/90 font-bold"
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  Generate Workout
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default History;
