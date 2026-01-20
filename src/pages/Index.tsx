import { useState, useEffect } from 'react';
import { Plus, Flame, User, Zap, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { WorkoutCard } from '@/components/ui/WorkoutCard';
import { XPBar } from '@/components/ui/XPBar';
import { useUserStore } from '@/stores/userStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const Index = () => {
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
  const { workouts, deleteWorkout, archiveWorkout, loadBeginnerPresets } = useWorkoutStore();
  const [selectedWorkout, setSelectedWorkout] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Load beginner presets on first visit
  useEffect(() => {
    loadBeginnerPresets();
  }, [loadBeginnerPresets]);

  const activeWorkouts = workouts.filter((w) => !w.isArchived);

  const handleDeleteConfirm = () => {
    if (selectedWorkout) {
      deleteWorkout(selectedWorkout);
      setSelectedWorkout(null);
    }
    setShowDeleteDialog(false);
  };

  const handleArchive = () => {
    if (selectedWorkout) {
      archiveWorkout(selectedWorkout);
      setSelectedWorkout(null);
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen">
        {/* Header */}
        <header className="px-4 pt-6 pb-4 safe-top">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-volt flex items-center justify-center">
                <span className="text-lg">🥊</span>
              </div>
              <h1 className="text-xl font-black text-foreground tracking-tight">
                GET CLOCKED
              </h1>
            </div>
            <button 
              onClick={() => navigate('/profile')}
              className="w-10 h-10 rounded-full bg-surface-1 flex items-center justify-center border border-surface-3"
            >
              <User className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* XP Bar */}
          <XPBar currentXP={user?.totalXP || 247} className="mb-4" />

          {/* Greeting */}
          <div className="flex items-center gap-2">
            <p className="text-lg text-foreground">
              {getGreeting()}, <span className="font-semibold">{user?.name || 'Fighter'}</span>
            </p>
            {(user?.currentStreak || 3) > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-volt/20">
                <Flame className="w-3.5 h-3.5 text-volt" />
                <span className="text-xs font-semibold text-volt">
                  {user?.currentStreak || 3} day streak
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Quick Start */}
        <section className="px-4 py-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Quick Start
          </h2>
          <div className="flex gap-3">
            <Button 
              onClick={() => navigate('/build')}
              className="flex-1 h-auto py-3 bg-surface-1 hover:bg-surface-2 border border-surface-3 rounded-xl"
              variant="ghost"
            >
              <div className="flex flex-col items-center gap-1">
                <Plus className="w-5 h-5 text-volt" />
                <span className="text-xs font-medium text-foreground">New</span>
              </div>
            </Button>
            <Button 
              onClick={() => navigate('/timer')}
              className="flex-1 h-auto py-3 bg-surface-1 hover:bg-surface-2 border border-surface-3 rounded-xl"
              variant="ghost"
            >
              <div className="flex flex-col items-center gap-1">
                <Zap className="w-5 h-5 text-volt" />
                <span className="text-xs font-medium text-foreground">Quick Timer</span>
              </div>
            </Button>
            <Button 
              onClick={() => navigate('/build?ai=true')}
              className="flex-1 h-auto py-3 bg-surface-1 hover:bg-surface-2 border border-surface-3 rounded-xl"
              variant="ghost"
            >
              <div className="flex flex-col items-center gap-1">
                <Sparkles className="w-5 h-5 text-volt" />
                <span className="text-xs font-medium text-foreground">AI Build</span>
              </div>
            </Button>
          </div>
        </section>

        {/* My Workouts */}
        <section className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              My Workouts
            </h2>
            <Button
              onClick={() => navigate('/build')}
              variant="ghost"
              size="sm"
              className="text-volt hover:text-volt/80 hover:bg-transparent p-0 h-auto"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>

          <div className="space-y-3">
            {activeWorkouts.length === 0 ? (
              <div className="card-workout text-center py-8">
                <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center mx-auto mb-3">
                  <span className="text-3xl">🥊</span>
                </div>
                <p className="text-muted-foreground mb-3">No workouts yet</p>
                <Button
                  onClick={() => navigate('/build')}
                  className="btn-primary-glow"
                >
                  Create Your First Workout
                </Button>
              </div>
            ) : (
              activeWorkouts.map((workout) => (
                <DropdownMenu key={workout.id}>
                  <div className="relative">
                    <WorkoutCard
                      workout={workout}
                      onClick={() => navigate(`/workout/${workout.id}`)}
                      onOptionsClick={() => setSelectedWorkout(workout.id)}
                    />
                    <DropdownMenuTrigger asChild>
                      <button
                        className="absolute top-4 right-4 p-2 -m-2 text-muted-foreground hover:text-foreground transition-colors opacity-0"
                        aria-label="Options"
                      />
                    </DropdownMenuTrigger>
                  </div>
                  <DropdownMenuContent align="end" className="bg-surface-1 border-surface-3">
                    <DropdownMenuItem onClick={() => navigate(`/build?edit=${workout.id}`)}>
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {}}>
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-surface-3" />
                    <DropdownMenuItem 
                      onClick={() => {
                        setSelectedWorkout(workout.id);
                        handleArchive();
                      }}
                    >
                      Archive
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => {
                        setSelectedWorkout(workout.id);
                        setShowDeleteDialog(true);
                      }}
                      className="text-alert-red focus:text-alert-red"
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-surface-1 border-surface-3">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Delete Workout?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This action cannot be undone. You can archive the workout instead to keep it for later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="bg-surface-2 border-surface-3 text-foreground hover:bg-surface-3">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                handleArchive();
                setShowDeleteDialog(false);
              }}
              className="bg-surface-2 border-surface-3 text-foreground hover:bg-surface-3"
            >
              Archive
            </AlertDialogAction>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
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
