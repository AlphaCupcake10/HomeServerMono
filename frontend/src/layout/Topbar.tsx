import { useEffect } from 'react';
import { LogOut, Menu, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useMatches } from 'react-router';
import { useAuth } from '@/auth/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { isFeatureEnabled, useAppConfig } from '@/config/useAppConfig';
import type { RouteHandle } from '@/router';
import { useSidebar } from './sidebar-context';

/**
 * "Minecraft / Console" from the matched routes' titles (routes.tsx). A page whose feature is
 * switched off renders Not Found, so its title must not give the feature away either.
 */
const usePageTitle = (): string => {
  const matches = useMatches();
  const { data: config } = useAppConfig();
  const handles = matches
    .map((match) => match.handle as RouteHandle | undefined)
    .filter((handle): handle is RouteHandle => Boolean(handle?.title));
  if (handles.some((h) => h.feature && config && !isFeatureEnabled(config, h.feature))) {
    return 'Not found';
  }
  return handles.map((h) => h.title).join(' / ');
};

const UserMenu = () => {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="lg" className="gap-2 px-2" aria-label="Account menu">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground uppercase">
            {user.email[0]}
          </span>
          <span className="hidden max-w-48 truncate sm:inline">{user.email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span className="truncate">{user.email}</span>
          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
            {user.role === 'admin' ? 'Super admin' : 'User'}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Theme
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme ?? 'system'} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <Sun /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const Topbar = () => {
  const { setMobileOpen } = useSidebar();
  const title = usePageTitle();

  useEffect(() => {
    document.title = title ? `${title} · Home Server` : 'Home Server';
  }, [title]);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur sm:px-4">
      <Button
        variant="ghost"
        size="icon-lg"
        className="md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </Button>
      <h1 className="truncate text-base font-semibold">{title}</h1>
      <div className="ml-auto">
        <UserMenu />
      </div>
    </header>
  );
};
