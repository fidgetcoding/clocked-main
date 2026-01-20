import { Home, Timer, Users, BarChart3 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
}

const navItems: NavItem[] = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: Timer, label: 'Timer', path: '/timer' },
  { icon: Users, label: 'Fight Club', path: '/fight-club' },
  { icon: BarChart3, label: 'Stats', path: '/stats' },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-tech-black/95 backdrop-blur-lg border-t border-surface-3 safe-bottom">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'nav-item flex-1 min-w-0',
                isActive && 'nav-item-active'
              )}
            >
              <Icon 
                className={cn(
                  'nav-icon w-6 h-6 transition-all duration-200',
                  isActive ? 'text-volt' : 'text-muted-foreground'
                )} 
              />
              <span 
                className={cn(
                  'text-xs font-medium truncate transition-colors duration-200',
                  isActive ? 'text-volt' : 'text-muted-foreground'
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
