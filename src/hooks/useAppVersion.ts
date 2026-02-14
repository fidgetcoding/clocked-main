import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useAppVersion() {
  return useQuery({
    queryKey: ['app-version'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'version')
        .single();
      
      if (error) {
        console.error('Failed to fetch version:', error);
        return '1.0'; // Fallback
      }
      
      return data.value;
    },
    staleTime: 1000 * 30, // Cache for 30 seconds
  });
}
