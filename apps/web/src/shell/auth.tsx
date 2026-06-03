import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthenticatedUser, PlatformModule } from '../../../../packages/shared-types/src';
import { clearToken, getCurrentUser, getModules, getToken, login, setToken } from '../api/client';
import { useI18n } from '../i18n/I18nProvider';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  modules: PlatformModule[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { locale } = useI18n();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [modules, setModules] = useState<PlatformModule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSession() {
      if (!getToken()) {
        setLoading(false);
        return;
      }

      try {
        const [{ user: currentUser }, { modules: availableModules }] = await Promise.all([
          getCurrentUser(),
          getModules(locale)
        ]);
        setUser(currentUser);
        setModules(availableModules);
      } catch {
        clearToken();
      } finally {
        setLoading(false);
      }
    }

    void loadSession();
  }, [locale]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      modules,
      loading,
      async signIn(email, password) {
        const result = await login(email, password, locale);
        setToken(result.token);
        const { modules: availableModules } = await getModules(locale);
        setUser(result.user);
        setModules(availableModules);
      },
      signOut() {
        clearToken();
        setUser(null);
        setModules([]);
      },
      hasPermission(permission) {
        return Boolean((user?.permissions as readonly string[] | undefined)?.includes(permission));
      }
    }),
    [loading, locale, modules, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
