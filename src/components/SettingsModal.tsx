import { X, Volume2, Bell, Timer, Vibrate, Settings } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useUserStore } from '@/stores/userStore';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export const SettingsModal = ({ open, onClose }: SettingsModalProps) => {
  const user = useUserStore((state) => state.user);
  const updateUser = useUserStore((state) => state.updateUser);

  if (!open) return null;

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

  // Preference items grouped by category
  const voiceAlerts = [
    { 
      key: 'voiceAnnouncements', 
      label: 'Voice Announcements', 
      description: 'Announce segment changes',
      icon: Volume2,
    },
    { 
      key: 'voiceCountdown', 
      label: 'Countdown Voice', 
      description: '10-second countdown',
      icon: Timer,
    },
    { 
      key: 'voiceComboCallouts', 
      label: 'Combo Callouts', 
      description: 'Call out punch combos',
      icon: Volume2,
    },
  ];

  const soundAlerts = [
    { 
      key: 'soundEnabled', 
      label: 'Sound Effects', 
      description: 'Bell and timer sounds',
      icon: Bell,
    },
    { 
      key: 'roundStartBell', 
      label: 'Round Start Bell', 
      icon: Bell,
    },
    { 
      key: 'roundEndBell', 
      label: 'Round End Bell', 
      icon: Bell,
    },
    { 
      key: 'tenSecondWarning', 
      label: '10-Second Warning', 
      icon: Timer,
    },
  ];

  const hapticAlerts = [
    { 
      key: 'hapticEnabled', 
      label: 'Haptic Feedback', 
      description: 'Vibration alerts',
      icon: Vibrate,
    },
    { 
      key: 'hapticRoundChange', 
      label: 'Round Change Vibration', 
      icon: Vibrate,
    },
    { 
      key: 'hapticWarning', 
      label: 'Warning Vibration', 
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
    description?: string;
    icon: React.ComponentType<{ className?: string }>;
  }) => {
    const isEnabled = (user?.preferences as any)?.[prefKey] !== false;
    
    return (
      <div className="flex items-center gap-3 py-2.5">
        <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground font-medium">{label}</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-surface-1 rounded-t-2xl sm:rounded-2xl border-t sm:border border-surface-3 max-h-[85vh] flex flex-col animate-in slide-in-from-bottom sm:slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-3">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-volt" />
            <h2 className="text-lg font-bold text-foreground">Workout Settings</h2>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Voice Alerts */}
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Voice</h3>
            <div className="bg-surface-2 rounded-xl p-3 space-y-1">
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
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Sounds</h3>
            <div className="bg-surface-2 rounded-xl p-3 space-y-1">
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
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Haptics</h3>
            <div className="bg-surface-2 rounded-xl p-3 space-y-1">
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
        </div>
      </div>
    </div>
  );
};
