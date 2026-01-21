import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useFollows(userId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const targetUserId = userId || user?.id;

  // Get followers count
  const { data: followersCount = 0 } = useQuery({
    queryKey: ['followers-count', targetUserId],
    queryFn: async () => {
      if (!targetUserId) return 0;
      
      const { count, error } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', targetUserId);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!targetUserId,
  });

  // Get following count
  const { data: followingCount = 0 } = useQuery({
    queryKey: ['following-count', targetUserId],
    queryFn: async () => {
      if (!targetUserId) return 0;
      
      const { count, error } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', targetUserId);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!targetUserId,
  });

  // Check if current user is following target user
  const { data: isFollowing = false } = useQuery({
    queryKey: ['is-following', user?.id, targetUserId],
    queryFn: async () => {
      if (!user?.id || !targetUserId || user.id === targetUserId) return false;
      
      const { data, error } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)
        .maybeSingle();
      
      if (error) throw error;
      return !!data;
    },
    enabled: !!user?.id && !!targetUserId && user.id !== targetUserId,
  });

  // Follow mutation
  const follow = useMutation({
    mutationFn: async (targetId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: user.id, following_id: targetId });
      
      if (error) throw error;
    },
    onSuccess: (_, targetId) => {
      queryClient.invalidateQueries({ queryKey: ['followers-count', targetId] });
      queryClient.invalidateQueries({ queryKey: ['following-count', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['is-following', user?.id, targetId] });
    },
  });

  // Unfollow mutation
  const unfollow = useMutation({
    mutationFn: async (targetId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', targetId);
      
      if (error) throw error;
    },
    onSuccess: (_, targetId) => {
      queryClient.invalidateQueries({ queryKey: ['followers-count', targetId] });
      queryClient.invalidateQueries({ queryKey: ['following-count', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['is-following', user?.id, targetId] });
    },
  });

  return {
    followersCount,
    followingCount,
    isFollowing,
    follow,
    unfollow,
  };
}
