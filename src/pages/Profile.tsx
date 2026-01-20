import { ArrowLeft, User, Volume2, Vibrate, Moon, ChevronRight, Archive, LogOut, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Switch } from '@/components/ui/switch';
import { useUserStore } from '@/stores/userStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import { XPBar } from '@/components/ui/XPBar';
import { RANK_NAMES, Rank, RANK_THRESHOLDS } from '@/types';

function getCurrentRank(xp: number): Rank {
  const ranks = Object.entries(RANK_THRESHOLDS).reverse() as [Rank, number][];
  for (const [rank, threshold] of ranks) {
    if (xp >= threshold) return rank;
  }
  return 'regional';
}

const Profile = () => {
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
  const updateUser = useUserStore((state) => state.updateUser);
  const archivedWorkouts = useWorkoutStore((state) => state.archivedWorkouts);
  const restoreWorkout = useWorkoutStore((state) => state.restoreWorkout);
  const permanentlyDeleteArchived = useWorkoutStore((state) => state.permanentlyDeleteArchived);

  const totalXP = user?.totalXP || 247;
  const currentRank = getCurrentRank(totalXP);

  const handleToggleSound = () => {
    if (user) {
      updateUser({
        preferences: {
          ...user.preferences,
          soundEnabled: !user.preferences.soundEnabled,
        },
      });
    }
  };

  const handleToggleHaptic = () => {
    if (user) {
      updateUser({
        preferences: {
          ...user.preferences,
          hapticEnabled: !user.preferences.hapticEnabled,
        },
      });
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen">
        {/* Header */}
        <header className="flex items-center gap-4 px-4 py-4 safe-top border-b border-surface-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-foreground">Profile & Settings</h1>
        </header>

        <div className="px-4 py-6 space-y-6">
          {/* Profile Card */}
          <div className="card-workout">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-volt/20 flex items-center justify-center">
                <User className="w-8 h-8 text-volt" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-foreground">{user?.name || 'Fighter'}</h2>
                <p className="text-sm text-volt uppercase font-semibold">{RANK_NAMES[currentRank]}</p>
              </div>
            </div>
            <XPBar currentXP={totalXP} />
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card-workout text-center py-4">
              <p className="text-2xl font-bold text-volt">{user?.workoutsCompleted || 24}</p>
              <p className="text-xs text-muted-foreground">Workouts</p>
            </div>
            <div className="card-workout text-center py-4">
              <p className="text-2xl font-bold text-volt">{user?.currentStreak || 3}</p>
              <p className="text-xs text-muted-foreground">Day Streak</p>
            </div>
            <div className="card-workout text-center py-4">
              <p className="text-2xl font-bold text-volt">{user?.longestStreak || 14}</p>
              <p className="text-xs text-muted-foreground">Best Streak</p>
            </div>
          </div>

          {/* Settings */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Settings
            </h3>
            <div className="card-workout divide-y divide-surface-3">
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Volume2 className="w-5 h-5 text-muted-foreground" />
                  <span className="text-foreground">Sound Effects</span>
                </div>
                <Switch 
                  checked={user?.preferences?.soundEnabled ?? true}
                  onCheckedChange={handleToggleSound}
                />
              </div>
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Vibrate className="w-5 h-5 text-muted-foreground" />
                  <span className="text-foreground">Haptic Feedback</span>
                </div>
                <Switch 
                  checked={user?.preferences?.hapticEnabled ?? true}
                  onCheckedChange={handleToggleHaptic}
                />
              </div>
            </div>
          </div>

          {/* Archived Workouts */}
          {archivedWorkouts.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Archived Workouts
              </h3>
              <div className="space-y-2">
                {archivedWorkouts.map((workout) => (
                  <div key={workout.id} className="card-workout">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{workout.icon}</span>
                        <span className="text-foreground">{workout.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => restoreWorkout(workout.id)}
                          className="text-xs text-volt hover:underline"
                        >
                          Restore
                        </button>
                        <button
                          onClick={() => permanentlyDeleteArchived(workout.id)}
                          className="text-xs text-alert-red hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Links */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              More
            </h3>
            <div className="card-workout divide-y divide-surface-3">
              <button className="flex items-center justify-between py-3 w-full text-left">
                <div className="flex items-center gap-3">
                  <Archive className="w-5 h-5 text-muted-foreground" />
                  <span className="text-foreground">Archived Workouts</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{archivedWorkouts.length}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
              <button className="flex items-center justify-between py-3 w-full text-left">
                <div className="flex items-center gap-3">
                  <Info className="w-5 h-5 text-muted-foreground" />
                  <span className="text-foreground">About Get Clocked</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Version */}
          <p className="text-center text-xs text-muted-foreground">
            Get Clocked v1.0.0
          </p>
        </div>
      </div>
    </AppLayout>
  );
};

export default Profile;
