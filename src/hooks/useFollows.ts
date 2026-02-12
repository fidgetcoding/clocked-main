import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface FollowUser {
  id: string;
  name: string;
  avatar: string | null;
  handle: string;
}

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

  // Get actual followers list with profile info
  const { data: followersList = [] } = useQuery({
    queryKey: ['followers-list', targetUserId],
    queryFn: async () => {
      if (!targetUserId) return [];
      
      // Get all follows where target is being followed
      const { data: follows, error: followsError } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', targetUserId);
      
      if (followsError) throw followsError;
      if (!follows || follows.length === 0) return [];
      
      // Get profiles for those followers
      const followerIds = follows.map(f => f.follower_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles_public')
        .select('user_id, name, avatar_url, handle')
        .in('user_id', followerIds);
      
      if (profilesError) throw profilesError;
      
      return (profiles || []).map(p => ({
        id: p.user_id!,
        name: p.name || 'Fighter',
        avatar: p.avatar_url,
        handle: '@' + (p.handle || p.name?.toLowerCase().replace(/\s+/g, '') || 'fighter'),
      })) as FollowUser[];
    },
    enabled: !!targetUserId,
  });

  // Get actual following list with profile info
  const { data: followingList = [] } = useQuery({
    queryKey: ['following-list', targetUserId],
    queryFn: async () => {
      if (!targetUserId) return [];
      
      // Get all follows where target is following others
      const { data: follows, error: followsError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', targetUserId);
      
      if (followsError) throw followsError;
      if (!follows || follows.length === 0) return [];
      
      // Get profiles for those being followed
      const followingIds = follows.map(f => f.following_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles_public')
        .select('user_id, name, avatar_url, handle')
        .in('user_id', followingIds);
      
      if (profilesError) throw profilesError;
      
      return (profiles || []).map(p => ({
        id: p.user_id!,
        name: p.name || 'Fighter',
        avatar: p.avatar_url,
        handle: '@' + (p.handle || p.name?.toLowerCase().replace(/\s+/g, '') || 'fighter'),
      })) as FollowUser[];
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
      queryClient.invalidateQueries({ queryKey: ['followers-list', targetId] });
      queryClient.invalidateQueries({ queryKey: ['following-count', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['following-list', user?.id] });
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
      queryClient.invalidateQueries({ queryKey: ['followers-list', targetId] });
      queryClient.invalidateQueries({ queryKey: ['following-count', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['following-list', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['is-following', user?.id, targetId] });
    },
  });

  return {
    followersCount,
    followingCount,
    followersList,
    followingList,
    isFollowing,
    follow,
    unfollow,
  };
}
