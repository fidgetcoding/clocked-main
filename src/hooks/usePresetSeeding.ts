import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useQueryClient } from '@tanstack/react-query';
import { generateLoadoutWorkout, UserEquipmentConfig } from '@/lib/loadoutGenerator';

/**
 * This hook seeds a single loadout workout for new users based on their
 * experience level and equipment. It runs once — if the user already has
 * workouts, it does nothing.
 */
export function usePresetSeeding() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const hasSeededRef = useRef(false);

  useEffect(() => {
    if (!user?.id || !profile || hasSeededRef.current) return;

    const seedLoadout = async () => {
      try {
        // Check if user already has workouts
        const { data: existingWorkouts, error: fetchError } = await supabase
          .from('workouts')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);

        if (fetchError) {
          console.error('Error checking existing workouts:', fetchError);
          return;
        }

        // If user already has workouts, don't seed
        if (existingWorkouts && existingWorkouts.length > 0) {
          hasSeededRef.current = true;
          return;
        }

        // Build equipment config from profile
        const eq = (profile.equipment as Record<string, any>) || {};
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

        // Insert the single loadout workout
        const { error: insertError } = await supabase
          .from('workouts')
          .insert([{
            user_id: user.id,
            name: loadout.name,
            description: loadout.description,
            duration: loadout.duration,
            difficulty: loadout.difficulty,
            phases: loadout.phases as any,
            combos: loadout.combos as any,
            tags: loadout.tags,
            is_preset: loadout.is_preset,
            is_archived: false,
            times_completed: 0,
          }]);

        if (insertError) {
          console.error('Error seeding loadout:', insertError);
          return;
        }

        hasSeededRef.current = true;
        console.log(`Seeded ${loadout.name} for user`);
        
        queryClient.invalidateQueries({ queryKey: ['workouts', user.id] });
      } catch (error) {
        console.error('Error in loadout seeding:', error);
      }
    };

    seedLoadout();
  }, [user?.id, profile, queryClient]);
}
