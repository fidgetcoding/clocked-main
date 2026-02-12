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
  tags: string[] | null;
  custom_name: string | null;
  destination: string | null;
  // Joined from profiles
  user_name?: string;
  user_avatar?: string;
}

export function useCommunityPosts(filter: 'all' | 'following' = 'all') {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['community-posts', filter, user?.id],
    queryFn: async () => {
      // If filtering by following, first get the list of users we follow
      let followingIds: string[] = [];
      if (filter === 'following' && user) {
        const { data: follows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);
        
        followingIds = follows?.map(f => f.following_id) || [];
        
        // If not following anyone, return empty
        if (followingIds.length === 0) {
          return [];
        }
      }

      // Build the query
      let query = supabase
        .from('community_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      // Filter by following if needed
      if (filter === 'following' && followingIds.length > 0) {
        query = query.in('user_id', followingIds);
      }

      const { data: posts, error: postsError } = await query;

      if (postsError) throw postsError;

      // Fetch profiles for all user_ids
      const userIds = [...new Set(posts?.map(p => p.user_id) || [])];
      if (userIds.length === 0) return [];

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
      message,
      customName,
      tags,
      destination,
    }: { 
      workout: Workout; 
      message?: string;
      customName?: string;
      tags?: string[];
      destination?: string;
    }) => {
      if (!user) throw new Error('Must be logged in to share');

      // Sanitize workout data - remove any user-specific info
      const sanitizedWorkout = {
        ...workout,
        id: workout.id,
        name: customName || workout.name,
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
          workout_name: customName || workout.name,
          workout_data: sanitizedWorkout as any,
          message: message || null,
          tags: tags || [],
          custom_name: customName || null,
          destination: destination || 'feed',
        } as any)
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
