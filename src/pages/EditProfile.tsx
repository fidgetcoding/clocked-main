import { useLatest } from '@/hooks/useLatest';
import { useState, useRef, useEffect } from 'react';
import { Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { BroadcastPage, FitText, OnAir, SectionRule } from '@/components/broadcast';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { GloveArt } from '@/components/ui/GameArt';
import { Input } from '@/components/ui/input';
import { useUserStore } from '@/stores/userStore';
import { useWorkouts } from '@/hooks/useWorkouts';
import { useAuth } from '@/contexts/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { promptEmailLink } from '@/lib/guest';
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
  const { archivedWorkouts, updateWorkout, deleteWorkout } = useWorkouts();
  const { user: authUser, isGuest } = useAuth();
  const { profile, updateProfile } = useProfile();
  // The profile row is the record. The local copy can lag behind a change made on another device.
  const currentName = profile?.name || user?.name || 'Fighter';
  
  const [showArchives, setShowArchives] = useState(false);
  const [workoutToDelete, setWorkoutToDelete] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingHandle, setIsEditingHandle] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedHandle, setEditedHandle] = useState(profile?.handle || '');
  const [editedBio, setEditedBio] = useState(profile?.bio || '');
  const [useImperial, setUseImperial] = useState(true);
  const [weightInput, setWeightInput] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize weight/height from profile
  const useImperialRef = useLatest(useImperial);
  const savedWeightKg = profile?.weight_kg;
  const savedHeightCm = profile?.height_cm;
  useEffect(() => {
    const useImperial = useImperialRef.current;
    if (savedWeightKg || savedHeightCm) {
      if (savedWeightKg) {
        setWeightInput(useImperial ? Math.round(savedWeightKg * 2.20462).toString() : savedWeightKg.toString());
      }
      if (savedHeightCm) {
        if (useImperial) {
          const totalInches = savedHeightCm / 2.54;
          setHeightFt(Math.floor(totalInches / 12).toString());
          setHeightIn(Math.round(totalInches % 12).toString());
        } else {
          setHeightCm(savedHeightCm.toString());
        }
      }
    }
  }, [savedWeightKg, savedHeightCm, useImperialRef]);

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
    e.target.value = ''; // So picking the same file again still fires a change
    if (file && isGuest) {
      promptEmailLink('add a profile photo');
      return;
    }
    if (!file || !authUser?.id) return;

    // Same list the avatars bucket enforces, so a GIF or HEIC gets a clear message here
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Please select a JPEG, PNG or WebP image');
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
    
    if (trimmed !== currentName) {
      try {
        await updateProfile.mutateAsync({ name: trimmed });
      } catch {
        toast.error('Failed to update name');
        return;
      }
      updateUser({ name: trimmed });
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
      } catch (caught) {
        const error = caught as { message?: string; code?: string };
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
    updateWorkout.mutate({ id, is_archived: false }, {
      onSuccess: () => toast.success('Workout restored to your sets'),
      onError: () => toast.error('Failed to restore workout'),
    });
  };

  const handlePermanentDelete = () => {
    if (workoutToDelete) {
      deleteWorkout.mutate(workoutToDelete, {
        onSuccess: () => toast.success('Workout permanently deleted'),
        onError: () => toast.error('Failed to delete workout'),
      });
      setWorkoutToDelete(null);
    }
  };

  // Saved as the field loses focus, so a refusal has nowhere else to show
  const saveBodyMetric = async (updates: { weight_kg?: number; height_cm?: number }) => {
    try {
      await updateProfile.mutateAsync(updates);
    } catch {
      toast.error("Couldn't save that. Check the number and try again.");
    }
  };

  const joinedDate = profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A';

  return (
    <AppLayout>
      <BroadcastPage onBack={() => navigate('/profile')}>
        <h1 className="px-4 pt-3">
          <FitText className="fx h-[clamp(3rem,15vw,5rem)]" max={80}>EDIT PROFILE</FitText>
        </h1>

        {/* The name graphic: photo, name, handle */}
        <section className="mt-3 flex items-stretch gap-3 bg-surface-1 py-3 pl-4 pr-4">
          <div className="relative size-24 shrink-0 sm:size-28">
            <div className="art-slant h-full w-full [clip-path:polygon(24.9%_0,100%_0,75.1%_100%,0_100%)]">
              {profilePhoto ? (
                <img src={profilePhoto} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <GloveArt id="default" className="art-off h-full w-full" />
              )}
            </div>
            {isUploadingPhoto && (
              <span className="lab lab-w absolute inset-x-0 top-1/2 -translate-y-1/2 text-center">Uploading</span>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingPhoto}
              aria-label="Change photo"
              className="plate plate-lime absolute -bottom-1 -right-1 h-11 w-12 disabled:opacity-50"
            >
              <Camera className="size-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
            {isEditingName ? (
              <div className="flex items-center gap-3">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  maxLength={30}
                  aria-label="Name"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                />
                <Button size="sm" onClick={handleSaveName} aria-label="Save name" className="shrink-0">Save</Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <h2 className="fx line-clamp-2 min-w-0 flex-1 py-1 text-3xl [overflow-wrap:anywhere] sm:text-4xl">{currentName}</h2>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label="Edit name"
                  className="shrink-0"
                  onClick={() => {
                    setEditedName(currentName);
                    setIsEditingName(true);
                  }}
                >
                  Edit
                </Button>
              </div>
            )}
            {isEditingHandle ? (
              <div className="flex items-center gap-2">
                <span className="lab lab-w">@</span>
                <Input
                  value={editedHandle}
                  onChange={(e) => setEditedHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="yourhandle"
                  aria-label="Handle"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveHandle()}
                />
                <Button size="sm" onClick={handleSaveHandle} aria-label="Save handle" className="shrink-0">Save</Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <p className="lab lab-w min-w-0 flex-1 truncate normal-case">@{currentHandle}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label="Edit handle"
                  className="shrink-0"
                  onClick={() => {
                    setEditedHandle(currentHandle);
                    setIsEditingHandle(true);
                  }}
                >
                  Edit
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* Info Row */}
        <div className="grid grid-cols-2 border-b border-surface-2">
          <div className="px-4 py-2">
            <p className="lab">Joined</p>
            <p className="fx mt-1 text-2xl">{joinedDate}</p>
          </div>
          <div className="px-4 py-2">
            <p className="lab">Status</p>
            <OnAir state="on" className="mt-1.5">ACTIVE</OnAir>
          </div>
        </div>
        {authUser?.email && (
          <div className="border-b border-surface-2 px-4 py-2">
            <p className="lab">Email</p>
            <p className="prose-w mt-0.5 truncate text-lg">{authUser.email}</p>
          </div>
        )}

        {/* Body Metrics */}
        <section>
          <SectionRule title="Body Metrics" className="border-0" />
          <div className="flex items-center justify-between gap-3 px-4">
            <p className="lab">Used for more accurate calorie estimates</p>
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
                className="lab lab-lime min-h-11 whitespace-nowrap"
              >
                {useImperial ? 'Switch to kg/cm' : 'Switch to lbs/ft'}
              </button>
          </div>
            <div className="grid grid-cols-2 items-end gap-4 px-4 pt-1">
              <div>
                <label className="lab block">
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
                      await saveBodyMetric({ weight_kg: kg });
                    }
                  }}
                  placeholder={useImperial ? '165' : '75'}
                />
              </div>
              {useImperial ? (
                <div className="grid grid-cols-2 items-end gap-2">
                  <div>
                    <label className="lab block">Height (ft)</label>
                    <Input
                      type="number"
                      value={heightFt}
                      onChange={(e) => setHeightFt(e.target.value)}
                      onBlur={async () => {
                        const ft = parseFloat(heightFt) || 0;
                        const inches = parseFloat(heightIn) || 0;
                        const cm = Math.round((ft * 12 + inches) * 2.54 * 10) / 10;
                        if (cm > 0) await saveBodyMetric({ height_cm: cm });
                      }}
                      placeholder="5"
                    />
                  </div>
                  <div>
                    <label className="lab block">Height (in)</label>
                    <Input
                      type="number"
                      value={heightIn}
                      onChange={(e) => setHeightIn(e.target.value)}
                      onBlur={async () => {
                        const ft = parseFloat(heightFt) || 0;
                        const inches = parseFloat(heightIn) || 0;
                        const cm = Math.round((ft * 12 + inches) * 2.54 * 10) / 10;
                        if (cm > 0) await saveBodyMetric({ height_cm: cm });
                      }}
                      placeholder="10"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="lab block">Height (cm)</label>
                  <Input
                    type="number"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    onBlur={async () => {
                      const val = parseFloat(heightCm);
                      if (!isNaN(val) && val > 0) {
                        await saveBodyMetric({ height_cm: val });
                      }
                    }}
                    placeholder="175"
                  />
                </div>
              )}
            </div>
        </section>

        {/* Bio Section */}
        <section className="pt-2">
          <div className="flex items-center justify-between gap-3 px-4 pt-2">
            <h3 className="fx text-2xl">Bio</h3>
            {!isEditingBio && (
              <Button variant="secondary" size="sm" aria-label="Edit bio" onClick={() => setIsEditingBio(true)}>Edit</Button>
            )}
          </div>
          {isEditingBio ? (
            <div className="space-y-2 px-4 pt-1">
              <textarea
                value={editedBio}
                onChange={(e) => setEditedBio(e.target.value)}
                className="field-rule resize-none text-lg"
                placeholder="Tell others about yourself..."
                aria-label="Bio"
                rows={3}
                maxLength={160}
                autoFocus
              />
              <div className="flex items-center justify-between gap-3">
                <span className="lab">{editedBio.length}/160</span>
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setEditedBio(currentBio);
                      setIsEditingBio(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveBio}>Save</Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="prose-w px-4 pt-1 text-lg">
              {currentBio || 'Add a bio to tell others about yourself...'}
            </p>
          )}
        </section>

        {/* Archived Workouts */}
        <section className="pb-6 pt-4">
          <button
            type="button"
            onClick={() => setShowArchives(!showArchives)}
            aria-expanded={showArchives}
            className="flex min-h-14 w-full items-center justify-between gap-3 border-y border-surface-3 px-4 py-2 text-left transition-colors hover:bg-surface-1"
          >
            <span className="fx text-3xl">Archived Workouts</span>
            <span className="lab lab-w shrink-0">{archivedWorkouts.length} archived</span>
          </button>

          {showArchives && (
            archivedWorkouts.length === 0 ? (
              <p className="prose-w px-4 py-4 text-lg">No archived workouts</p>
            ) : (
              archivedWorkouts.map((workout) => (
                <div key={workout.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-surface-2 px-4 py-2.5">
                  <div className="min-w-0 flex-1 basis-32">
                    <p className="fx truncate text-2xl">{workout.name}</p>
                    <p className="lab mt-0.5">{workout.difficulty}</p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="steel" size="sm" title="Restore" onClick={() => handleRestore(workout.id)}>Restore</Button>
                    <Button variant="destructive" size="sm" title="Delete Forever" onClick={() => setWorkoutToDelete(workout.id)}>Delete Forever</Button>
                  </div>
                </div>
              ))
            )
          )}
        </section>
      </BroadcastPage>

      {/* Permanent Delete Confirmation */}
      <AlertDialog open={!!workoutToDelete} onOpenChange={() => setWorkoutToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Forever?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the workout. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePermanentDelete} className={buttonVariants({ variant: 'destructive' })}>
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default EditProfile;
