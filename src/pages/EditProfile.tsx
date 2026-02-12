import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, User, Pencil, Archive, RotateCcw, Trash2, ChevronRight, Camera, Loader2, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
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

const EditProfile = () => {
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
  const updateUser = useUserStore((state) => state.updateUser);
  const { archivedWorkouts, restoreWorkout, permanentlyDeleteArchived } = useWorkoutStore();
  const { user: authUser } = useAuth();
  const { profile, updateProfile } = useProfile();
  
  const [showArchives, setShowArchives] = useState(false);
  const [workoutToDelete, setWorkoutToDelete] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingHandle, setIsEditingHandle] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editedName, setEditedName] = useState(user?.name || '');
  const [editedHandle, setEditedHandle] = useState(profile?.handle || '');
  const [editedBio, setEditedBio] = useState(profile?.bio || '');
  const [useImperial, setUseImperial] = useState(true);
  const [weightInput, setWeightInput] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize weight/height from profile
  useEffect(() => {
    if (profile) {
      if (profile.weight_kg) {
        setWeightInput(useImperial ? Math.round(profile.weight_kg * 2.20462).toString() : profile.weight_kg.toString());
      }
      if (profile.height_cm) {
        if (useImperial) {
          const totalInches = profile.height_cm / 2.54;
          setHeightFt(Math.floor(totalInches / 12).toString());
          setHeightIn(Math.round(totalInches % 12).toString());
        } else {
          setHeightCm(profile.height_cm.toString());
        }
      }
    }
  }, [profile?.weight_kg, profile?.height_cm]);

  // Update editedHandle and editedBio when profile loads
  const currentHandle = profile?.handle || profile?.name?.toLowerCase().replace(/\s+/g, '') || 'fighter';
  const currentBio = profile?.bio || '';

  useEffect(() => {
    if (profile?.bio !== undefined) {
      setEditedBio(profile.bio || '');
    }
  }, [profile?.bio]);

  const profilePhoto = profile?.avatar_url || null;

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !authUser?.id) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${authUser.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const urlWithCacheBuster = `${publicUrl}?t=${Date.now()}`;
      await updateProfile.mutateAsync({ avatar_url: urlWithCacheBuster });

      toast.success('Profile photo updated!');
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('Failed to upload photo');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSaveName = async () => {
    const trimmed = editedName.trim();
    
    if (!trimmed || trimmed.length < 1) {
      toast.error('Name cannot be empty');
      setIsEditingName(false);
      return;
    }
    
    if (trimmed.length > 100) {
      toast.error('Name must be 100 characters or less');
      return;
    }
    
    if (trimmed !== user?.name) {
      updateUser({ name: trimmed });
      await updateProfile.mutateAsync({ name: trimmed });
      toast.success('Name updated!');
    }
    setIsEditingName(false);
  };

  const handleSaveHandle = async () => {
    const cleanHandle = editedHandle.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    
    if (cleanHandle.length > 0 && cleanHandle.length < 3) {
      toast.error('Handle must be at least 3 characters');
      return;
    }
    
    if (cleanHandle.length > 30) {
      toast.error('Handle must be 30 characters or less');
      return;
    }
    
    if (cleanHandle && cleanHandle !== currentHandle) {
      try {
        await updateProfile.mutateAsync({ handle: cleanHandle });
        toast.success('Handle updated!');
      } catch (error: any) {
        if (error?.message?.includes('unique') || error?.code === '23505') {
          toast.error('This handle is already taken');
          return;
        }
        if (error?.message?.includes('check') || error?.code === '23514') {
          toast.error('Handle format is invalid');
          return;
        }
        toast.error('Failed to update handle');
      }
    }
    setIsEditingHandle(false);
  };

  const handleSaveBio = async () => {
    if (editedBio !== currentBio) {
      try {
        await updateProfile.mutateAsync({ bio: editedBio.trim() });
        toast.success('Bio updated!');
      } catch (error) {
        toast.error('Failed to update bio');
      }
    }
    setIsEditingBio(false);
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

  const joinedDate = profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A';

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-red-glow">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 pt-8 pb-6 safe-top">
          <button onClick={() => navigate(-1)} className="text-muted-foreground">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-black text-foreground tracking-wider">
            EDIT PROFILE
          </h1>
        </header>

        <div className="px-4 space-y-6 pb-24">
          {/* Profile Photo & Name */}
          <div className="card-workout">
            <div className="flex items-center gap-4 mb-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-volt/20 flex items-center justify-center overflow-hidden">
                  {profilePhoto ? (
                    <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-volt" />
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
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-volt flex items-center justify-center text-primary-foreground shadow-lg disabled:opacity-50"
                >
                  <Camera className="w-4 h-4" />
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
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="bg-surface-2 border-surface-3 text-foreground"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                    />
                    <button 
                      onClick={handleSaveName}
                      className="w-8 h-8 rounded-full bg-volt flex items-center justify-center text-primary-foreground"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-foreground">{user?.name || 'Fighter'}</h2>
                    <button 
                      onClick={() => {
                        setEditedName(user?.name || '');
                        setIsEditingName(true);
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {/* Handle editing */}
                {isEditingHandle ? (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-muted-foreground">@</span>
                    <Input
                      value={editedHandle}
                      onChange={(e) => setEditedHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      className="bg-surface-2 border-surface-3 text-foreground h-8 text-sm"
                      placeholder="yourhandle"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveHandle()}
                    />
                    <button 
                      onClick={handleSaveHandle}
                      className="w-6 h-6 rounded-full bg-volt flex items-center justify-center text-primary-foreground"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 mt-1">
                    <p className="text-sm text-muted-foreground">@{currentHandle}</p>
                    <button 
                      onClick={() => {
                        setEditedHandle(currentHandle);
                        setIsEditingHandle(true);
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Info Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-2 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Joined</p>
                <p className="font-semibold text-foreground">{joinedDate}</p>
              </div>
              <div className="bg-surface-2 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                <p className="font-semibold text-volt">ACTIVE</p>
              </div>
            </div>
            {authUser?.email && (
              <div className="bg-surface-2 rounded-lg p-3 mt-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Email</p>
                <p className="font-semibold text-foreground text-sm truncate">{authUser.email}</p>
              </div>
            )}
          </div>

          {/* Body Metrics */}
          <div className="card-workout">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-foreground">Body Metrics</h3>
              <button
                onClick={() => {
                  const switching = !useImperial;
                  // Convert displayed values
                  if (weightInput) {
                    const w = parseFloat(weightInput);
                    if (!isNaN(w)) setWeightInput(Math.round(switching ? w * 2.20462 : w / 2.20462).toString());
                  }
                  if (switching) {
                    // metric -> imperial: convert cm to ft/in
                    const cm = parseFloat(heightCm);
                    if (!isNaN(cm) && cm > 0) {
                      const totalInches = cm / 2.54;
                      setHeightFt(Math.floor(totalInches / 12).toString());
                      setHeightIn(Math.round(totalInches % 12).toString());
                    }
                  } else {
                    // imperial -> metric: convert ft/in to cm
                    const ft = parseFloat(heightFt) || 0;
                    const inches = parseFloat(heightIn) || 0;
                    const cm = Math.round((ft * 12 + inches) * 2.54);
                    if (cm > 0) setHeightCm(cm.toString());
                  }
                  setUseImperial(switching);
                }}
                className="text-xs text-volt font-medium"
              >
                {useImperial ? 'Switch to kg/cm' : 'Switch to lbs/ft'}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Used for more accurate calorie estimates</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Weight ({useImperial ? 'lbs' : 'kg'})
                </label>
                <Input
                  type="number"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  onBlur={async () => {
                    const val = parseFloat(weightInput);
                    if (!isNaN(val) && val > 0) {
                      const kg = useImperial ? Math.round(val / 2.20462 * 10) / 10 : val;
                      await updateProfile.mutateAsync({ weight_kg: kg } as any);
                    }
                  }}
                  placeholder={useImperial ? '165' : '75'}
                  className="bg-surface-2 border-surface-3 text-foreground"
                />
              </div>
              {useImperial ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Height (ft)</label>
                    <Input
                      type="number"
                      value={heightFt}
                      onChange={(e) => setHeightFt(e.target.value)}
                      onBlur={async () => {
                        const ft = parseFloat(heightFt) || 0;
                        const inches = parseFloat(heightIn) || 0;
                        const cm = Math.round((ft * 12 + inches) * 2.54 * 10) / 10;
                        if (cm > 0) await updateProfile.mutateAsync({ height_cm: cm } as any);
                      }}
                      placeholder="5"
                      className="bg-surface-2 border-surface-3 text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Height (in)</label>
                    <Input
                      type="number"
                      value={heightIn}
                      onChange={(e) => setHeightIn(e.target.value)}
                      onBlur={async () => {
                        const ft = parseFloat(heightFt) || 0;
                        const inches = parseFloat(heightIn) || 0;
                        const cm = Math.round((ft * 12 + inches) * 2.54 * 10) / 10;
                        if (cm > 0) await updateProfile.mutateAsync({ height_cm: cm } as any);
                      }}
                      placeholder="10"
                      className="bg-surface-2 border-surface-3 text-foreground"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Height (cm)</label>
                  <Input
                    type="number"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    onBlur={async () => {
                      const val = parseFloat(heightCm);
                      if (!isNaN(val) && val > 0) {
                        await updateProfile.mutateAsync({ height_cm: val } as any);
                      }
                    }}
                    placeholder="175"
                    className="bg-surface-2 border-surface-3 text-foreground"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Bio Section */}
          <div className="card-workout">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-foreground">Bio</h3>
              {!isEditingBio && (
                <button 
                  onClick={() => setIsEditingBio(true)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
            {isEditingBio ? (
              <div className="space-y-3">
                <textarea
                  value={editedBio}
                  onChange={(e) => setEditedBio(e.target.value)}
                  className="w-full bg-surface-2 border border-surface-3 rounded-lg p-3 text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-volt"
                  placeholder="Tell others about yourself..."
                  rows={3}
                  maxLength={160}
                  autoFocus
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{editedBio.length}/160</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setEditedBio(currentBio);
                        setIsEditingBio(false);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-surface-2 text-muted-foreground text-sm"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSaveBio}
                      className="px-3 py-1.5 rounded-lg bg-volt text-primary-foreground text-sm font-medium"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                {currentBio || 'Add a bio to tell others about yourself...'}
              </p>
            )}
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
                <div className="text-left">
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

export default EditProfile;
