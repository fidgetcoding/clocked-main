import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BroadcastPage, FitText, Plate } from '@/components/broadcast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isBackendConfigured, supabase } from '@/integrations/supabase/client';

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
    } catch (error) {
      setErrorMessage(describeAuthError(error as Parameters<typeof describeAuthError>[0]));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendLink(email.trim());
  };

  const keepTraining = (
    <Button variant="secondary" size="sm" onClick={() => navigate('/')} className="w-full text-lg sm:text-xl">
      Keep training without an account
    </Button>
  );

  return (
    <BroadcastPage show="Sign in" className="flex flex-col">
      {!isBackendConfigured ? (
        <div className="bg-slash flex flex-1 flex-col justify-center overflow-hidden py-6">
          <Plate tone="white" bleed="both" className="plate-slap flex w-full px-4 py-2">
            <h1 className="w-full">
              <FitText className="h-20 [@media(max-height:500px)]:h-12" max={96}>NO BACKEND CONFIGURED</FitText>
            </h1>
          </Plate>
          <p className="prose-w mt-4 px-4 text-xl leading-snug">
            This copy of Clocked isn't connected to a Supabase project, so sign-in is off. Your training is still saved in this browser. To add accounts, follow SETUP.md in the repo.
          </p>
          <div className="mt-6 px-5">{keepTraining}</div>
        </div>
      ) : sentTo ? (
        <div className="bg-slash flex flex-1 flex-col justify-center overflow-hidden py-6">
          <Plate tone="white" bleed="both" className="plate-slap flex w-full px-4 py-2">
            <h1 className="w-full">
              <FitText className="h-20 [@media(max-height:500px)]:h-12" max={96}>CHECK YOUR EMAIL</FitText>
            </h1>
          </Plate>
          <p className="prose-w mt-4 px-4 text-xl leading-snug">
            We sent a sign-in link to <span className="fx mt-1 block break-all text-4xl text-volt">{sentTo}</span>
          </p>

          <div className="mt-6 space-y-3 px-5">
            <Button
              type="button"
              variant="steel"
              disabled={loading}
              onClick={() => sendLink(sentTo)}
              className="w-full"
            >
              {loading ? 'Sending...' : 'RESEND LINK'}
            </Button>

            {errorMessage && (
              <p role="alert" className="text-base font-semibold text-destructive">
                {errorMessage}
              </p>
            )}

            <Button
              type="button"
              variant="secondary"
              onClick={() => { setSentTo(null); setErrorMessage(null); }}
              className="w-full"
            >
              Use a different email
            </Button>
            {keepTraining}
          </div>
        </div>
      ) : (
        <div className="flex-1 pb-6 pt-6">
          <h1 className="fx px-4 text-[clamp(3.25rem,16vw,5.5rem)] [@media(max-height:500px)]:text-5xl">
            SAVE YOUR PROGRESS
          </h1>
          <p className="prose-w mt-3 px-4 text-xl leading-snug">
            We'll email you a link to sign in. No password needed.
          </p>

          {/* Auth Form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <label className="block px-4">
              <span className="lab">Your email</span>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-12 text-xl"
              />
            </label>

            <div className="space-y-3 px-5">
              <Button
                type="submit"
                size="lg"
                disabled={loading}
                className="w-full text-[clamp(1.75rem,9vw,2.25rem)]"
              >
                {loading ? 'Sending...' : 'EMAIL ME A LINK'}
              </Button>

              {errorMessage && (
                <p role="alert" className="text-base font-semibold text-destructive">
                  {errorMessage}
                </p>
              )}

              {keepTraining}
            </div>
          </form>
        </div>
      )}
    </BroadcastPage>
  );
};

export default Auth;
