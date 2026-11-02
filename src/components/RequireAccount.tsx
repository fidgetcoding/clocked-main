import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { OnAir } from '@/components/broadcast';
import { useAuth } from '@/contexts/useAuth';

/** Keeps guests off routes that only make sense with an account. */
export const RequireAccount = ({ children }: { children: ReactNode }) => {
  const { loading, isGuest } = useAuth();

  if (loading) {
    return (
      <div className="page-frame px-4 pt-4" role="status">
        <OnAir state="off">Loading</OnAir>
      </div>
    );
  }
  if (isGuest) return <Navigate to="/" replace />;

  return <>{children}</>;
};
