import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, refreshSession, sessionStore } from '@/api/client';
import type { Session, User } from '@/api/types';
import { AuthContext, type AuthContextValue, type AuthStatus } from './context';

/**
 * Holds the signed-in user. The access token stays in memory (`sessionStore`); on load the
 * session is restored from the httpOnly refresh cookie via /auth/refresh.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(() => sessionStore.get()?.user ?? null);
  const [status, setStatus] = useState<AuthStatus>(() =>
    sessionStore.get() ? 'authenticated' : 'loading',
  );

  useEffect(() => {
    const unsubscribe = sessionStore.subscribe((session) => {
      setUser(session?.user ?? null);
      setStatus(session ? 'authenticated' : 'anonymous');
      if (!session) {
        // Never show one user's cached data to the next.
        queryClient.clear();
      }
    });
    if (!sessionStore.get()) {
      void refreshSession().then((session) => {
        if (!session) setStatus('anonymous');
      });
    }
    return () => {
      unsubscribe();
    };
  }, [queryClient]);

  const login = useCallback(async (email: string, password: string) => {
    const session = await api<Session>('/auth/login', {
      method: 'POST',
      body: { email, password },
      retryOnUnauthorized: false,
    });
    sessionStore.set(session);
    return session.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      sessionStore.set(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, logout }),
    [status, user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
