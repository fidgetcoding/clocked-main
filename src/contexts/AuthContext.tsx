import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useUserStore } from '@/stores/userStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useHistoryStore } from '@/stores/historyStore';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isGuest: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to clear all user-specific localStorage data
// Guest rows live in these same stores and stay put: SIGNED_OUT can fire on an anonymous
// load when a stale session is discarded, and guest data isn't the account's to wipe.
function clearUserLocalStorage() {
  useUserStore.getState().clearAccount();
  useWorkoutStore.setState({ workouts: [], archivedWorkouts: [], presetsLoaded: false });
  useHistoryStore.setState({ completedWorkouts: [] });
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
    useUserStore.getState().enterAccount();
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
        }

        if (!session) {
          useUserStore.getState().enterGuest();
        }
        
        // Sync profile on sign in (covers OAuth redirects)
        if (event === 'SIGNED_IN' && newUserId) {
          syncProfileToStore(newUserId);
        }

        const accountChanged = event === 'SIGNED_OUT' || (previousUserIdRef.current && previousUserIdRef.current !== newUserId);
        previousUserIdRef.current = newUserId;
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Last on purpose: the store updates above re-render synchronously, and an empty cache at
        // that point makes mounted queries refetch with the old user but no session
        if (accountChanged) {
          queryClientRef.current?.clear();
        }
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
      } else {
        useUserStore.getState().enterGuest();
      }
    });

    return () => subscription.unsubscribe();
  }, [syncProfileToStore]);

  const signOut = async () => {
    await supabase.auth.signOut();
    clearUserLocalStorage();
    queryClientRef.current?.clear();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isGuest: !loading && !user, signOut }}>
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
