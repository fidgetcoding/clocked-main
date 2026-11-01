import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import clockedLogo from '@/assets/clocked-logo.png';

const describeAuthError = (error: { status?: number; code?: string; message?: string }) => {
  if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
    return 'Too many email requests. Wait a few minutes, then try again.';
  }
  return error.message || 'Could not send the link. Please try again.';
};

const Auth = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sendLink = async (address: string) => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: address,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding?continue=true`,
        },
      });
      if (error) throw error;
      setSentTo(address);
    } catch (error: any) {
      setErrorMessage(describeAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendLink(email.trim());
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <img 
        src={clockedLogo} 
        alt="Clocked Logo" 
        className="w-32 h-32 object-contain mb-4"
      />

      {sentTo ? (
        <>
          <h1 className="text-2xl font-black text-foreground mb-2">
            CHECK YOUR EMAIL
          </h1>
          <p className="text-muted-foreground mb-8 text-center">
            We sent a sign-in link to <span className="text-foreground font-semibold break-all">{sentTo}</span>
          </p>

          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => sendLink(sentTo)}
            className="w-full max-w-sm h-12 text-base font-medium border-surface-3"
          >
            {loading ? 'Sending...' : 'RESEND LINK'}
          </Button>

          {errorMessage && (
            <p role="alert" className="w-full max-w-sm mt-4 text-sm text-destructive text-center">
              {errorMessage}
            </p>
          )}

          <button
            onClick={() => { setSentTo(null); setErrorMessage(null); }}
            className="mt-8 text-volt font-semibold hover:underline"
          >
            Use a different email
          </button>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-black text-foreground mb-2">
            SAVE YOUR PROGRESS
          </h1>
          <p className="text-muted-foreground mb-8 text-center">
            We'll email you a link to sign in. No password needed.
          </p>

          {/* Auth Form */}
          <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="pl-10 h-12 bg-surface-1 border-surface-3"
              />
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className="btn-primary-glow w-full h-12 text-base font-bold"
            >
              {loading ? 'Sending...' : 'EMAIL ME A LINK'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>

            {errorMessage && (
              <p role="alert" className="text-sm text-destructive text-center">
                {errorMessage}
              </p>
            )}
          </form>
        </>
      )}

      <button
        onClick={() => navigate('/')}
        className="mt-8 text-muted-foreground hover:text-foreground transition-colors"
      >
        Keep training without an account
      </button>
    </div>
  );
};

export default Auth;
