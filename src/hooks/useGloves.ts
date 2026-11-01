import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useUserStore } from '@/stores/userStore';
import { checkGloveUnlocks, GLOVES } from '@/data/gloves';
import { toast } from 'sonner';

export function useGloves() {
  const { user, isGuest } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();

  const equippedGlove = (profile)?.equipped_glove || 'default';
  const unlockedGloves: string[] = (profile)?.unlocked_gloves || ['default'];

  const equipGlove = useMutation({
    mutationFn: async (gloveId: string) => {
      if (isGuest) return useUserStore.getState().updateGuestProfile({ equipped_glove: gloveId });
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('profiles')
        .update({ equipped_glove: gloveId })
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    },
  });

  /** Call after workout completion to check for newly unlocked gloves */
  const syncGloveUnlocks = async () => {
    if ((!user?.id && !isGuest) || !profile) return [];
    const prestige = profile.prestige || 'rookie';
    const level = profile.current_level || 1;
    const streak = profile.current_streak || 0;

    const computed = checkGloveUnlocks(prestige, level, streak);
    const newlyUnlocked = computed.filter(id => !unlockedGloves.includes(id));

    if (newlyUnlocked.length > 0) {
      const merged = [...new Set([...unlockedGloves, ...newlyUnlocked])];
      if (isGuest) {
        useUserStore.getState().updateGuestProfile({ unlocked_gloves: merged });
      } else {
        await supabase
          .from('profiles')
          .update({ unlocked_gloves: merged })
          .eq('user_id', user!.id);
      }
      
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });

      // Toast for each new glove
      for (const id of newlyUnlocked) {
        const glove = GLOVES[id];
        if (glove) {
          toast.success(`🥊 NEW GLOVE UNLOCKED: ${glove.name}`, { duration: 4000 });
        }
      }
    }

    return newlyUnlocked;
  };

  return {
    equippedGlove,
    unlockedGloves,
    equipGlove,
    syncGloveUnlocks,
  };
}
