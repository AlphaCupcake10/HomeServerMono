import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, PanelLeftClose, PanelLeftOpen, Server } from 'lucide-react';
import { NavLink, useLocation, useMatch } from 'react-router';
import { useAuth } from '@/auth/useAuth';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAppConfig } from '@/config/useAppConfig';
import { cn } from '@/lib/utils';
import { navItemsFor, type NavItem } from '@/navigation';
import { appRoutes } from '@/routes';
import { useSidebar } from './sidebar-context';

const itemClass = (active: boolean, collapsed: boolean) =>
  cn(
    'flex items-center gap-3 rounded-md text-sm font-medium transition-colors outline-none',
    'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring',
    active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/80',
    collapsed ? 'mx-auto size-10 justify-center' : 'h-10 px-3',
  );

const isWithin = (pathname: string, to: string) =>
  to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);

const NavLeaf = ({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) => {
  const Icon = item.icon;
  // A plain className string: Radix's Slot (TooltipTrigger asChild) string-joins classNames,
  // which would turn NavLink's function form into literal text.
  const active = useMatch({ path: item.to, end: true }) !== null;
  const link = (
    <NavLink
      to={item.to}
      end
      onClick={onNavigate}
      className={itemClass(active, collapsed)}
      aria-label={collapsed ? item.title : undefined}
    >
      {Icon && <Icon className="size-4 shrink-0" />}
      {!collapsed && <span className="truncate">{item.title}</span>}
    </NavLink>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.title}</TooltipContent>
    </Tooltip>
  );
};

const NavGroup = ({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) => {
  const { pathname } = useLocation();
  const active = isWithin(pathname, item.to);
  const [open, setOpen] = useState(active);
  const [wasActive, setWasActive] = useState(active);
  const Icon = item.icon;

  // Expand the group when navigation lands inside it (adjusting state during render).
  if (active !== wasActive) {
    setWasActive(active);
    if (active) setOpen(true);
  }

  if (collapsed) {
    // Icon rail: the group's pages open as a flyout menu.
    return (
      <DropdownMenu>
        <DropdownMenuTrigger className={itemClass(active, true)} aria-label={item.title}>
          {Icon && <Icon className="size-4" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="min-w-44">
          <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {item.children?.map((child) => {
            const ChildIcon = child.icon;
            return (
              <DropdownMenuItem key={child.to} asChild>
                <NavLink to={child.to} end className={cn(pathname === child.to && 'font-semibold')}>
                  {ChildIcon && <ChildIcon />}
                  {child.title}
                </NavLink>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(itemClass(false, false), 'w-full', active && 'text-sidebar-foreground')}
      >
        {Icon && <Icon className="size-4 shrink-0" />}
        <span className="truncate">{item.title}</span>
        <ChevronRight
          className={cn('ml-auto size-4 shrink-0 transition-transform', open && 'rotate-90')}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 space-y-1 border-l border-sidebar-border pl-2 ml-5">
        {item.children?.map((child) => (
          <NavLeaf key={child.to} item={child} collapsed={false} onNavigate={onNavigate} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};

/** Navigation generated from routes.tsx, filtered by role and enabled features. */
const SidebarNav = ({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) => {
  const { user } = useAuth();
  const { data: config } = useAppConfig();
  const items = useMemo(
    () => navItemsFor(appRoutes, { role: user?.role, features: config?.features }),
    [user?.role, config?.features],
  );

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto p-2" aria-label="Main">
      {items.map((item) =>
        item.children ? (
          <NavGroup key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ) : (
          <NavLeaf key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ),
      )}
    </nav>
  );
};

const Brand = ({ collapsed }: { collapsed: boolean }) => (
  <div
    className={cn(
      'flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-4',
      collapsed && 'justify-center px-0',
    )}
  >
    <Server className="size-5 shrink-0 text-sidebar-primary" />
    {!collapsed && <span className="truncate font-semibold">Home Server</span>}
  </div>
);

export const Sidebar = () => {
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebar();
  const { pathname } = useLocation();

  // Close the mobile sheet whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <>
      <aside
        className={cn(
          'sticky top-0 hidden h-svh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        <Brand collapsed={collapsed} />
        <SidebarNav collapsed={collapsed} />
        <div className="border-t border-sidebar-border p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size={collapsed ? 'icon-lg' : 'lg'}
                className={cn(
                  !collapsed && 'w-full justify-start gap-3 px-3',
                  collapsed && 'mx-auto flex',
                )}
                onClick={toggleCollapsed}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-expanded={!collapsed}
              >
                <ToggleIcon className="size-4" />
                {!collapsed && <span>Collapse</span>}
              </Button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Expand sidebar</TooltipContent>}
          </Tooltip>
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="flex w-72 flex-col gap-0 bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Brand collapsed={false} />
          <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
};
