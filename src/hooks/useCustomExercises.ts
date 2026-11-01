import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkoutStore } from '@/stores/workoutStore';

export interface CustomExercise {
  id: string;
  name: string;
  category: string;
  created_at: string;
}

export function useCustomExercises() {
  const { user, isGuest } = useAuth();
  const queryClient = useQueryClient();
  const guestExercises = useWorkoutStore((state) => state.guestExercises);

  const { data: dbExercises = [], isLoading } = useQuery({
    queryKey: ['custom-exercises', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('custom_exercises')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      if (error) throw error;
      return data as CustomExercise[];
    },
    enabled: !!user,
  });

  const exercises = isGuest ? guestExercises : dbExercises;

  const addExercise = useMutation({
    mutationFn: async ({ name, category = 'Custom' }: { name: string; category?: string }) => {
      if (isGuest) return useWorkoutStore.getState().addGuestExercise(name, category);
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('custom_exercises')
        .insert({ user_id: user.id, name, category });
      if (error) {
        // Unique constraint violation = already exists
        if (error.code === '23505') return;
        throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custom-exercises'] }),
  });

  const removeExercise = useMutation({
    mutationFn: async (id: string) => {
      if (isGuest) return useWorkoutStore.getState().removeGuestExercise(id);
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('custom_exercises')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custom-exercises'] }),
  });

  const isInLibrary = (name: string) =>
    exercises.some((e) => e.name.toLowerCase() === name.toLowerCase());

  return { exercises, isLoading, addExercise, removeExercise, isInLibrary };
}
