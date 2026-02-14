import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import clockedLogo from '@/assets/clocked-logo.png';
import { cn } from '@/lib/utils';
import { lovable } from '@/integrations/lovable/index';

type AuthMode = 'login' | 'signup';

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get mode from URL param, default to login
  const initialMode = (searchParams.get('mode') as AuthMode) || 'login';
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sync mode with URL params
  useEffect(() => {
    const urlMode = searchParams.get('mode') as AuthMode;
    if (urlMode && (urlMode === 'login' || urlMode === 'signup')) {
      setMode(urlMode);
    }
  }, [searchParams]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate name on signup
    if (mode === 'signup') {
      const trimmedName = name.trim();
      if (!trimmedName || trimmedName.length < 1) {
        toast.error('Name is required');
        return;
      }
      if (trimmedName.length > 100) {
        toast.error('Name must be 100 characters or less');
        return;
      }
    }
    
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/onboarding?continue=true`,
            data: { name: name.trim() || 'Fighter' },
          },
        });
        if (error) throw error;
        toast.success('Account created! Welcome to CLOCKED.');
        // Signup → continue onboarding flow
        navigate('/onboarding?continue=true');
      } else {
        const { data: authData, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        // Check if user has a profile (completed onboarding)
        if (authData.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, name, role, experience_level')
            .eq('user_id', authData.user.id)
            .single();
          
          if (profile) {
            // User has a profile, mark onboarding as complete in local store
            const { useUserStore } = await import('@/stores/userStore');
            useUserStore.getState().completeOnboarding({
              name: profile.name,
              role: profile.role as 'fighter' | 'coach',
              experienceLevel: profile.experience_level as any,
            });
          }
        }
        
        toast.success('Welcome back!');
        // Login → straight to app
        navigate('/');
      }
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <img 
        src={clockedLogo} 
        alt="Clocked Logo" 
        className="w-32 h-32 object-contain mb-4"
      />
      
      <h1 className="text-2xl font-black text-foreground mb-2">
        {mode === 'login' ? 'WELCOME BACK' : 'JOIN THE FIGHT'}
      </h1>
      <p className="text-muted-foreground mb-8">
        {mode === 'login' ? 'Sign in to continue training' : 'Create your fighter profile'}
      </p>

      {/* Auth Form */}
      <form onSubmit={handleEmailAuth} className="w-full max-w-sm space-y-4">
        {mode === 'signup' && (
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pl-10 h-12 bg-surface-1 border-surface-3"
            />
          </div>
        )}

        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="pl-10 h-12 bg-surface-1 border-surface-3"
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="pl-10 pr-10 h-12 bg-surface-1 border-surface-3"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        <Button 
          type="submit" 
          disabled={loading}
          className="btn-primary-glow w-full h-12 text-base font-bold"
        >
          {loading ? 'Loading...' : mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </form>

      {/* Divider */}
      <div className="w-full max-w-sm flex items-center gap-3 mt-6">
        <div className="flex-1 h-px bg-surface-3" />
        <span className="text-xs text-muted-foreground uppercase">or</span>
        <div className="flex-1 h-px bg-surface-3" />
      </div>

      {/* Google Sign-In */}
      <Button
        variant="outline"
        className="w-full max-w-sm h-12 mt-4 gap-3 text-base font-medium border-surface-3"
        onClick={async () => {
          const { error } = await lovable.auth.signInWithOAuth('google', {
            redirect_uri: window.location.origin,
          });
          if (error) toast.error(error.message || 'Google sign-in failed');
        }}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </Button>


      {/* Toggle Mode */}
      <p className="mt-8 text-muted-foreground">
        {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
        <button
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
          className="ml-2 text-volt font-semibold hover:underline"
        >
          {mode === 'login' ? 'Sign up' : 'Sign in'}
        </button>
      </p>
    </div>
  );
};

export default Auth;
