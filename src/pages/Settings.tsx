import { useState } from 'react';
import { ArrowLeft, LogOut, Volume2, Bell, Timer, Vibrate } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Switch } from '@/components/ui/switch';
import { useUserStore } from '@/stores/userStore';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const Settings = () => {
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
  const updateUser = useUserStore((state) => state.updateUser);
  const setUser = useUserStore((state) => state.setUser);
  const { signOut } = useAuth();
  
  const [isSigningOut, setIsSigningOut] = useState(false);

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

  const voiceAlerts = [
    { 
      key: 'voiceAnnouncements', 
      label: 'Voice Announcements', 
      description: 'Announce segment changes and instructions',
      icon: Volume2,
    },
    { 
      key: 'voiceCountdown', 
      label: 'Countdown Voice', 
      description: '10-second countdown before segment ends',
      icon: Timer,
    },
    { 
      key: 'voiceComboCallouts', 
      label: 'Combo Callouts', 
      description: 'Call out punch combinations during combos',
      icon: Volume2,
    },
  ];

  const soundAlerts = [
    { 
      key: 'soundEnabled', 
      label: 'Sound Effects', 
      description: 'Boxing bell and timer sounds',
      icon: Bell,
    },
    { 
      key: 'roundStartBell', 
      label: 'Round Start Bell', 
      description: 'Bell sound at start of each round',
      icon: Bell,
    },
    { 
      key: 'roundEndBell', 
      label: 'Round End Bell', 
      description: 'Bell sound at end of each round',
      icon: Bell,
    },
    { 
      key: 'tenSecondWarning', 
      label: '10-Second Warning', 
      description: 'Warning beep at 10 seconds remaining',
      icon: Timer,
    },
    { 
      key: 'segmentTransitionBeep', 
      label: 'Segment Transition Beep', 
      description: 'Beep when transitioning between segments',
      icon: Bell,
    },
  ];

  const hapticAlerts = [
    { 
      key: 'hapticEnabled', 
      label: 'Haptic Feedback', 
      description: 'Vibration for important events',
      icon: Vibrate,
    },
    { 
      key: 'hapticRoundChange', 
      label: 'Round Change Vibration', 
      description: 'Vibrate on round start/end',
      icon: Vibrate,
    },
    { 
      key: 'hapticWarning', 
      label: 'Warning Vibration', 
      description: 'Vibrate for 10-second warning',
      icon: Vibrate,
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
          <button onClick={() => navigate(-1)} className="text-muted-foreground">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-black text-foreground tracking-wider">
            SETTINGS
          </h1>
        </header>

        <div className="px-4 space-y-6 pb-24">
          {/* Voice Alerts */}
          <div className="card-workout">
            <h3 className="text-lg font-bold text-foreground mb-2">Voice Alerts</h3>
            <p className="text-xs text-muted-foreground mb-4">Control voice announcements during workouts</p>
            <div className="divide-y divide-surface-3">
              {voiceAlerts.map((pref) => (
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

          {/* Sound Alerts */}
          <div className="card-workout">
            <h3 className="text-lg font-bold text-foreground mb-2">Sound Alerts</h3>
            <p className="text-xs text-muted-foreground mb-4">Configure audio cues for workout events</p>
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

          {/* Haptic Alerts */}
          <div className="card-workout">
            <h3 className="text-lg font-bold text-foreground mb-2">Haptic Feedback</h3>
            <p className="text-xs text-muted-foreground mb-4">Vibration alerts (device must support haptics)</p>
            <div className="divide-y divide-surface-3">
              {hapticAlerts.map((pref) => (
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

          {/* Sign Out */}
          <div className="card-workout">
            <button 
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="flex items-center gap-2 w-full p-3 rounded-lg bg-surface-2 border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              <span className="font-medium">{isSigningOut ? 'Signing Out...' : 'Sign Out'}</span>
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Settings;
