import {
  lazy,
  Suspense,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
} from 'react';
import { createBrowserRouter, Navigate, Outlet, type RouteObject } from 'react-router';
import type { FeatureKey } from '@/api/types';
import { PublicOnly, RequireAuth } from '@/auth/RequireAuth';
import { PageLoader } from '@/components/PageLoader';
import { AppLayout } from '@/layout/AppLayout';
import NotFoundPage from '@/pages/NotFoundPage';
import { RouteGuard } from '@/RouteGuard';
import { appRoutes, publicRoutes, type AppRoute } from '@/routes';

/** Route metadata read by the top bar via useMatches(). */
export interface RouteHandle {
  title: string;
  /** Lets the top bar hide the title of a page whose feature is switched off. */
  feature?: FeatureKey;
}

const lazyPage = (route: AppRoute): LazyExoticComponent<ComponentType> => {
  if (!route.page) throw new Error(`Route "${route.path}" has neither a page nor children`);
  return lazy(route.page);
};

const suspended = (Page: ComponentType): ReactNode => (
  <Suspense fallback={<PageLoader />}>
    <Page />
  </Suspense>
);

/** Turns a routes.tsx entry into a React Router route with guards and lazy loading. */
const toRouteObject = (route: AppRoute): RouteObject => {
  const handle: RouteHandle = { title: route.title, feature: route.feature };

  if (route.children) {
    return {
      path: route.path,
      handle,
      element: (
        <RouteGuard route={route}>
          <Outlet />
        </RouteGuard>
      ),
      children: [
        { index: true, element: <Navigate to={route.children[0].path} replace /> },
        ...route.children.map(toRouteObject),
      ],
    };
  }

  const element = <RouteGuard route={route}>{suspended(lazyPage(route))}</RouteGuard>;
  return route.path === ''
    ? { index: true, handle, element }
    : { path: route.path, handle, element };
};

export const router = createBrowserRouter([
  ...publicRoutes.map((route): RouteObject => ({
    path: `/${route.path}`,
    handle: { title: route.title } satisfies RouteHandle,
    element: <PublicOnly>{suspended(lazyPage(route))}</PublicOnly>,
  })),
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      ...appRoutes.map(toRouteObject),
      {
        path: '*',
        handle: { title: 'Not found' } satisfies RouteHandle,
        element: <NotFoundPage />,
      },
    ],
  },
]);
