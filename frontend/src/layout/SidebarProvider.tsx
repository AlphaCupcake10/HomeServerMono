import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { SidebarContext } from './sidebar-context';

const STORAGE_KEY = 'sidebar:collapsed';

// localStorage can be unavailable (private mode, blocked storage): fall back to expanded.
const readCollapsed = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

const writeCollapsed = (value: boolean): void => {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Not persisted; the in-memory state still works.
  }
};

export const SidebarProvider = ({ children }: { children: ReactNode }) => {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((previous) => {
      writeCollapsed(!previous);
      return !previous;
    });
  }, []);

  const value = useMemo(
    () => ({ collapsed, toggleCollapsed, mobileOpen, setMobileOpen }),
    [collapsed, toggleCollapsed, mobileOpen],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
};
