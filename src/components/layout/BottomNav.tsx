import { Home, User, BarChart3, Users, Timer } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
}

const leftNavItems: NavItem[] = [
  { icon: Home, label: 'HOME', path: '/' },
  { icon: BarChart3, label: 'MY STATS', path: '/stats' },
];

const rightNavItems: NavItem[] = [
  { icon: Users, label: 'FIGHT CLUB', path: '/fight-club' },
  { icon: User, label: 'PROFILE', path: '/profile' },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const renderNavItem = (item: NavItem) => {
    const isActive = location.pathname === item.path;
    const Icon = item.icon;

    return (
      <button
        key={item.path}
        onClick={() => navigate(item.path)}
        className={cn(
          'nav-item flex-1',
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
            'text-[8px] sm:text-[10px] font-semibold tracking-wide sm:tracking-wider transition-colors duration-200',
            isActive ? 'text-volt' : 'text-muted-foreground'
          )}
        >
          {item.label}
        </span>
      </button>
    );
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-tech-black border-t border-surface-3">
      <div className="flex items-center justify-around max-w-lg mx-auto safe-bottom relative">
        {leftNavItems.map(renderNavItem)}

        {/* Quick Start - Raised center button */}
        <div className="flex-1 flex items-center justify-center">
          <button
            onClick={() => navigate('/quick-session')}
            className="-mt-10 w-[4.5rem] h-[4.5rem] rounded-full bg-volt flex items-center justify-center shadow-lg shadow-volt/40 active:scale-95 transition-transform border-4 border-tech-black"
            aria-label="Quick Start Timer"
          >
            <Timer className="w-7 h-7 text-primary-foreground" />
          </button>
        </div>

        {rightNavItems.map(renderNavItem)}
      </div>
    </nav>
  );
}
