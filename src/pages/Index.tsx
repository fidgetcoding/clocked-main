import { useState, useEffect } from 'react';
import { Plus, History, Play, Pencil, Trash2, Clock, RotateCcw, Archive } from 'lucide-react';
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
import { toast } from 'sonner';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  return `${mins} MIN`;
}

const Index = () => {
  const navigate = useNavigate();
  const { hasCompletedOnboarding, user } = useUserStore();
  const { workouts, deleteWorkout, archiveWorkout, loadBeginnerPresets, loadIntermediatePresets, loadAdvancedPresets, loadProPresets, loadCoachPresets } = useWorkoutStore();
  const [workoutToDelete, setWorkoutToDelete] = useState<string | null>(null);

  // Redirect to onboarding if not completed
  useEffect(() => {
    if (!hasCompletedOnboarding) {
      navigate('/onboarding');
    }
  }, [hasCompletedOnboarding, navigate]);

  // Load presets based on user's role and experience level
  useEffect(() => {
    // Coaches get the special coach preset
    if (user?.role === 'coach') {
      loadCoachPresets();
      return;
    }
    
    // Fighters get presets based on their experience level
    const level = user?.experienceLevel;
    if (level === 'complete_beginner' || level === 'beginner') {
      loadBeginnerPresets();
    } else if (level === 'intermediate') {
      loadIntermediatePresets();
    } else if (level === 'advanced') {
      loadAdvancedPresets();
    } else if (level === 'pro') {
      loadProPresets();
    } else {
      // Default to beginner if no level set
      loadBeginnerPresets();
    }
  }, [user?.role, user?.experienceLevel, loadBeginnerPresets, loadIntermediatePresets, loadAdvancedPresets, loadProPresets, loadCoachPresets]);

  const activeWorkouts = workouts.filter((w) => !w.isArchived);

  const handleDelete = () => {
    if (workoutToDelete) {
      deleteWorkout(workoutToDelete);
      setWorkoutToDelete(null);
      toast.success('Workout deleted permanently');
    }
  };

  const handleArchive = () => {
    if (workoutToDelete) {
      archiveWorkout(workoutToDelete);
      setWorkoutToDelete(null);
      toast.success('Workout archived. Access it in Settings.');
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
              CLOCKED
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
                  className="card-workout group"
                >
                  <div className="flex items-start gap-4">
                    {/* Content */}
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

                    {/* Play button and actions column */}
                    <div className="flex flex-col items-center gap-3 flex-shrink-0">
                      {/* Play Button - pulses on card hover */}
                      <button
                        onClick={() => navigate(`/workout/${workout.id}`)}
                        className="w-12 h-12 rounded-full bg-volt flex items-center justify-center transition-all duration-200 group-hover:scale-110 group-hover:shadow-[0_0_20px_hsl(var(--electric-volt)/0.6)] active:scale-95"
                      >
                        <Play className="w-5 h-5 text-primary-foreground ml-0.5" fill="currentColor" />
                      </button>

                      {/* Edit and Delete below play button */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => navigate(`/build?edit=${workout.id}`)}
                          className="text-muted-foreground hover:text-foreground transition-colors p-1"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setWorkoutToDelete(workout.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Delete/Archive Confirmation */}
      <AlertDialog open={!!workoutToDelete} onOpenChange={() => setWorkoutToDelete(null)}>
        <AlertDialogContent className="bg-surface-1 border-surface-3">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Remove Workout?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Choose to archive (can be restored later) or delete permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="bg-surface-2 border-surface-3 text-foreground">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              className="bg-surface-3 text-foreground hover:bg-surface-2 flex items-center gap-2"
            >
              <Archive className="w-4 h-4" />
              Archive
            </AlertDialogAction>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Index;
