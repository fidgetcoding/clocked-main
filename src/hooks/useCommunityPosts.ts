import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Workout } from '@/types';

export interface CommunityPost {
  id: string;
  user_id: string;
  type: 'workout_complete' | 'preset_shared' | 'rank_up' | 'streak_milestone';
  workout_id: string | null;
  workout_name: string | null;
  workout_data: Workout | null;
  message: string | null;
  likes: number;
  created_at: string;
  // Joined from profiles
  user_name?: string;
  user_avatar?: string;
}

export function useCommunityPosts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['community-posts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('community_posts')
        .select(`
          *,
          profiles!community_posts_user_id_fkey (
            name,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        // If the join fails (no FK constraint), fetch posts and profiles separately
        const { data: posts, error: postsError } = await supabase
          .from('community_posts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (postsError) throw postsError;

        // Fetch profiles for all user_ids
        const userIds = [...new Set(posts?.map(p => p.user_id) || [])];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name, avatar_url')
          .in('user_id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

        return (posts || []).map(post => ({
          ...post,
          workout_data: post.workout_data as unknown as Workout | null,
          user_name: profileMap.get(post.user_id)?.name || 'Fighter',
          user_avatar: profileMap.get(post.user_id)?.avatar_url || null,
        })) as CommunityPost[];
      }

      return (data || []).map(post => ({
        ...post,
        workout_data: post.workout_data as unknown as Workout | null,
        user_name: (post.profiles as any)?.name || 'Fighter',
        user_avatar: (post.profiles as any)?.avatar_url || null,
      })) as CommunityPost[];
    },
    enabled: !!user,
  });
}

export function useShareWorkout() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      workout, 
      message 
    }: { 
      workout: Workout; 
      message?: string;
    }) => {
      if (!user) throw new Error('Must be logged in to share');

      // Sanitize workout data - remove any user-specific info
      const sanitizedWorkout = {
        ...workout,
        id: workout.id,
        name: workout.name,
        icon: workout.icon,
        difficulty: workout.difficulty,
        totalDuration: workout.totalDuration,
        sections: workout.sections,
        combos: workout.combos,
        isPreset: false,
        isArchived: false,
        createdAt: new Date().toISOString(),
        timesCompleted: 0,
      };

      const { data, error } = await supabase
        .from('community_posts')
        .insert({
          user_id: user.id,
          type: 'preset_shared',
          workout_id: workout.id,
          workout_name: workout.name,
          workout_data: sanitizedWorkout as any,
          message: message || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-posts'] });
    },
  });
}
