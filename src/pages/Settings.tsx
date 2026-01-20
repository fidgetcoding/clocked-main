import { ArrowLeft, User, LogOut, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Switch } from '@/components/ui/switch';
import { useUserStore } from '@/stores/userStore';
import { cn } from '@/lib/utils';

const Settings = () => {
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
  const updateUser = useUserStore((state) => state.updateUser);

  const handleToggleVoice = () => {
    if (user) {
      updateUser({
        preferences: {
          ...user.preferences,
          soundEnabled: !user.preferences.soundEnabled,
        },
      });
    }
  };

  const joinedDate = user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A';

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-red-glow">
        {/* Header */}
        <header className="px-4 pt-8 pb-6 safe-top">
          <h1 className="text-2xl font-black text-foreground tracking-wider">
            PROFILE & SETTINGS
          </h1>
        </header>

        <div className="px-4 space-y-6 pb-24">
          {/* Profile Card */}
          <div className="card-workout">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-volt/20 flex items-center justify-center">
                <User className="w-8 h-8 text-volt" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-foreground">{user?.name || 'Fighter'}</h2>
                  <button className="text-muted-foreground hover:text-foreground">
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground">user@example.com</p>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-surface-2 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Joined</p>
                <p className="font-semibold text-foreground">{joinedDate}</p>
              </div>
              <div className="bg-surface-2 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                <p className="font-semibold text-volt">ACTIVE</p>
              </div>
            </div>

            {/* Sign Out */}
            <button className="flex items-center gap-2 w-full p-3 rounded-lg bg-surface-2 border border-alert-red/30 text-alert-red hover:bg-alert-red/10 transition-colors">
              <LogOut className="w-4 h-4" />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>

          {/* App Preferences */}
          <div className="card-workout">
            <h3 className="text-lg font-bold text-foreground mb-4">App Preferences</h3>
            
            <div className="flex items-center justify-between">
              <span className="text-foreground">Voice Announcements</span>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-sm font-medium uppercase',
                  user?.preferences?.soundEnabled !== false ? 'text-volt' : 'text-muted-foreground'
                )}>
                  {user?.preferences?.soundEnabled !== false ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Settings;
