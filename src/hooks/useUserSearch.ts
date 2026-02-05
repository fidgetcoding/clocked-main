import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SearchResult {
  id: string;
  user_id: string;
  name: string;
  handle: string | null;
  avatar_url: string | null;
}

export function useUserSearch(searchQuery: string) {
  const { user } = useAuth();
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['user-search', debouncedQuery],
    queryFn: async (): Promise<SearchResult[]> => {
      if (!debouncedQuery.trim() || debouncedQuery.length < 2) {
        return [];
      }

      // Clean the search query - remove @ prefix if present
      const cleanQuery = debouncedQuery.replace(/^@/, '').trim();
      if (cleanQuery.length < 2) {
        return [];
      }
      
      // Search for profiles by name using simple ilike filter
      // Note: The .or() filter with ilike patterns has issues in Supabase JS client
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, name, handle, avatar_url')
        .ilike('name', `%${cleanQuery}%`)
        .neq('user_id', user?.id || '')
        .limit(20);

      if (error) {
        console.error('Search error:', error);
        return [];
      }

      return data || [];
    },
    enabled: debouncedQuery.length >= 2 && !!user,
    staleTime: 30000,
  });

  return {
    results,
    isLoading,
    hasQuery: debouncedQuery.length >= 2,
  };
}
