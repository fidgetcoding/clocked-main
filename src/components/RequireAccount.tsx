import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/** Keeps guests off routes that only make sense with an account. */
export const RequireAccount = ({ children }: { children: ReactNode }) => {
  const { loading, isGuest } = useAuth();

  if (loading) return null;
  if (isGuest) return <Navigate to="/" replace />;

  return <>{children}</>;
};
