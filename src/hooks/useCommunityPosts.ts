import { toJson } from '@/lib/json';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { Workout } from '@/types';
import { toast } from 'sonner';

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
  club_id: string | null;
  // Joined from profiles
  user_name?: string;
  user_avatar?: string;
}

export function useCommunityPosts(filter: 'all' | 'following' = 'all', destination: 'feed' | 'club' = 'feed', clubId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['community-posts', filter, destination, clubId, user?.id],
    queryFn: async () => {
      // If filtering by following, first get the list of users we follow
      let followingIds: string[] = [];
      if (filter === 'following' && user) {
        const { data: follows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);
        
        followingIds = follows?.map(f => f.following_id) || [];
        
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

      // Filter by destination
      if (destination === 'club' && clubId) {
        query = query.eq('destination', 'club').eq('club_id', clubId);
      } else if (destination === 'club') {
        query = query.eq('destination', 'club');
      } else {
        // Main feed shows 'feed' destination and legacy posts (null)
        query = query.or('destination.eq.feed,destination.is.null');
      }

      // Filter by following if needed
      if (filter === 'following' && followingIds.length > 0) {
        query = query.in('user_id', followingIds);
      }

      const { data: posts, error: postsError } = await query;

      if (postsError) throw postsError;

      // Fetch profiles for all user_ids
      const userIds = [...new Set(posts?.map(p => p.user_id) || [])];
      if (userIds.length === 0) return [];

      const { data: profiles } = await supabase.rpc('get_public_profiles', { target_user_ids: userIds });

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return (posts || []).map(post => ({
        ...post,
        workout_data: post.workout_data as unknown as Workout | null,
        user_name: profileMap.get(post.user_id)?.name || 'Fighter',
        user_avatar: profileMap.get(post.user_id)?.avatar_url || null,
      })) as CommunityPost[];
    },
    // Asking for a club's posts with no club yet would otherwise fetch every club's
    enabled: !!user && (destination !== 'club' || !!clubId),
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
      clubId,
    }: { 
      workout: Workout; 
      message?: string;
      customName?: string;
      tags?: string[];
      destination?: string;
      clubId?: string;
    }) => {
      if (!user) throw new Error('Must be logged in to share');

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
          workout_data: toJson(sanitizedWorkout),
          message: message || null,
          tags: tags || [],
          custom_name: customName || null,
          destination: destination || 'feed',
          club_id: clubId || null,
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

export function usePostWorkoutComplete() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workoutName,
      xpEarned,
      duration,
    }: {
      workoutName: string;
      xpEarned: number;
      duration: number;
    }) => {
      // Posted automatically after a session, so a guest just skips it
      if (!user) return null;

      const mins = Math.floor(duration / 60);
      const message = `Completed "${workoutName}" — ${mins}m, +${xpEarned} XP 🔥`;

      const { data, error } = await supabase
        .from('community_posts')
        .insert({
          user_id: user.id,
          type: 'workout_complete',
          workout_name: workoutName,
          message,
          destination: 'feed',
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

export function useDeleteCommunityPost() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      if (!user) throw new Error('Must be logged in');

      const { error } = await supabase
        .from('community_posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-posts'] });
      queryClient.invalidateQueries({ queryKey: ['my-shared-workouts'] });
    },
    onError: () => toast.error("Couldn't delete that post"),
  });
}

export function useMySharedWorkouts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-shared-workouts', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('community_posts')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'preset_shared')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch club names for private posts
      const clubIds = [...new Set((data || []).filter(p => p.club_id).map(p => p.club_id!))];
      let clubMap = new Map<string, string>();
      if (clubIds.length > 0) {
        const { data: clubs } = await supabase
          .from('clubs')
          .select('id, name')
          .in('id', clubIds);
        clubMap = new Map(clubs?.map(c => [c.id, c.name]) || []);
      }

      return (data || []).map(post => ({
        ...post,
        workout_data: post.workout_data as unknown as Workout | null,
        club_name: post.club_id ? clubMap.get(post.club_id) || 'Unknown Club' : null,
      }));
    },
    enabled: !!user,
  });
}
