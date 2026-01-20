import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  role: 'fighter' | 'coach';
  avatar_url: string | null;
  experience_level: string | null;
  equipment: Record<string, boolean>;
  goals: string[];
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  workouts_completed: number;
  preferences: {
    voiceType: string;
    soundEnabled: boolean;
    hapticEnabled: boolean;
    voiceAnnouncements: boolean;
  };
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as Profile | null;
    },
    enabled: !!user?.id,
  });

  const updateProfile = useMutation({
    mutationFn: async (updates: Partial<Omit<Profile, 'id' | 'user_id' | 'created_at'>>) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    },
  });

  const addXP = useMutation({
    mutationFn: async (amount: number) => {
      if (!user?.id || !profile) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('profiles')
        .update({ total_xp: profile.total_xp + amount })
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    },
  });

  const incrementStreak = useMutation({
    mutationFn: async () => {
      if (!user?.id || !profile) throw new Error('Not authenticated');
      
      const newStreak = profile.current_streak + 1;
      const { data, error } = await supabase
        .from('profiles')
        .update({ 
          current_streak: newStreak,
          longest_streak: Math.max(newStreak, profile.longest_streak),
        })
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    },
  });

  return {
    profile,
    isLoading,
    error,
    updateProfile,
    addXP,
    incrementStreak,
  };
}
