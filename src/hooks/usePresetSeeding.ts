import { toJson } from '@/lib/json';
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useQueryClient } from '@tanstack/react-query';
import { generateLoadoutWorkout, UserEquipmentConfig } from '@/lib/loadoutGenerator';
import { useUserStore } from '@/stores/userStore';
import { useWorkoutStore } from '@/stores/workoutStore';

/**
 * This hook seeds a single loadout workout for new users based on their
 * experience level and equipment. It runs once per account (and once for the
 * guest) — if the user already has workouts, it does nothing.
 */
export function usePresetSeeding() {
  const { user, isGuest } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  // Whose seed has run or is running. Per person, so signing into another account after a guest
  // session (or switching accounts) still seeds the new one, and a profile refresh mid-seed can't start a second.
  const seededFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isGuest || !profile || seededFor.current === 'guest') return;
    if (!useUserStore.getState().hasCompletedOnboarding) return;

    seededFor.current = 'guest';
    const { guestWorkouts, addGuestWorkout } = useWorkoutStore.getState();
    if (guestWorkouts.length > 0) return;

    const eq = (profile.equipment || {}) as unknown as UserEquipmentConfig;
    const loadout = generateLoadoutWorkout(profile.experience_level || 'beginner', {
      gloves: !!eq.gloves,
      wraps: !!eq.wraps,
      jumpRope: !!eq.jumpRope,
      heavyBag: !!eq.heavyBag,
      doubleEndBag: !!eq.doubleEndBag,
      speedBag: !!eq.speedBag,
      treadmill: !!eq.treadmill,
      primaryBag: eq.primaryBag || 'none',
    });
    addGuestWorkout({
      name: loadout.name,
      description: loadout.description,
      duration: loadout.duration,
      difficulty: loadout.difficulty,
      phases: loadout.phases,
      combos: loadout.combos,
      tags: loadout.tags,
      is_preset: loadout.is_preset,
      is_archived: false,
      times_completed: 0,
      last_used_at: null,
    });
  }, [isGuest, profile]);

  useEffect(() => {
    if (isGuest || !user?.id || !profile || seededFor.current === user.id) return;
    const accountId = user.id;
    seededFor.current = accountId;

    const seedLoadout = async () => {
      try {
        // Build equipment config from profile
        const eq = (profile.equipment || {}) as unknown as UserEquipmentConfig;
        const loadoutEquipment: UserEquipmentConfig = {
          gloves: !!eq.gloves,
          wraps: !!eq.wraps,
          jumpRope: !!eq.jumpRope,
          heavyBag: !!eq.heavyBag,
          doubleEndBag: !!eq.doubleEndBag,
          speedBag: !!eq.speedBag,
          treadmill: !!eq.treadmill,
          primaryBag: eq.primaryBag || 'none',
        };

        const experienceLevel = profile.experience_level || 'beginner';
        const loadout = generateLoadoutWorkout(experienceLevel, loadoutEquipment);

        // Added only if the account still has no workouts, checked on the server under a per-account lock,
        // so two tabs signing in at once get one starter workout between them
        const { data: seeded, error: seedError } = await supabase.rpc('seed_first_workout', {
          seed: toJson({
            name: loadout.name,
            description: loadout.description,
            duration: loadout.duration,
            difficulty: loadout.difficulty,
            phases: loadout.phases,
            combos: loadout.combos,
            tags: loadout.tags,
          }),
        });

        if (seedError) {
          console.error('Error seeding loadout:', seedError);
          // Let a later render try again
          if (seededFor.current === accountId) seededFor.current = null;
          return;
        }

        if (seeded) queryClient.invalidateQueries({ queryKey: ['workouts', accountId] });
      } catch (error) {
        console.error('Error in loadout seeding:', error);
        if (seededFor.current === accountId) seededFor.current = null;
      }
    };

    seedLoadout();
  }, [isGuest, user?.id, profile, queryClient]);
}
