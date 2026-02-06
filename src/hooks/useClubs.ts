import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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

// Fixed Early Adopters club ID
export const EARLY_ADOPTERS_CLUB_ID = 'ea000000-0000-0000-0000-000000000001';

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

  // Fetch member count for a specific club
  const useClubMemberCount = (clubId: string) => {
    return useQuery({
      queryKey: ['club-member-count', clubId],
      queryFn: async () => {
        const { count, error } = await supabase
          .from('club_members')
          .select('*', { count: 'exact', head: true })
          .eq('club_id', clubId);
        
        if (error) throw error;
        return count ?? 0;
      },
      enabled: !!clubId,
    });
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
      queryClient.invalidateQueries({ queryKey: ['club-memberships', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['club-member-count', clubId] });
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
      queryClient.invalidateQueries({ queryKey: ['club-memberships', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['club-member-count', clubId] });
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
    useClubMemberCount,
  };
}
