import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useUserStore } from '@/stores/userStore';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to clear all user-specific localStorage data
function clearUserLocalStorage() {
  localStorage.removeItem('get-clocked-workouts');
  localStorage.removeItem('get-clocked-user');
  localStorage.removeItem('get-clocked-history');
  localStorage.removeItem('get-clocked-timer');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const previousUserIdRef = useRef<string | null>(null);
  
  // Get queryClient from context - we'll handle this in the effect
  const queryClientRef = useRef<ReturnType<typeof useQueryClient> | null>(null);
  
  try {
    queryClientRef.current = useQueryClient();
  } catch {
    // QueryClient not available yet, will be set later
  }

  // Sync profile from DB to local store when user signs in
  const syncProfileToStore = useCallback(async (userId: string) => {
    const { hasCompletedOnboarding, completeOnboarding } = useUserStore.getState();
    if (hasCompletedOnboarding) return; // Already synced

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, name, role, experience_level, prestige, current_level')
        .eq('user_id', userId)
        .single();

      if (profile) {
        completeOnboarding({
          name: profile.name,
          role: profile.role as 'fighter' | 'coach',
          experienceLevel: profile.experience_level as any,
          prestige: profile.prestige as any,
          currentLevel: profile.current_level ?? 1,
        });
      }
    } catch {
      // Profile doesn't exist yet — user needs onboarding
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener BEFORE checking session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const newUserId = session?.user?.id ?? null;
        
        // Clear data when user changes or logs out
        if (event === 'SIGNED_OUT' || (previousUserIdRef.current && previousUserIdRef.current !== newUserId)) {
          console.log('Auth state change: clearing user data');
          clearUserLocalStorage();
          queryClientRef.current?.clear();
        }
        
        // Sync profile on sign in (covers OAuth redirects)
        if (event === 'SIGNED_IN' && newUserId) {
          syncProfileToStore(newUserId);
        }

        previousUserIdRef.current = newUserId;
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      previousUserIdRef.current = session?.user?.id ?? null;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Also sync on initial load if session exists
      if (session?.user?.id) {
        syncProfileToStore(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [syncProfileToStore]);

  const signOut = async () => {
    // Clear all user-specific data before signing out
    clearUserLocalStorage();
    queryClientRef.current?.clear();
    
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
