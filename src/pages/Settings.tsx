import { useState, useRef, useEffect } from 'react';
import { User, LogOut, Pencil, Volume2, Bell, Timer, Vibrate, Archive, RotateCcw, Trash2, ChevronRight, Camera, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Switch } from '@/components/ui/switch';
import { useUserStore } from '@/stores/userStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
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

const Settings = () => {
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
  const updateUser = useUserStore((state) => state.updateUser);
  const setUser = useUserStore((state) => state.setUser);
  const { archivedWorkouts, restoreWorkout, permanentlyDeleteArchived } = useWorkoutStore();
  const { signOut, user: authUser } = useAuth();
  const { profile, updateProfile } = useProfile();
  
  const [showArchives, setShowArchives] = useState(false);
  const [workoutToDelete, setWorkoutToDelete] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use the avatar_url from the profile
  const profilePhoto = profile?.avatar_url || null;

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      setUser(null);
      // Reset onboarding state so user goes through auth on next visit
      useUserStore.setState({ hasCompletedOnboarding: false });
      navigate('/onboarding');
      toast.success('Signed out successfully');
    } catch (error) {
      toast.error('Failed to sign out');
    } finally {
      setIsSigningOut(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !authUser?.id) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${authUser.id}/avatar.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Add cache buster to force refresh
      const urlWithCacheBuster = `${publicUrl}?t=${Date.now()}`;

      // Update profile with new avatar URL
      await updateProfile.mutateAsync({ avatar_url: urlWithCacheBuster });

      toast.success('Profile photo updated!');
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('Failed to upload photo');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleTogglePreference = (key: string, value: boolean) => {
    if (user) {
      updateUser({
        preferences: {
          ...user.preferences,
          [key]: value,
        },
      });
    }
  };

  const handleRestore = (id: string) => {
    restoreWorkout(id);
    toast.success('Workout restored to your sets');
  };

  const handlePermanentDelete = () => {
    if (workoutToDelete) {
      permanentlyDeleteArchived(workoutToDelete);
      setWorkoutToDelete(null);
      toast.success('Workout permanently deleted');
    }
  };

  const joinedDate = user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A';

  // Preference items grouped by category
  const voiceAlerts = [
    { 
      key: 'voiceAnnouncements', 
      label: 'Voice Announcements', 
      description: 'Announce segment changes and instructions',
      icon: Volume2,
    },
    { 
      key: 'voiceCountdown', 
      label: 'Countdown Voice', 
      description: '10-second countdown before segment ends',
      icon: Timer,
    },
    { 
      key: 'voiceComboCallouts', 
      label: 'Combo Callouts', 
      description: 'Call out punch combinations during combos',
      icon: Volume2,
    },
  ];

  const soundAlerts = [
    { 
      key: 'soundEnabled', 
      label: 'Sound Effects', 
      description: 'Boxing bell and timer sounds',
      icon: Bell,
    },
    { 
      key: 'roundStartBell', 
      label: 'Round Start Bell', 
      description: 'Bell sound at start of each round',
      icon: Bell,
    },
    { 
      key: 'roundEndBell', 
      label: 'Round End Bell', 
      description: 'Bell sound at end of each round',
      icon: Bell,
    },
    { 
      key: 'tenSecondWarning', 
      label: '10-Second Warning', 
      description: 'Warning beep at 10 seconds remaining',
      icon: Timer,
    },
    { 
      key: 'segmentTransitionBeep', 
      label: 'Segment Transition Beep', 
      description: 'Beep when transitioning between segments',
      icon: Bell,
    },
  ];

  const hapticAlerts = [
    { 
      key: 'hapticEnabled', 
      label: 'Haptic Feedback', 
      description: 'Vibration for important events',
      icon: Vibrate,
    },
    { 
      key: 'hapticRoundChange', 
      label: 'Round Change Vibration', 
      description: 'Vibrate on round start/end',
      icon: Vibrate,
    },
    { 
      key: 'hapticWarning', 
      label: 'Warning Vibration', 
      description: 'Vibrate for 10-second warning',
      icon: Vibrate,
    },
  ];

  const PreferenceToggle = ({ 
    prefKey, 
    label, 
    description, 
    icon: Icon 
  }: { 
    prefKey: string; 
    label: string; 
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }) => {
    const isEnabled = (user?.preferences as any)?.[prefKey] !== false;
    
    return (
      <div className="flex items-start gap-3 py-3">
        <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-foreground font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Switch
          checked={isEnabled}
          onCheckedChange={(checked) => handleTogglePreference(prefKey, checked)}
          className="data-[state=checked]:bg-volt"
        />
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-red-glow">
        {/* Header */}
        <header className="px-4 pt-8 pb-6 safe-top">
          <h1 className="text-2xl font-black text-foreground tracking-wider">
            PROFILE & SETTINGS
          </h1>
        </header>

        <div className="px-4 space-y-6 pb-24">
          {/* Profile Card */}
          <div className="card-workout">
            <div className="flex items-center gap-4 mb-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-volt/20 flex items-center justify-center overflow-hidden">
                  {profilePhoto ? (
                    <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-volt" />
                  )}
                  {isUploadingPhoto && (
                    <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-full">
                      <Loader2 className="w-6 h-6 text-volt animate-spin" />
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-volt flex items-center justify-center text-primary-foreground shadow-lg disabled:opacity-50"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-foreground">{user?.name || 'Fighter'}</h2>
                  <button className="text-muted-foreground hover:text-foreground">
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground">user@example.com</p>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-surface-2 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Joined</p>
                <p className="font-semibold text-foreground">{joinedDate}</p>
              </div>
              <div className="bg-surface-2 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                <p className="font-semibold text-volt">ACTIVE</p>
              </div>
            </div>

            {/* Sign Out */}
            <button 
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="flex items-center gap-2 w-full p-3 rounded-lg bg-surface-2 border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              <span className="font-medium">{isSigningOut ? 'Signing Out...' : 'Sign Out'}</span>
            </button>
          </div>

          {/* Archived Workouts */}
          <div className="card-workout">
            <button 
              onClick={() => setShowArchives(!showArchives)}
              className="flex items-center justify-between w-full"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center">
                  <Archive className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Archived Workouts</h3>
                  <p className="text-xs text-muted-foreground">{archivedWorkouts.length} archived</p>
                </div>
              </div>
              <ChevronRight className={cn(
                'w-5 h-5 text-muted-foreground transition-transform',
                showArchives && 'rotate-90'
              )} />
            </button>

            {showArchives && (
              <div className="mt-4 space-y-3">
                {archivedWorkouts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No archived workouts
                  </p>
                ) : (
                  archivedWorkouts.map((workout) => (
                    <div key={workout.id} className="bg-surface-2 rounded-lg p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{workout.name}</p>
                        <p className="text-xs text-muted-foreground">{workout.difficulty}</p>
                      </div>
                      <button
                        onClick={() => handleRestore(workout.id)}
                        className="text-volt hover:text-volt/80 transition-colors p-2"
                        title="Restore"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setWorkoutToDelete(workout.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-2"
                        title="Delete Forever"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Voice Alerts */}
          <div className="card-workout">
            <h3 className="text-lg font-bold text-foreground mb-2">Voice Alerts</h3>
            <p className="text-xs text-muted-foreground mb-4">Control voice announcements during workouts</p>
            <div className="divide-y divide-surface-3">
              {voiceAlerts.map((pref) => (
                <PreferenceToggle
                  key={pref.key}
                  prefKey={pref.key}
                  label={pref.label}
                  description={pref.description}
                  icon={pref.icon}
                />
              ))}
            </div>
          </div>

          {/* Sound Alerts */}
          <div className="card-workout">
            <h3 className="text-lg font-bold text-foreground mb-2">Sound Alerts</h3>
            <p className="text-xs text-muted-foreground mb-4">Configure audio cues for workout events</p>
            <div className="divide-y divide-surface-3">
              {soundAlerts.map((pref) => (
                <PreferenceToggle
                  key={pref.key}
                  prefKey={pref.key}
                  label={pref.label}
                  description={pref.description}
                  icon={pref.icon}
                />
              ))}
            </div>
          </div>

          {/* Haptic Alerts */}
          <div className="card-workout">
            <h3 className="text-lg font-bold text-foreground mb-2">Haptic Feedback</h3>
            <p className="text-xs text-muted-foreground mb-4">Vibration alerts (device must support haptics)</p>
            <div className="divide-y divide-surface-3">
              {hapticAlerts.map((pref) => (
                <PreferenceToggle
                  key={pref.key}
                  prefKey={pref.key}
                  label={pref.label}
                  description={pref.description}
                  icon={pref.icon}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Permanent Delete Confirmation */}
      <AlertDialog open={!!workoutToDelete} onOpenChange={() => setWorkoutToDelete(null)}>
        <AlertDialogContent className="bg-surface-1 border-surface-3">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Forever?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will permanently delete the workout. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-surface-2 border-surface-3 text-foreground">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePermanentDelete}
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

export default Settings;
