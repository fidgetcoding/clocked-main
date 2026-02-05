import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { 
  COMPLETE_BEGINNER_PRESET_WORKOUTS, 
  BEGINNER_PRESET_WORKOUTS, 
  INTERMEDIATE_PRESET_WORKOUTS, 
  ADVANCED_PRESET_WORKOUTS, 
  PRO_PRESET_WORKOUTS, 
  COACH_PRESET_WORKOUTS 
} from '@/data/presetWorkouts';
import { Workout } from '@/types';

/**
 * This hook seeds preset workouts for new users based on their experience level.
 * It runs once when a user first logs in and has no workouts in the database.
 */
export function usePresetSeeding() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const hasSeededRef = useRef(false);

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
      } catch (error) {
        console.error('Error in preset seeding:', error);
      }
    };

    seedPresets();
  }, [user?.id, profile]);
}
