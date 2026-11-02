import { toJson } from '@/lib/json';
import { useState, useRef } from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { BroadcastPage, FitText, OnAir } from '@/components/broadcast';
import { Button } from '@/components/ui/button';
import { useUserStore } from '@/stores/userStore';
import { useAuth } from '@/contexts/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useProfile } from '@/hooks/useProfile';
import { STANCE_OPTIONS, useStance } from '@/hooks/useStance';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAppVersion } from '@/hooks/useAppVersion';
import { LevelUpOverlay } from '@/components/ui/LevelUpOverlay';
import { BadgeEarnOverlay } from '@/components/ui/BadgeEarnOverlay';
import { PrestigePrompt } from '@/components/workout/PrestigePrompt';
import { Prestige } from '@/lib/xpSystem';
import { ALL_BADGES } from '@/data/badges';
import { generateLoadoutWorkout, UserEquipmentConfig } from '@/lib/loadoutGenerator';
import { GloveUnlockOverlay } from '@/components/ui/GloveUnlockOverlay';
import { GLOVES } from '@/data/gloves';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

const Settings = () => {
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
  const updateUser = useUserStore((state) => state.updateUser);
  const { signOut, user: authUser, isGuest } = useAuth();
  const { data: version } = useAppVersion();
  const { isAdmin } = useUserRole();
  const { profile } = useProfile();
  const { stance, setStance } = useStance();
  const queryClient = useQueryClient();
  
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showLevelUpOverlay, setShowLevelUpOverlay] = useState(false);
  const [levelUpVariant, setLevelUpVariant] = useState<'volt' | 'cooldown' | 'championship'>('volt');
  const [showPrestigePrompt, setShowPrestigePrompt] = useState(false);
  const [showBadgeOverlay, setShowBadgeOverlay] = useState(false);
  const [showGloveOverlay, setShowGloveOverlay] = useState(false);
  const gloveIndexRef = useRef(0);
  const sampleGloves = [GLOVES.golden, GLOVES.platinum, GLOVES.emerald, GLOVES.ruby, GLOVES.diamond, GLOVES.bmf];

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      // Index sends anyone without a finished onboarding on to /onboarding
      navigate('/');
      toast.success('Signed out successfully');
    } catch (error) {
      toast.error('Failed to sign out');
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleTogglePreference = (key: string, value: boolean) => {
    if (user) {
      updateUser({
        preferences: {
          ...user.preferences,
          [key]: value,
        },
      });
    }
  };

  const handleRegenerateLoadout = async () => {
    if (!authUser?.id || !profile) return;
    setIsRegenerating(true);
    try {
      const eq = (profile.equipment || {}) as unknown as UserEquipmentConfig;
      const loadoutEquipment: UserEquipmentConfig = {
        gloves: !!eq.gloves,
        wraps: !!eq.wraps,
        jumpRope: !!eq.jumpRope,
        heavyBag: !!eq.heavyBag,
        doubleEndBag: !!eq.doubleEndBag,
        speedBag: !!eq.speedBag,
        treadmill: !!eq.treadmill,
        primaryBag: eq.primaryBag || 'none',
      };
      const experienceLevel = profile.experience_level || 'beginner';
      const loadout = generateLoadoutWorkout(experienceLevel, loadoutEquipment);

      // Delete existing loadout(s)
      await supabase
        .from('workouts')
        .delete()
        .eq('user_id', authUser.id)
        .contains('tags', ['loadout']);

      // Insert new one
      const { error } = await supabase
        .from('workouts')
        .insert([{
          user_id: authUser.id,
          name: loadout.name,
          description: loadout.description,
          duration: loadout.duration,
          difficulty: loadout.difficulty,
          phases: toJson(loadout.phases),
          combos: loadout.combos,
          tags: loadout.tags,
          is_preset: loadout.is_preset,
          is_archived: false,
          times_completed: 0,
        }]);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['workouts', authUser.id] });
      toast.success('Sets & trending presets updated across all users');
    } catch (err) {
      console.error('Regenerate loadout error:', err);
      toast.error('Failed to regenerate loadout');
    } finally {
      setIsRegenerating(false);
    }
  };

  const soundAlerts = [
    { key: 'voiceAnnouncements', label: 'Voice Announcements', description: 'Announce segment changes and instructions' },
    { key: 'voiceCountdown', label: 'Countdown Voice', description: '3-second countdown before segment ends' },
    { key: 'voiceComboCallouts', label: 'Combo Callouts', description: 'Call out punch combinations during combos' },
    { key: 'tenSecondWarning', label: '10-Second Warning', description: 'Warning beep at 10 seconds remaining' },
  ];

  // One channel on the audio desk. The switch itself is the on-air light.
  const AudioChannel = ({ channel, prefKey, label, description }: { channel: number; prefKey: string; label: string; description: string }) => {
    const isEnabled = (user?.preferences)?.[prefKey] !== false;

    return (
      <div className="flex min-w-0 flex-col border-b border-surface-2 px-4 py-3 odd:border-r sm:border-b-0 sm:border-r sm:last:border-r-0">
        <span className="lab">Sound {channel}</span>
        <SwitchPrimitives.Root
          checked={isEnabled}
          onCheckedChange={(checked) => handleTogglePreference(prefKey, checked)}
          aria-label={label}
          className={cn(
            'plate fx my-2 h-14 w-full text-2xl',
            isEnabled ? 'plate-red' : 'plate-graphite text-muted-foreground',
          )}
        >
          {isEnabled ? 'On' : 'Off'}
        </SwitchPrimitives.Root>
        <span className="fx text-2xl leading-[0.95]">{label}</span>
        <span className="prose-w mt-1 text-[0.9375rem] leading-tight text-muted-foreground">{description}</span>
      </div>
    );
  };

  return (
    <AppLayout>
      <BroadcastPage onBack={() => navigate('/profile')}>
        <p className="lab lab-lime px-4 pt-3">Settings</p>
        <h1 className="px-4 pt-1">
          <FitText className="fx h-[clamp(4rem,22vw,6.5rem)]" max={104}>SETTINGS</FitText>
        </h1>

        {/* The corner: which hand leads */}
        <section className="pt-4">
          <h3 className="lab lab-lime px-4 font-[inherit] not-italic">Stance</h3>
          <div className="mt-2 flex gap-4 px-5" role="radiogroup" aria-label="Stance">
            {STANCE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={stance === option.value}
                onClick={() => setStance(option.value)}
                className={cn(
                  'plate fx h-16 flex-1 flex-col gap-1 text-3xl',
                  stance === option.value ? 'plate-lime' : 'plate-graphite',
                )}
              >
                <span>{option.label}</span>
                <span className="font-text text-[0.8125rem] font-bold not-italic leading-none tracking-[0.06em]">{option.hint}</span>
              </button>
            ))}
          </div>
          <p className="prose-w px-4 pt-2 text-base">Tells the punch camera which hand is your lead</p>
        </section>

        {/* The audio desk */}
        <section className="pt-4">
          <h3 className="lab lab-lime px-4 font-[inherit] not-italic">Sound Alerts</h3>
          <p className="prose-w px-4 pt-1 text-base">Voice and audio cues during workouts</p>
          <div className="mt-2 grid grid-cols-2 border-y border-surface-3 sm:grid-cols-4">
            {soundAlerts.map((pref, index) => (
              <AudioChannel
                key={pref.key}
                channel={index + 1}
                prefKey={pref.key}
                label={pref.label}
                description={pref.description}
              />
            ))}
          </div>
        </section>

        {/* Save Your Progress */}
        {isGuest && (
          <button
            type="button"
            onClick={() => navigate('/auth')}
            className="grid w-full grid-cols-[1fr_auto] items-center gap-3 border-b border-surface-2 px-4 py-3 text-left transition-colors hover:bg-surface-1"
          >
            <span className="min-w-0">
              <span className="fx block text-3xl">Save your progress</span>
              <span className="prose-w mt-1 block text-base">Your training is stored on this device. Sign in with an email link to use an account.</span>
            </span>
            <span className="plate plate-lime fx h-11 px-4 text-xl">Sign in</span>
          </button>
        )}

        {/* Admin Portal */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="grid w-full grid-cols-[1fr_auto] items-center gap-3 border-b border-surface-2 px-4 py-3 text-left transition-colors hover:bg-surface-1"
          >
            <span className="min-w-0">
              <span className="fx block text-3xl">Admin Portal</span>
              <span className="prose-w mt-1 block text-base">Manage users</span>
            </span>
            <span className="plate plate-graphite fx h-11 px-4 text-xl">Open</span>
          </button>
        )}

        {/* Admin Tools */}
        {isAdmin && (
          <section className="px-4 py-3">
            <p className="lab lab-lime">Admin Tools</p>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 px-1">
              <Button size="sm" variant="secondary" onClick={() => setShowLevelUpOverlay(true)}>
                Level Up ({levelUpVariant === 'volt' ? 'lime' : levelUpVariant === 'cooldown' ? 'white' : 'gold'})
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowPrestigePrompt(true)}>
                Prestige
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowBadgeOverlay(true)}>
                Badge Earn
              </Button>
              <Button size="sm" variant="secondary" onClick={handleRegenerateLoadout} disabled={isRegenerating}>
                {isRegenerating ? 'Regen Loadout...' : 'Regen Loadout'}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowGloveOverlay(true)}>
                Glove Unlock
              </Button>
            </div>
          </section>
        )}

        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <OnAir state="off">v{version || '1.0'}</OnAir>
          {!isGuest && (
            <Button variant="secondary" size="sm" onClick={handleSignOut} disabled={isSigningOut}>
              {isSigningOut ? 'Signing Out...' : 'Sign Out'}
            </Button>
          )}
        </div>

          {/* Badge Earn Overlay (admin test) */}
          {showBadgeOverlay && (
            <BadgeEarnOverlay badge={ALL_BADGES[0]} onComplete={() => setShowBadgeOverlay(false)} />
          )}

          {/* Glove Unlock Overlay (admin test) */}
          {showGloveOverlay && (
            <GloveUnlockOverlay
              glove={sampleGloves[gloveIndexRef.current % sampleGloves.length]}
              onComplete={() => {
                setShowGloveOverlay(false);
                gloveIndexRef.current += 1;
              }}
            />
          )}

        {/* Level Up Overlay (admin test) */}
        {showLevelUpOverlay && (
          <LevelUpOverlay
            level={profile?.current_level || 1}
            variant={levelUpVariant}
            onComplete={() => {
              setShowLevelUpOverlay(false);
              // Cycle to next variant for next press
              setLevelUpVariant(prev => prev === 'volt' ? 'cooldown' : prev === 'cooldown' ? 'championship' : 'volt');
            }}
          />
        )}

        {/* Prestige Prompt (admin test) */}
        {showPrestigePrompt && (
          <div className="fixed inset-0 z-50">
            <PrestigePrompt
              currentPrestige={(profile?.prestige || 'beginner') as Prestige}
              onPrestige={() => setShowPrestigePrompt(false)}
              onDefer={() => setShowPrestigePrompt(false)}
            />
          </div>
        )}
      </BroadcastPage>
    </AppLayout>
  );
};

export default Settings;
