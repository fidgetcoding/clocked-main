import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface WorkoutHistoryEntry {
  id: string;
  user_id: string;
  workout_id: string | null;
  workout_name: string;
  completed_at: string;
  duration: number;
  xp_earned: number;
  difficulty: string | null;
  notes: string | null;
  is_manual_entry: boolean;
  round_feedback: any[];
  created_at: string;
}

export function useWorkoutHistory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: history = [], isLoading, error } = useQuery({
    queryKey: ['workout-history', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('workout_history')
        .select('*')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false });
      
      if (error) throw error;
      return data as WorkoutHistoryEntry[];
    },
    enabled: !!user?.id,
  });

  const addHistoryEntry = useMutation({
    mutationFn: async (entry: Omit<WorkoutHistoryEntry, 'id' | 'user_id' | 'created_at'>) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('workout_history')
        .insert({ ...entry, user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data as WorkoutHistoryEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout-history', user?.id] });
    },
  });

  const updateHistoryEntry = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkoutHistoryEntry> & { id: string }) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('workout_history')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data as WorkoutHistoryEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout-history', user?.id] });
    },
  });

  const deleteHistoryEntry = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('workout_history')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout-history', user?.id] });
    },
  });

  return {
    history,
    isLoading,
    error,
    addHistoryEntry,
    updateHistoryEntry,
    deleteHistoryEntry,
  };
}
