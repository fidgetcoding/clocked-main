import { useState } from 'react';
import { ArrowLeft, LogOut, Volume2, Timer, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useUserStore } from '@/stores/userStore';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';
import { useAppVersion } from '@/hooks/useAppVersion';
import { LevelUpOverlay } from '@/components/ui/LevelUpOverlay';
import { BadgeEarnOverlay } from '@/components/ui/BadgeEarnOverlay';
import { PrestigePrompt } from '@/components/workout/PrestigePrompt';
import { Prestige } from '@/lib/xpSystem';
import { ALL_BADGES } from '@/data/badges';

const Settings = () => {
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
  const updateUser = useUserStore((state) => state.updateUser);
  const setUser = useUserStore((state) => state.setUser);
  const { signOut } = useAuth();
  const { data: version } = useAppVersion();
  const { isAdmin } = useUserRole();
  const { profile, updateProfile } = useProfile();
  
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showLevelUpOverlay, setShowLevelUpOverlay] = useState(false);
  const [showPrestigePrompt, setShowPrestigePrompt] = useState(false);
  const [showBadgeOverlay, setShowBadgeOverlay] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      setUser(null);
      useUserStore.setState({ hasCompletedOnboarding: false });
      navigate('/onboarding');
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
    const isEnabled = (user?.preferences as any)?.[prefKey] !== false;
    
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
          <button 
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            <span>{isSigningOut ? 'Signing Out...' : 'Sign Out'}</span>
          </button>
        </header>

        <div className="px-4 space-y-6 pb-24">
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
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowLevelUpOverlay(true)}
                  className="flex-1 text-xs bg-surface-2 border-surface-3"
                >
                  🎮 Level Up
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowPrestigePrompt(true)}
                  className="flex-1 text-xs bg-surface-2 border-surface-3"
                >
                  🏆 Prestige
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowBadgeOverlay(true)}
                  className="flex-1 text-xs bg-surface-2 border-surface-3"
                >
                  🎖️ Badge Earn
                </Button>
              </div>
            </div>
          )}

          {/* Version */}
          <div className="text-center text-xs text-muted-foreground pt-4">
            v{version || '1.0'}
          </div>
        </div>

        {/* Level Up Overlay (admin test) */}
        {showLevelUpOverlay && (
          <LevelUpOverlay level={profile?.current_level || 1} onComplete={() => setShowLevelUpOverlay(false)} />
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

        {/* Badge Earn Overlay (admin test) */}
        {showBadgeOverlay && (
          <BadgeEarnOverlay
            badge={ALL_BADGES[Math.floor(Math.random() * ALL_BADGES.length)]}
            onComplete={() => setShowBadgeOverlay(false)}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default Settings;
