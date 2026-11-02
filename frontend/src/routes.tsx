import type { ComponentType } from 'react';
import {
  Activity,
  LayoutDashboard,
  Pickaxe,
  ScrollText,
  Settings,
  SlidersHorizontal,
  Terminal,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { FeatureKey, Role } from '@/api/types';

/**
 * The single source of truth for pages: `router.tsx` builds the router from these entries and
 * the sidebar is generated from them. To add a page, add an entry here.
 */
export interface AppRoute {
  /** Relative to the parent; "" is the index page. */
  path: string;
  /** Sidebar label and page title. */
  title: string;
  icon?: LucideIcon;
  /** Lazy-loaded page component (default export). */
  page?: () => Promise<{ default: ComponentType }>;
  /** Omitted = any signed-in user. */
  roles?: Role[];
  /** Hidden from the sidebar and shown as Not Found while the feature is disabled. */
  feature?: FeatureKey;
  hideInNav?: boolean;
  /** Rendered as a collapsible sidebar group; the group path redirects to the first child. */
  children?: AppRoute[];
}

/** Pages reachable without signing in. */
export const publicRoutes: AppRoute[] = [
  { path: 'login', title: 'Sign in', page: () => import('@/features/auth/LoginPage') },
];

/** Pages inside the app layout (sidebar + top bar); all require a signed-in user. */
export const appRoutes: AppRoute[] = [
  {
    path: '',
    title: 'Dashboard',
    icon: LayoutDashboard,
    page: () => import('@/features/dashboard/DashboardPage'),
  },
  {
    path: 'minecraft',
    title: 'Minecraft',
    icon: Pickaxe,
    feature: 'minecraft',
    children: [
      {
        path: 'overview',
        title: 'Overview',
        icon: Activity,
        page: () => import('@/features/minecraft/OverviewPage'),
      },
      {
        path: 'console',
        title: 'Console',
        icon: Terminal,
        page: () => import('@/features/minecraft/ConsolePage'),
      },
      {
        path: 'properties',
        title: 'Properties',
        icon: SlidersHorizontal,
        page: () => import('@/features/minecraft/PropertiesPage'),
      },
    ],
  },
  {
    path: 'users',
    title: 'Users',
    icon: Users,
    roles: ['admin'],
    page: () => import('@/features/users/CreateUserPage'),
  },
  {
    path: 'logs',
    title: 'Logs',
    icon: ScrollText,
    roles: ['admin'],
    page: () => import('@/features/logs/LogsPage'),
  },
  {
    path: 'settings',
    title: 'Settings',
    icon: Settings,
    roles: ['admin'],
    page: () => import('@/features/settings/SettingsPage'),
  },
];
