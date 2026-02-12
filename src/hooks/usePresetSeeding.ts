import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useQueryClient } from '@tanstack/react-query';
import { 
  COMPLETE_BEGINNER_PRESET_WORKOUTS, 
  BEGINNER_PRESET_WORKOUTS, 
  INTERMEDIATE_PRESET_WORKOUTS, 
  ADVANCED_PRESET_WORKOUTS, 
  PRO_PRESET_WORKOUTS, 
  COACH_PRESET_WORKOUTS 
} from '@/data/presetWorkouts';
import { Workout } from '@/types';

// Map preset names to their combo data for migration
const PRESET_COMBOS_MAP: Record<string, string[][]> = {};
[
  ...COMPLETE_BEGINNER_PRESET_WORKOUTS,
  ...BEGINNER_PRESET_WORKOUTS,
  ...INTERMEDIATE_PRESET_WORKOUTS,
  ...ADVANCED_PRESET_WORKOUTS,
  ...PRO_PRESET_WORKOUTS,
  ...COACH_PRESET_WORKOUTS,
].forEach(preset => {
  PRESET_COMBOS_MAP[preset.name] = preset.combos || [];
});

/**
 * This hook seeds preset workouts for new users based on their experience level.
 * It also migrates existing preset workouts to add missing combos.
 */
export function usePresetSeeding() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const hasSeededRef = useRef(false);
  const hasMigratedCombosRef = useRef(false);

  useEffect(() => {
    if (!user?.id || !profile || hasSeededRef.current) return;

    const seedPresets = async () => {
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

        // Determine which presets to load based on role and experience level
        let presets: Workout[] = [];
        
        if (profile.role === 'coach') {
          presets = COACH_PRESET_WORKOUTS;
        } else {
          const level = profile.experience_level;
          if (level === 'complete_beginner') {
            presets = COMPLETE_BEGINNER_PRESET_WORKOUTS;
          } else if (level === 'beginner') {
            presets = BEGINNER_PRESET_WORKOUTS;
          } else if (level === 'intermediate') {
            presets = INTERMEDIATE_PRESET_WORKOUTS;
          } else if (level === 'advanced') {
            presets = ADVANCED_PRESET_WORKOUTS;
          } else if (level === 'pro') {
            presets = PRO_PRESET_WORKOUTS;
          } else {
            // Default to beginner
            presets = BEGINNER_PRESET_WORKOUTS;
          }
        }

        // Convert presets to database format and insert
        const workoutsToInsert = presets.map(preset => ({
          user_id: user.id,
          name: preset.name,
          description: null,
          duration: preset.totalDuration,
          difficulty: preset.difficulty,
          phases: JSON.parse(JSON.stringify([
            ...preset.sections.warmup.map(p => ({ ...p, section: 'warmup' })),
            ...preset.sections.grind.map(p => ({ ...p, section: 'grind' })),
            ...preset.sections.cooldown.map(p => ({ ...p, section: 'cooldown' })),
          ])),
          combos: preset.combos || [],
          tags: ['boxing', preset.difficulty],
          is_preset: true,
          is_archived: false,
          times_completed: 0,
        }));

        const { error: insertError } = await supabase
          .from('workouts')
          .insert(workoutsToInsert);

        if (insertError) {
          console.error('Error seeding presets:', insertError);
          return;
        }

        hasSeededRef.current = true;
        console.log(`Seeded ${workoutsToInsert.length} preset workouts for user`);
        
        // Invalidate workouts query so the UI refreshes with seeded workouts
        queryClient.invalidateQueries({ queryKey: ['workouts', user.id] });
      } catch (error) {
        console.error('Error in preset seeding:', error);
      }
    };

    seedPresets();
  }, [user?.id, profile]);

  // Migrate existing workouts to add missing combos
  useEffect(() => {
    if (!user?.id || hasMigratedCombosRef.current) return;

    const migrateCombos = async () => {
      try {
        // Fetch preset workouts that might be missing combos
        const { data: presetWorkouts, error } = await supabase
          .from('workouts')
          .select('id, name, combos')
          .eq('user_id', user.id)
          .eq('is_preset', true);

        if (error) {
          console.error('Error fetching workouts for migration:', error);
          return;
        }

        if (!presetWorkouts || presetWorkouts.length === 0) {
          hasMigratedCombosRef.current = true;
          return;
        }

        // Find workouts that need combos updated
        const workoutsToUpdate = presetWorkouts.filter(w => {
          const existingCombos = w.combos as string[][] | null;
          const presetCombos = PRESET_COMBOS_MAP[w.name];
          // Update if no combos or empty combos, and we have preset combos for this workout
          return presetCombos && presetCombos.length > 0 && (!existingCombos || existingCombos.length === 0);
        });

        if (workoutsToUpdate.length === 0) {
          hasMigratedCombosRef.current = true;
          return;
        }

        // Update each workout with its combos
        for (const workout of workoutsToUpdate) {
          const combos = PRESET_COMBOS_MAP[workout.name];
          if (combos) {
            await supabase
              .from('workouts')
              .update({ combos })
              .eq('id', workout.id);
          }
        }

        console.log(`Migrated combos for ${workoutsToUpdate.length} preset workouts`);
        hasMigratedCombosRef.current = true;
        
        // Invalidate workouts query to refresh UI
        queryClient.invalidateQueries({ queryKey: ['workouts', user.id] });
      } catch (error) {
        console.error('Error migrating combos:', error);
      }
    };

    migrateCombos();
  }, [user?.id, queryClient]);
}
