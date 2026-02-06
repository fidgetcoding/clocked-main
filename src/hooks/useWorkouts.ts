import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DbWorkout {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  duration: number;
  difficulty: string | null;
  phases: any[];
  combos: string[][];
  tags: string[];
  is_preset: boolean;
  is_archived: boolean;
  times_completed: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useWorkouts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: workouts = [], isLoading, error } = useQuery({
    queryKey: ['workouts', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data as DbWorkout[];
    },
    enabled: !!user?.id,
  });

  const addWorkout = useMutation({
    mutationFn: async (workout: Omit<DbWorkout, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('workouts')
        .insert({ ...workout, user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data as DbWorkout;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts', user?.id] });
    },
  });

  const updateWorkout = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DbWorkout> & { id: string }) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('workouts')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data as DbWorkout;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts', user?.id] });
    },
  });

  const deleteWorkout = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('workouts')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts', user?.id] });
    },
  });

  const archiveWorkout = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('workouts')
        .update({ is_archived: true })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data as DbWorkout;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts', user?.id] });
    },
  });

  return {
    workouts,
    isLoading,
    error,
    addWorkout,
    updateWorkout,
    deleteWorkout,
    archiveWorkout,
  };
}
