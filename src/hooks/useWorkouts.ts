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
  sort_order: number;
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
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as DbWorkout[];
    },
    enabled: !!user?.id,
  });

  const addWorkout = useMutation({
    mutationFn: async (workout: Omit<DbWorkout, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'sort_order'>) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      // Get max sort_order for this user
      const { data: maxOrder } = await supabase
        .from('workouts')
        .select('sort_order')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();
      
      const newSortOrder = (maxOrder?.sort_order ?? 0) + 1;
      
      const { data, error } = await supabase
        .from('workouts')
        .insert({ ...workout, user_id: user.id, sort_order: newSortOrder })
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

  const reorderWorkouts = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      // Update each workout's sort_order
      const updates = orderedIds.map((id, index) => 
        supabase
          .from('workouts')
          .update({ sort_order: index })
          .eq('id', id)
          .eq('user_id', user.id)
      );
      
      await Promise.all(updates);
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
    reorderWorkouts,
  };
}
