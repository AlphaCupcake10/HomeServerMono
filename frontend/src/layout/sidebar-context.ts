import { createContext, useContext } from 'react';

export interface SidebarState {
  /** Desktop: icon-only rail instead of the full-width sidebar (remembered per browser). */
  collapsed: boolean;
  toggleCollapsed: () => void;
  /** Mobile: the off-canvas navigation sheet. */
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const SidebarContext = createContext<SidebarState | null>(null);

export const useSidebar = (): SidebarState => {
  const value = useContext(SidebarContext);
  if (!value) throw new Error('useSidebar must be used inside <SidebarProvider>');
  return value;
};
