import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { isUuid } from '@/lib/uuid';
import { toast } from 'sonner';
import { trustedAvatarUrl } from '@/lib/avatarUrl';

export interface FollowUser {
  id: string;
  name: string;
  avatar: string | null;
  handle: string;
}

export function useFollows(userId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const targetUserId = user ? userId || user.id : undefined;
  const isReal = isUuid(targetUserId);
  // You can only read follows you're part of, so only your own lists can be complete
  const isOwn = !!user && targetUserId === user.id;

  // Totals come from a function because the rows behind someone else's count aren't readable
  const { data: counts } = useQuery({
    queryKey: ['follow-counts', targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_follow_counts', { target_user_id: targetUserId! });
      if (error) throw error;
      return data?.[0] ?? { followers: 0, following: 0 };
    },
    enabled: isReal,
  });
  const followersCount = counts?.followers ?? 0;
  const followingCount = counts?.following ?? 0;

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
      const { data: profiles, error: profilesError } = await supabase.rpc('get_public_profiles', { target_user_ids: followerIds });
      
      if (profilesError) throw profilesError;
      
      return (profiles || []).map(p => ({
        id: p.user_id!,
        name: p.name || 'Fighter',
        avatar: trustedAvatarUrl(p.avatar_url),
        handle: '@' + (p.handle || p.name?.toLowerCase().replace(/\s+/g, '') || 'fighter'),
      })) as FollowUser[];
    },
    enabled: isOwn,
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
      const { data: profiles, error: profilesError } = await supabase.rpc('get_public_profiles', { target_user_ids: followingIds });
      
      if (profilesError) throw profilesError;
      
      return (profiles || []).map(p => ({
        id: p.user_id!,
        name: p.name || 'Fighter',
        avatar: trustedAvatarUrl(p.avatar_url),
        handle: '@' + (p.handle || p.name?.toLowerCase().replace(/\s+/g, '') || 'fighter'),
      })) as FollowUser[];
    },
    enabled: isOwn,
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
    enabled: !!user?.id && isReal && user.id !== targetUserId,
  });

  const refreshAfterFollowChange = (targetId: string) => {
    queryClient.invalidateQueries({ queryKey: ['follow-counts', targetId] });
    queryClient.invalidateQueries({ queryKey: ['follow-counts', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['following-list', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['is-following', user?.id, targetId] });
    queryClient.invalidateQueries({ queryKey: ['community-posts'] });
  };

  // Follow mutation
  const follow = useMutation({
    mutationFn: async (targetId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: user.id, following_id: targetId });
      
      // Already following, from another tab say, is the outcome that was asked for
      if (error && error.code !== '23505') throw error;
    },
    onSuccess: (_, targetId) => refreshAfterFollowChange(targetId),
    onError: () => toast.error("Couldn't follow this fighter"),
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
    onSuccess: (_, targetId) => refreshAfterFollowChange(targetId),
    onError: () => toast.error("Couldn't unfollow this fighter"),
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
