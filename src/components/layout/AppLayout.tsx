import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

interface AppLayoutProps {
  children: ReactNode;
  hideNav?: boolean;
}

export function AppLayout({ children, hideNav = false }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <main className={hideNav ? '' : 'pb-[calc(6.25rem+env(safe-area-inset-bottom))]'}>
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
