import type { LucideIcon } from 'lucide-react';
import type { AppConfig, Role } from '@/api/types';
import type { AppRoute } from '@/routes';

export interface NavItem {
  title: string;
  icon?: LucideIcon;
  /** Absolute path. */
  to: string;
  children?: NavItem[];
}

export interface AccessContext {
  role: Role | undefined;
  features: AppConfig['features'] | undefined;
}

/** Only same-app paths, so a ?next= parameter can't redirect to another site. */
export const safeNext = (next: string | null): string =>
  next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

export const joinPath = (base: string, path: string): string =>
  `/${[base, path]
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/')}`;

/** Whether the current user may see a route (role + feature flag). */
export const canAccess = (route: AppRoute, { role, features }: AccessContext): boolean =>
  (!route.roles || (role !== undefined && route.roles.includes(role))) &&
  (!route.feature || features?.[route.feature]?.enabled === true);

/** Sidebar entries for the current user, derived from routes.tsx. */
export const navItemsFor = (routes: AppRoute[], access: AccessContext, base = '/'): NavItem[] =>
  routes
    .filter((route) => !route.hideInNav && canAccess(route, access))
    .map((route) => {
      const to = joinPath(base, route.path);
      const children = route.children && navItemsFor(route.children, access, to);
      return { title: route.title, icon: route.icon, to, ...(children ? { children } : {}) };
    })
    .filter((item) => !item.children || item.children.length > 0);
