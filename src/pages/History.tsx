import { useState } from 'react';
import { History as HistoryIcon, Plus, ChevronRight, Calendar } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useHistoryStore } from '@/stores/historyStore';
import { AddWorkoutModal } from '@/components/AddWorkoutModal';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

const History = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const completedWorkouts = useHistoryStore((state) => state.completedWorkouts);

  return (
    <AppLayout>
      <div className="min-h-screen pb-24">
        {/* Header */}
        <header className="px-4 pt-8 pb-6 safe-top">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <HistoryIcon className="w-6 h-6 text-volt" />
              <h1 className="text-2xl font-black text-foreground tracking-wider">
                WORKOUT LOG
              </h1>
            </div>
            <Button
              onClick={() => setShowAddModal(true)}
              size="sm"
              className="bg-volt text-primary-foreground"
            >
              <Plus className="w-4 h-4 mr-1" />
              Log
            </Button>
          </div>
        </header>

        {/* Workout List */}
        <div className="px-4 space-y-3">
          {completedWorkouts.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-surface-3 p-8 text-center">
              <p className="text-muted-foreground uppercase tracking-wider">
                No History Yet
              </p>
            </div>
          ) : (
            completedWorkouts.map((workout) => {
              const isExpanded = expandedId === workout.id;
              return (
                <div
                  key={workout.id}
                  className="bg-surface-1 rounded-xl border border-surface-3 overflow-hidden"
                >
                  {/* Header Row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : workout.id)}
                    className="w-full flex items-center gap-3 p-4"
                  >
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-foreground">{workout.workoutName}</h3>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDistanceToNow(new Date(workout.completedAt), { addSuffix: true })}
                        </span>
                        <span>{formatDuration(workout.duration)}</span>
                        <span className="text-volt font-semibold">+{workout.xpEarned} XP</span>
                      </div>
                    </div>
                    <ChevronRight
                      className={cn(
                        'w-5 h-5 text-muted-foreground transition-transform',
                        isExpanded && 'rotate-90'
                      )}
                    />
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t border-surface-3">
                      {/* Difficulty */}
                      {workout.difficulty && (
                        <div className="flex items-center gap-2 mt-3 mb-2">
                          <span className="text-xs text-muted-foreground">Difficulty:</span>
                          <span
                            className={cn(
                              'text-xs font-medium px-2 py-0.5 rounded',
                              workout.difficulty === 'too_easy' && 'bg-green-500/20 text-green-400',
                              workout.difficulty === 'just_right' && 'bg-volt/20 text-volt',
                              workout.difficulty === 'too_hard' && 'bg-orange-500/20 text-orange-400'
                            )}
                          >
                            {workout.difficulty === 'too_easy' && 'Too Easy'}
                            {workout.difficulty === 'just_right' && 'Just Right'}
                            {workout.difficulty === 'too_hard' && 'Too Hard'}
                          </span>
                        </div>
                      )}

                      {/* Round Feedback */}
                      {workout.roundFeedback && workout.roundFeedback.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-muted-foreground mb-2">Round Ratings</p>
                          <div className="flex flex-wrap gap-1">
                            {workout.roundFeedback.map((rf) => (
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

                      {/* Notes */}
                      {workout.notes && (
                        <div className="mt-3">
                          <p className="text-xs text-muted-foreground mb-1">Journal</p>
                          <p className="text-sm text-foreground leading-relaxed bg-surface-2 rounded-lg p-3">
                            {workout.notes}
                          </p>
                        </div>
                      )}

                      {/* Date */}
                      <p className="text-[10px] text-muted-foreground mt-3">
                        {format(new Date(workout.completedAt), 'EEEE, MMMM d, yyyy • h:mm a')}
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
    </AppLayout>
  );
};

export default History;
