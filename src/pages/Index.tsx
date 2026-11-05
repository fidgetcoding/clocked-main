import { useEffect, useState } from 'react';
import { GripVertical, Check, X } from 'lucide-react';
import { format } from 'date-fns';
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
import { BroadcastPage, EmptyPlate, LevelBar, SectionChyron, TaleOfTape } from '@/components/broadcast';
import { buttonVariants } from '@/components/ui/button-variants';
import { useProfile } from '@/hooks/useProfile';
import { useWorkoutHistory } from '@/hooks/useWorkoutHistory';
import { getLevelProgress } from '@/lib/xpSystem';
import { tapeHours, weeklyTape } from '@/lib/weeklyTape';
import { AppLayout } from '@/components/layout/AppLayout';
import { useWorkouts } from '@/hooks/useWorkouts';

import { useUserStore } from '@/stores/userStore';
import { clearSession, describeSavedSession, findSavedSession, QUICK_SESSION_ID, type SessionSnapshot } from '@/lib/sessionRecovery';
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
  const { hasCompletedOnboarding, user } = useUserStore();
  const [savedSession, setSavedSession] = useState<SessionSnapshot | null>(null);
  useEffect(() => {
    setSavedSession(user?.id ? findSavedSession(user.id) : null);
  }, [user?.id]);
  const { workouts, isLoading, deleteWorkout, archiveWorkout, reorderWorkouts } = useWorkouts();
  const [workoutToDelete, setWorkoutToDelete] = useState<string | null>(null);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [localWorkouts, setLocalWorkouts] = useState<typeof workouts | null>(null);
  const { profile } = useProfile();
  const { history } = useWorkoutHistory();


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
  const savedSessionName = savedSession?.workoutId === QUICK_SESSION_ID
    ? 'Quick Session'
    : workouts.find((w) => w.id === savedSession?.workoutId)?.name;
  const displayWorkouts = localWorkouts ?? activeWorkouts;
  // The first set on the card, highlighted in Your Sets
  const mainEvent = isReorderMode ? null : activeWorkouts[0];
  const tape = weeklyTape(history);
  const fighterName = profile?.name?.split(' ')[0] || user?.name?.split(' ')[0] || 'You';

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
          toast.success('Workout archived. Find it under Edit Profile.');
        },
        onError: (error) => {
          toast.error('Failed to archive: ' + error.message);
        },
      });
    }
  };

  return (
    <AppLayout>
      <BroadcastPage show="Demo" showTone="white" air={<span className="lab lab-w">{format(new Date(), 'EEE MMM d')}</span>}>
        {savedSession && savedSessionName && (
          <section className="mt-3 bg-surface-1 px-4 py-3">
            <p className="text-base text-foreground">{describeSavedSession(savedSessionName, savedSession)}</p>
            <div className="mt-2 flex gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  clearSession();
                  setSavedSession(null);
                }}
              >
                Discard
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  navigate(savedSession.workoutId === QUICK_SESSION_ID ? '/quick-session' : `/workout/${savedSession.workoutId}/session`, {
                    state: { resume: true },
                  })
                }
              >
                Resume
              </Button>
            </div>
          </section>
        )}

        {/* Tale of the tape: you against you, from the log */}
        <section className="mt-3 bg-surface-1 pb-1.5" data-testid="tale-of-tape">
          <SectionChyron>Tale of the tape</SectionChyron>
          {tape.hasTape ? (
            <TaleOfTape
              left={fighterName}
              right="Last week"
              rows={[
                { label: 'Sessions', left: tape.thisWeek.sessions, right: tape.lastWeek.sessions || '-' },
                { label: 'Time', left: tapeHours(tape.thisWeek.seconds), right: tape.lastWeek.seconds ? tapeHours(tape.lastWeek.seconds) : '-' },
                { label: 'XP', left: tape.thisWeek.xp.toLocaleString(), right: tape.lastWeek.xp ? tape.lastWeek.xp.toLocaleString() : '-' },
              ]}
            />
          ) : (
            <p className="px-4 pb-2 pt-2.5 text-lg text-foreground">
              <span className="fx mb-1 block text-3xl">No tape on you yet</span>
              Log your first session. Next week, the one you have to beat is you.
            </p>
          )}
        </section>

        {profile && (
          <section className="mt-3 px-4">
            <LevelBar level={profile.current_level || 1} percent={getLevelProgress(profile.prestige, profile.current_level || 1, profile.total_xp || 0)} />
          </section>
        )}

        {/* The rest of the card */}
        <section className="mt-2">
          {[
            { title: 'QUICK SESSION', sub: 'JUST START THE CLOCK', path: '/quick-session' },
            { title: 'PUNCH CHECK', sub: 'CAMERA FORM GUIDE', path: '/punch-check' },
            { title: 'CREATE SET', sub: '', path: '/build' },
            { title: 'WORKOUT LOG', sub: '', path: '/history' },
          ].map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className="grid min-h-[3.25rem] w-full grid-cols-[1fr_auto] items-baseline gap-2 border-b border-surface-2 px-4 py-2 text-left transition-colors hover:bg-surface-1"
            >
              <span className="fx whitespace-nowrap text-3xl">{item.title}</span>
              {item.sub && <span className="lab self-center text-right">{item.sub}</span>}
            </button>
          ))}
        </section>

        {/* Your Sets */}
        <section className="pt-5">
          <div className="flex min-h-11 items-center justify-between border-b border-surface-3 px-4 pb-1">
            <h2 className="fx text-3xl">
              Your Sets
            </h2>
            {activeWorkouts.length > 1 && (
              isReorderMode ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancelReorder}
                    className="plate plate-graphite h-11 w-12"
                    aria-label="Cancel reorder"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={handleSaveOrder}
                    className="plate plate-lime h-11 w-12"
                    aria-label="Save order"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setIsReorderMode(true);
                    setLocalWorkouts(activeWorkouts);
                  }}
                  className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label="Reorder workouts"
                >
                  <GripVertical className="w-4 h-4" />
                </button>
              )
            )}
          </div>

          <div>
            {activeWorkouts.length === 0 ? (
              <EmptyPlate title="No workouts yet" body="Create a set to get started.">
                <Button onClick={() => navigate('/build')}>Create Your First Workout</Button>
              </EmptyPlate>
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
                      featured={workout.id === mainEvent?.id}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </section>
      </BroadcastPage>

      {/* Delete/Archive Confirmation */}
      <AlertDialog open={!!workoutToDelete} onOpenChange={() => setWorkoutToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Workout?</AlertDialogTitle>
            <AlertDialogDescription>
              Choose to archive (can be restored later) or delete permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              className={buttonVariants({ variant: 'default' })}
            >
              Archive
            </AlertDialogAction>
            <AlertDialogAction
              onClick={handleDelete}
              className={buttonVariants({ variant: 'destructive' })}
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
