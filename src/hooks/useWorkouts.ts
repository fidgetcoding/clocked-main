import type { Database } from '@/integrations/supabase/types';
import { toJson } from '@/lib/json';
import { normalizeStoredCombos, normalizeStoredPhases, type StoredPhase } from '@/lib/storedPhases';
import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { useWorkoutStore } from '@/stores/workoutStore';

export interface DbWorkout {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  duration: number;
  difficulty: string | null;
  phases: StoredPhase[];
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

const toDbWorkout = (row: Database['public']['Tables']['workouts']['Row']): DbWorkout => ({
  ...row,
  // Checked here rather than trusted: a damaged row shouldn't take the home screen down with it
  phases: normalizeStoredPhases(row.phases),
  combos: normalizeStoredCombos(row.combos),
});

export function useWorkouts() {
  const { user, isGuest } = useAuth();
  const queryClient = useQueryClient();
  const guestRows = useWorkoutStore((state) => state.guestWorkouts);

  const { data: dbWorkouts = [], isLoading, error } = useQuery({
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
      return data.map(toDbWorkout);
    },
    enabled: !!user?.id,
  });

  const guestWorkouts = useMemo(
    () => guestRows.filter((w) => !w.is_archived).sort((a, b) => a.sort_order - b.sort_order),
    [guestRows]
  );
  const workouts = isGuest ? guestWorkouts : dbWorkouts;

  const { data: dbArchivedWorkouts = [] } = useQuery({
    queryKey: ['workouts', user?.id, 'archived'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_archived', true)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(toDbWorkout);
    },
    enabled: !!user?.id && !isGuest,
  });
  const archivedWorkouts = useMemo(
    () => (isGuest ? guestRows.filter((w) => w.is_archived) : dbArchivedWorkouts),
    [isGuest, guestRows, dbArchivedWorkouts],
  );

  const addWorkout = useMutation({
    mutationFn: async (workout: Omit<DbWorkout, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'sort_order'>) => {
      if (isGuest) return useWorkoutStore.getState().addGuestWorkout(workout);
      if (!user?.id) throw new Error('Not authenticated');
      
      // Get max sort_order for this user
      const { data: maxOrder } = await supabase
        .from('workouts')
        .select('sort_order')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      const newSortOrder = (maxOrder?.sort_order ?? 0) + 1;
      
      const { data, error } = await supabase
        .from('workouts')
        .insert({ ...workout, phases: toJson(workout.phases), user_id: user.id, sort_order: newSortOrder })
        .select()
        .single();
      
      if (error) throw error;
      return toDbWorkout(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts', user?.id] });
    },
  });

  const updateWorkout = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DbWorkout> & { id: string }) => {
      if (isGuest) return useWorkoutStore.getState().updateGuestWorkout(id, updates);
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('workouts')
        .update({ ...updates, phases: updates.phases && toJson(updates.phases) })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return toDbWorkout(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts', user?.id] });
    },
  });

  // One more completed run, added on the server so another tab's count isn't overwritten
  const countCompletion = useMutation({
    mutationFn: async (id: string) => {
      if (isGuest) {
        const { guestWorkouts, updateGuestWorkout } = useWorkoutStore.getState();
        const current = guestWorkouts.find((workout) => workout.id === id);
        if (!current) return;
        updateGuestWorkout(id, { times_completed: (current.times_completed || 0) + 1, last_used_at: new Date().toISOString() });
        return;
      }
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase.rpc('count_workout_completion', { target_workout_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts', user?.id] });
    },
  });

  const deleteWorkout = useMutation({
    mutationFn: async (id: string) => {
      if (isGuest) return useWorkoutStore.getState().deleteGuestWorkout(id);
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
      if (isGuest) return useWorkoutStore.getState().updateGuestWorkout(id, { is_archived: true });
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('workouts')
        .update({ is_archived: true })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return toDbWorkout(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts', user?.id] });
    },
  });

  const reorderWorkouts = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      if (isGuest) return useWorkoutStore.getState().reorderGuestWorkouts(orderedIds);
      if (!user?.id) throw new Error('Not authenticated');
      
      // One statement on the server: the whole new order is saved, or none of it
      const { error } = await supabase.rpc('reorder_workouts', { ordered_ids: orderedIds });
      if (error) throw error;
    },
    // Back to the saved order after a failure, and the confirmed one after a success
    onSettled: () => {
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
    archivedWorkouts,
    reorderWorkouts,
    countCompletion,
  };
}
