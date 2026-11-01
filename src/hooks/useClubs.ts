import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { toast } from 'sonner';
import { ClubRankRow, rankClubMembers } from '@/lib/clubs';

export interface Club {
  id: string;
  name: string;
  icon: string;
  description: string | null;
  type: 'public' | 'private';
  member_cap: number | null;
  created_at: string;
  updated_at: string;
}

export interface ClubMember {
  id: string;
  club_id: string;
  user_id: string;
  role: 'member' | 'moderator' | 'admin';
  joined_at: string;
}

export function useClubs() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all clubs
  const { data: clubs = [], isLoading: clubsLoading } = useQuery({
    queryKey: ['clubs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clubs')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as Club[];
    },
  });

  // Fetch user's club memberships
  const { data: myMemberships = [], isLoading: membershipsLoading } = useQuery({
    queryKey: ['club-memberships', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('club_members')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data as ClubMember[];
    },
    enabled: !!user?.id,
  });

  // Member counts for every club this fighter can see
  const { data: memberCounts = {} } = useQuery({
    queryKey: ['club-member-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_club_member_counts');
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((row) => [row.club_id, Number(row.member_count)])) as Record<string, number>;
    },
    enabled: !!user,
  });

  const refreshAfterMembershipChange = () => {
    queryClient.invalidateQueries({ queryKey: ['club-memberships', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['club-member-counts'] });
    queryClient.invalidateQueries({ queryKey: ['club-ranks'] });
  };

  // Join a club
  const joinClub = useMutation({
    mutationFn: async (clubId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Check member cap
      const club = clubs.find(c => c.id === clubId);
      if (club?.member_cap) {
        const { count } = await supabase
          .from('club_members')
          .select('*', { count: 'exact', head: true })
          .eq('club_id', clubId);
        
        if (count !== null && count >= club.member_cap) {
          throw new Error('This club has reached its member limit');
        }
      }

      const { data, error } = await supabase
        .from('club_members')
        .insert({ club_id: clubId, user_id: user.id })
        .select()
        .single();
      
      if (error) {
        if (error.code === '23505') {
          throw new Error('You are already a member of this club');
        }
        throw error;
      }
      return data as ClubMember;
    },
    onSuccess: (_, clubId) => {
      refreshAfterMembershipChange();
      const club = clubs.find(c => c.id === clubId);
      toast.success(`Joined ${club?.name || 'club'}! 🎉`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Leave a club
  const leaveClub = useMutation({
    mutationFn: async (clubId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('club_members')
        .delete()
        .eq('club_id', clubId)
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: (_, clubId) => {
      refreshAfterMembershipChange();
      const club = clubs.find(c => c.id === clubId);
      toast.success(`Left ${club?.name || 'club'}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Check if user is member of a club
  const isMemberOf = (clubId: string) => {
    return myMemberships.some(m => m.club_id === clubId);
  };

  return {
    clubs,
    myMemberships,
    clubsLoading,
    membershipsLoading,
    joinClub,
    leaveClub,
    isMemberOf,
    memberCounts,
  };
}

/** A club's members, best first. Only its own members can read this. */
export function useClubRanks(clubId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['club-ranks', clubId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_club_ranks', { target_club_id: clubId! });
      if (error) throw error;
      return rankClubMembers((data ?? []) as ClubRankRow[], user?.id);
    },
    enabled: !!clubId && !!user,
  });
}
