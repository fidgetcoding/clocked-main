import { useState } from 'react';
import { Plus, History, Archive, GripVertical, Check, Timer, X } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import clockedTextLogo from '@/assets/clocked-text-logo.png';
import { AppLayout } from '@/components/layout/AppLayout';
import { useWorkouts } from '@/hooks/useWorkouts';

import { useUserStore } from '@/stores/userStore';
import { Button } from '@/components/ui/button';
import { SortableWorkoutCard } from '@/components/SortableWorkoutCard';
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
import { toast } from 'sonner';

const Index = () => {
  const navigate = useNavigate();
  const { hasCompletedOnboarding } = useUserStore();
  const { workouts, isLoading, deleteWorkout, archiveWorkout, reorderWorkouts } = useWorkouts();
  const [workoutToDelete, setWorkoutToDelete] = useState<string | null>(null);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [localWorkouts, setLocalWorkouts] = useState<typeof workouts | null>(null);


  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Redirect to onboarding if not completed
  if (!hasCompletedOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  // Filter active workouts (not archived)
  const activeWorkouts = workouts.filter((w) => !w.is_archived);
  const displayWorkouts = localWorkouts ?? activeWorkouts;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = displayWorkouts.findIndex((w) => w.id === active.id);
      const newIndex = displayWorkouts.findIndex((w) => w.id === over.id);

      const newOrder = arrayMove(displayWorkouts, oldIndex, newIndex);
      setLocalWorkouts(newOrder);
    }
  };

  const handleSaveOrder = async () => {
    if (localWorkouts) {
      const orderedIds = localWorkouts.map((w) => w.id);
      reorderWorkouts.mutate(orderedIds, {
        onSuccess: () => {
          toast.success('Order saved');
          setIsReorderMode(false);
          setLocalWorkouts(null);
        },
        onError: (error) => {
          toast.error('Failed to save order: ' + error.message);
        },
      });
    } else {
      setIsReorderMode(false);
    }
  };

  const handleCancelReorder = () => {
    setIsReorderMode(false);
    setLocalWorkouts(null);
  };

  const handleDelete = () => {
    if (workoutToDelete) {
      deleteWorkout.mutate(workoutToDelete, {
        onSuccess: () => {
          setWorkoutToDelete(null);
          toast.success('Workout deleted permanently');
        },
        onError: (error) => {
          toast.error('Failed to delete: ' + error.message);
        },
      });
    }
  };

  const handleArchive = () => {
    if (workoutToDelete) {
      archiveWorkout.mutate(workoutToDelete, {
        onSuccess: () => {
          setWorkoutToDelete(null);
          toast.success('Workout archived. Access it in Settings.');
        },
        onError: (error) => {
          toast.error('Failed to archive: ' + error.message);
        },
      });
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="px-4 pt-8 pb-6 text-center safe-top">
          <div className="flex items-center justify-center gap-3">
            <div className="h-px flex-1 bg-volt/40" />
            <img 
              src={clockedTextLogo} 
              alt="CLOCKED" 
              className="h-24 object-contain"
            />
            <div className="h-px flex-1 bg-volt/40" />
          </div>
        </header>

        {/* Action Cards */}
        <section className="px-4 pb-6">
          <div className="grid grid-cols-2 gap-3">
            {/* Create Set */}
            <button
              onClick={() => navigate('/build')}
              className="card-action h-36 group flex flex-col items-start justify-between relative overflow-hidden"
            >
              <Plus className="w-5 h-5 text-volt" />
              <div className="text-left">
                <h3 className="text-base font-black text-foreground leading-none">CREATE</h3>
                <p className="text-xs text-muted-foreground leading-none mt-0.5">SET</p>
              </div>
              {/* Decorative background icon */}
              <Plus className="absolute right-1 top-1 w-[5.5rem] h-[5.5rem] text-muted-foreground/10 pointer-events-none md:right-4 md:top-2 md:w-[6.5rem] md:h-[6.5rem]" strokeWidth={1} />
            </button>

            {/* Workout Log */}
            <button
              onClick={() => navigate('/history')}
              className="card-action h-36 group flex flex-col items-start justify-between relative overflow-hidden"
            >
              <History className="w-5 h-5 text-volt" />
              <div className="text-left">
                <h3 className="text-base font-black text-foreground leading-none">WORKOUT</h3>
                <p className="text-xs text-muted-foreground leading-none mt-0.5">LOG</p>
              </div>
              {/* Decorative background icon */}
              <History className="absolute right-1 top-1 w-[5.5rem] h-[5.5rem] text-muted-foreground/10 pointer-events-none md:right-4 md:top-2 md:w-[6.5rem] md:h-[6.5rem]" strokeWidth={1} />
            </button>
          </div>
        </section>

        {/* Your Sets */}
        <section className="px-4 pb-24">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
              Your Sets
            </h2>
            {activeWorkouts.length > 1 && (
              isReorderMode ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancelReorder}
                    className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center hover:bg-surface-3 transition-colors"
                    aria-label="Cancel reorder"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={handleSaveOrder}
                    className="w-8 h-8 rounded-full bg-volt/20 flex items-center justify-center hover:bg-volt/30 transition-colors"
                    aria-label="Save order"
                  >
                    <Check className="w-4 h-4 text-volt" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setIsReorderMode(true);
                    setLocalWorkouts(activeWorkouts);
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  aria-label="Reorder workouts"
                >
                  <GripVertical className="w-4 h-4" />
                </button>
              )
            )}
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
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={displayWorkouts.map((w) => w.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {displayWorkouts.map((workout) => (
                    <SortableWorkoutCard
                      key={workout.id}
                      workout={workout}
                      onDelete={setWorkoutToDelete}
                      isReorderMode={isReorderMode}
                    />
                  ))}
                </SortableContext>
              </DndContext>
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
