import { toJson } from '@/lib/json';
import { useState, useRef } from 'react';
import { ArrowLeft, LogOut, Volume2, Timer, Shield, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Switch } from '@/components/ui/switch';
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
    { 
      key: 'voiceAnnouncements', 
      label: 'Voice Announcements', 
      description: 'Announce segment changes and instructions',
      icon: Volume2,
    },
    { 
      key: 'voiceCountdown', 
      label: 'Countdown Voice', 
      description: '3-second countdown before segment ends',
      icon: Timer,
    },
    { 
      key: 'voiceComboCallouts', 
      label: 'Combo Callouts', 
      description: 'Call out punch combinations during combos',
      icon: Volume2,
    },
    { 
      key: 'tenSecondWarning', 
      label: '10-Second Warning', 
      description: 'Warning beep at 10 seconds remaining',
      icon: Timer,
    },
  ];

  const PreferenceToggle = ({ 
    prefKey, 
    label, 
    description, 
    icon: Icon 
  }: { 
    prefKey: string; 
    label: string; 
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }) => {
    const isEnabled = (user?.preferences)?.[prefKey] !== false;
    
    return (
      <div className="flex items-start gap-3 py-3">
        <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-foreground font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Switch
          checked={isEnabled}
          onCheckedChange={(checked) => handleTogglePreference(prefKey, checked)}
          className="data-[state=checked]:bg-volt"
        />
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-red-glow">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 pt-8 pb-6 safe-top">
          <button onClick={() => navigate('/profile')} className="text-muted-foreground">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-black text-foreground tracking-wider flex-1">
            SETTINGS
          </h1>
          {!isGuest && (
            <button 
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              <span>{isSigningOut ? 'Signing Out...' : 'Sign Out'}</span>
            </button>
          )}
        </header>

        <div className="px-4 space-y-6 pb-24">
          {/* Stance */}
          <div className="card-workout">
            <h3 className="text-lg font-bold text-foreground mb-2">Stance</h3>
            <p className="text-xs text-muted-foreground mb-4">Tells the punch camera which hand is your lead</p>
            <div className="flex gap-2" role="radiogroup" aria-label="Stance">
              {STANCE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  role="radio"
                  aria-checked={stance === option.value}
                  onClick={() => setStance(option.value)}
                  className={cn(
                    'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors',
                    stance === option.value
                      ? 'bg-volt text-primary-foreground'
                      : 'bg-surface-2 border border-surface-3 text-muted-foreground hover:bg-surface-3',
                  )}
                >
                  <span className="block">{option.label}</span>
                  <span className="block text-xs font-normal opacity-80">{option.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sound Alerts */}
          <div className="card-workout">
            <h3 className="text-lg font-bold text-foreground mb-2">Sound Alerts</h3>
            <p className="text-xs text-muted-foreground mb-4">Voice and audio cues during workouts</p>
            <div className="divide-y divide-surface-3">
              {soundAlerts.map((pref) => (
                <PreferenceToggle
                  key={pref.key}
                  prefKey={pref.key}
                  label={pref.label}
                  description={pref.description}
                  icon={pref.icon}
                />
              ))}
            </div>
          </div>

          {/* Save Your Progress */}
          {isGuest && (
            <button
              onClick={() => navigate('/auth')}
              className="card-workout flex items-center gap-3 w-full text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center">
                <Mail className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-foreground font-bold">Save your progress</p>
                <p className="text-xs text-muted-foreground">Your training is stored on this device. Sign in with an email link to use an account.</p>
              </div>
              <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
            </button>
          )}

          {/* Admin Portal */}
          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="card-workout flex items-center gap-3 w-full text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-volt/20 flex items-center justify-center">
                <Shield className="w-4 h-4 text-volt" />
              </div>
              <div className="flex-1">
                <p className="text-foreground font-bold">Admin Portal</p>
                <p className="text-xs text-muted-foreground">Manage users</p>
              </div>
              <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
            </button>
          )}

          {/* Admin Tools */}
          {isAdmin && (
            <div className="card-workout border border-volt/20 space-y-2">
              <p className="text-xs font-bold text-volt uppercase tracking-wider">⚡ Admin Tools</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowLevelUpOverlay(true);
                  }}
                  className="text-xs bg-surface-2 border-surface-3"
                >
                  🎮 Level Up ({levelUpVariant === 'volt' ? '🟢' : levelUpVariant === 'cooldown' ? '🔵' : '🟡'})
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowPrestigePrompt(true)}
                  className="text-xs bg-surface-2 border-surface-3"
                >
                  🏆 Prestige
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowBadgeOverlay(true)}
                  className="text-xs bg-surface-2 border-surface-3"
                >
                  🎖️ Badge Earn
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRegenerateLoadout}
                  disabled={isRegenerating}
                  className="text-xs bg-surface-2 border-surface-3"
                >
                  {isRegenerating ? '⏳ ...' : '🔄 Regen Loadout'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowGloveOverlay(true)}
                  className="text-xs bg-surface-2 border-surface-3"
                >
                  🥊 Glove Unlock
                </Button>
              </div>
            </div>
          )}

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

          {/* Version */}
          <div className="text-center text-xs text-muted-foreground pt-4">
            v{version || '1.0'}
          </div>
        </div>

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

      </div>
    </AppLayout>
  );
};

export default Settings;
