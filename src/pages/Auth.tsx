import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import clockedLogo from '@/assets/clocked-logo.png';
import { cn } from '@/lib/utils';

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
