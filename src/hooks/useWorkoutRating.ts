import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import type { RatingSummary } from '@/lib/ratings';

const summaryQuery = (workoutId: string, signedIn: boolean) => ({
  queryKey: ['workout-rating', workoutId],
  queryFn: async (): Promise<RatingSummary | null> => {
    const { data, error } = await supabase.rpc('get_workout_rating_summary', { target_workout_id: workoutId });
    if (error) throw error;
    return data?.[0] ?? null;
  },
  enabled: signedIn,
});

/** Summaries for a list of workouts, keyed by workout ID. */
export function useRatingSummaries(workoutIds: string[]): Record<string, RatingSummary | null | undefined> {
  const { user } = useAuth();
  const results = useQueries({ queries: workoutIds.map((id) => summaryQuery(id, !!user)) });
  return Object.fromEntries(workoutIds.map((id, index) => [id, results[index]?.data]));
}

/** One workout's rating: the average, yours, and a way to set yours. */
export function useWorkoutRating(workoutId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: summary } = useQuery(summaryQuery(workoutId, !!user));

  const { data: myRating = 0 } = useQuery({
    queryKey: ['my-workout-rating', workoutId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_ratings')
        .select('rating')
        .eq('workout_id', workoutId)
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.rating ?? 0;
    },
    enabled: !!user,
  });

  const rate = useMutation({
    mutationFn: async (stars: number) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('workout_ratings')
        .upsert({ user_id: user.id, workout_id: workoutId, rating: stars }, { onConflict: 'user_id,workout_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout-rating', workoutId] });
      queryClient.invalidateQueries({ queryKey: ['my-workout-rating', workoutId] });
    },
  });

  return { summary, myRating, rate };
}
