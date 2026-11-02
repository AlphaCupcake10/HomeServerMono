import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { PageLoader } from '@/components/PageLoader';
import { safeNext } from '@/navigation';
import { useAuth } from './useAuth';

/** Renders children only for a signed-in user; otherwise redirects to /login?next=<here>. */
export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <PageLoader fullScreen />;
  if (status === 'anonymous') {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return children;
};

/** For the login page: a signed-in user is sent on to `next` (or the dashboard). */
export const PublicOnly = ({ children }: { children: ReactNode }) => {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <PageLoader fullScreen />;
  if (status === 'authenticated') {
    return <Navigate to={safeNext(new URLSearchParams(location.search).get('next'))} replace />;
  }
  return children;
};
