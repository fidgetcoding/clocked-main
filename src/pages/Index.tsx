import { useState, useEffect } from 'react';
import { Plus, History, Play, Pencil, Trash2, Clock, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useUserStore } from '@/stores/userStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  return `${mins} MIN`;
}

const Index = () => {
  const navigate = useNavigate();
  const { hasCompletedOnboarding } = useUserStore();
  const { workouts, deleteWorkout, loadBeginnerPresets } = useWorkoutStore();
  const [workoutToDelete, setWorkoutToDelete] = useState<string | null>(null);

  // Redirect to onboarding if not completed
  useEffect(() => {
    if (!hasCompletedOnboarding) {
      navigate('/onboarding');
    }
  }, [hasCompletedOnboarding, navigate]);

  // Load beginner presets on mount
  useEffect(() => {
    loadBeginnerPresets();
  }, [loadBeginnerPresets]);

  const activeWorkouts = workouts.filter((w) => !w.isArchived);

  const handleDelete = () => {
    if (workoutToDelete) {
      deleteWorkout(workoutToDelete);
      setWorkoutToDelete(null);
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="px-4 pt-8 pb-6 text-center safe-top">
          <div className="flex items-center justify-center gap-2">
            <div className="h-px flex-1 bg-surface-3" />
            <h1 className="text-2xl font-black text-foreground tracking-wider">
              GET CLOCKED
            </h1>
            <div className="h-px flex-1 bg-surface-3" />
          </div>
        </header>

        {/* Action Cards */}
        <section className="px-4 pb-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Create Set */}
            <button
              onClick={() => navigate('/build')}
              className="card-action h-40 text-left group"
            >
              <Plus className="w-6 h-6 text-volt mb-auto" />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20">
                <Plus className="w-20 h-20 text-muted-foreground" strokeWidth={1} />
              </div>
              <div className="mt-auto">
                <h3 className="text-lg font-black text-foreground">CREATE</h3>
                <h3 className="text-lg font-black text-foreground">SET</h3>
              </div>
            </button>

            {/* Workout Log */}
            <button
              onClick={() => navigate('/history')}
              className="card-action h-40 text-left group"
            >
              <History className="w-6 h-6 text-volt mb-auto" />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20">
                <RotateCcw className="w-20 h-20 text-muted-foreground" strokeWidth={1} />
              </div>
              <div className="mt-auto">
                <h3 className="text-lg font-black text-foreground">WORKOUT</h3>
                <p className="text-sm text-muted-foreground">LOG</p>
              </div>
            </button>
          </div>
        </section>

        {/* Your Sets */}
        <section className="px-4 pb-24">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
              Your Sets
            </h2>
          </div>

          <div className="space-y-4">
            {activeWorkouts.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-surface-3 p-8 text-center">
                <p className="text-muted-foreground mb-4">No workouts yet</p>
                <Button
                  onClick={() => navigate('/build')}
                  className="btn-primary-glow"
                >
                  Create Your First Workout
                </Button>
              </div>
            ) : (
              activeWorkouts.map((workout) => (
                <div
                  key={workout.id}
                  className="card-workout"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-black text-foreground uppercase mb-1">
                        {workout.name}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatDuration(workout.totalDuration)}
                        </span>
                        <span className="flex items-center gap-1">
                          <RotateCcw className="w-4 h-4" />
                          {workout.sections.warmup.length + workout.sections.grind.length + workout.sections.cooldown.length} PHASES
                        </span>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-2">
                        <span className="tag">{workout.difficulty.toUpperCase()}</span>
                        <span className="tag">BOXING</span>
                        <span className="tag">HIIT</span>
                      </div>
                    </div>

                    {/* Play Button with hover animation */}
                    <button
                      onClick={() => navigate(`/workout/${workout.id}`)}
                      className="w-12 h-12 rounded-full bg-volt flex items-center justify-center flex-shrink-0 transition-all duration-200 hover:scale-110 hover:shadow-[0_0_20px_hsl(var(--electric-volt)/0.6)] active:scale-95"
                    >
                      <Play className="w-5 h-5 text-primary-foreground ml-0.5" fill="currentColor" />
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-4 mt-4 pt-4 border-t border-surface-3">
                    <button
                      onClick={() => navigate(`/build?edit=${workout.id}`)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setWorkoutToDelete(workout.id)}
                      className="text-muted-foreground hover:text-alert-red transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!workoutToDelete} onOpenChange={() => setWorkoutToDelete(null)}>
        <AlertDialogContent className="bg-surface-1 border-surface-3">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Workout?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-surface-2 border-surface-3 text-foreground">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-alert-red text-white hover:bg-alert-red/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Index;
