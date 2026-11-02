import type { ReactNode } from 'react';
import { useAuth } from '@/auth/useAuth';
import { PageLoader } from '@/components/PageLoader';
import { isFeatureEnabled, useAppConfig } from '@/config/useAppConfig';
import ForbiddenPage from '@/pages/ForbiddenPage';
import NotFoundPage from '@/pages/NotFoundPage';
import type { AppRoute } from '@/routes';

/**
 * Applies a route's `roles` and `feature` at render time, so a feature switched off on the
 * Settings page disappears without a reload. Disabled features look like missing pages.
 */
export const RouteGuard = ({ route, children }: { route: AppRoute; children: ReactNode }) => {
  const { user } = useAuth();
  const { data: config, isPending } = useAppConfig();

  if (route.roles && !(user && route.roles.includes(user.role))) {
    return <ForbiddenPage />;
  }
  if (route.feature) {
    if (isPending) return <PageLoader />;
    if (!isFeatureEnabled(config, route.feature)) return <NotFoundPage />;
  }
  return children;
};
