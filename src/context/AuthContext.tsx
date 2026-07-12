"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  AuthApiError,
  authFetchMe,
  authLogin,
  authLogout,
  authRegister,
} from "../lib/authApi";
import {
  AUTH_SESSION_CLEARED,
  AUTH_SESSION_UPDATED,
  AUTH_STORAGE_KEY,
  readStoredAuth,
  refreshStoredSession,
  writeStoredAuth,
  type StoredAuth,
} from "../lib/authSession";
import type { AuthUser } from "../types/auth";

export type { AuthUser, UserRole } from "../types/auth";

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSalesman: boolean;
  isLoading: boolean;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<AuthUser | null>;
  signup: (input: { name: string; email: string; password: string }) => Promise<{
    email: string;
    devVerificationUrl?: string;
  } | null>;
  /** After email verification API returns tokens, sync React state + localStorage. */
  importSession: (data: { user: AuthUser; accessToken: string; refreshToken: string }) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Refresh access token before it expires (backend default: 1h). */
const SESSION_REFRESH_INTERVAL_MS = 50 * 60 * 1000;

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applySession = useCallback((s: StoredAuth) => {
    setUser(s.user);
    setAccessToken(s.accessToken);
    writeStoredAuth(s);
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    writeStoredAuth(null);
  }, []);

  const refreshSession = useCallback(async () => {
    const next = await refreshStoredSession();
    if (next) {
      applySession(next);
    } else {
      clearSession();
    }
  }, [applySession, clearSession]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = readStoredAuth();
      if (!stored?.refreshToken || !stored.accessToken) {
        if (!cancelled) setIsLoading(false);
        return;
      }
      try {
        const me = await authFetchMe(stored.accessToken);
        if (!cancelled) {
          setUser(me);
          setAccessToken(stored.accessToken);
        }
      } catch {
        const next = await refreshStoredSession();
        if (!cancelled) {
          if (next) applySession(next);
          else clearSession();
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession, clearSession]);

  useEffect(() => {
    if (!user) return;

    const id = window.setInterval(() => {
      void refreshSession();
    }, SESSION_REFRESH_INTERVAL_MS);

    const onSessionUpdated = (e: Event) => {
      const detail = (e as CustomEvent<StoredAuth>).detail;
      if (detail?.accessToken) {
        setUser(detail.user);
        setAccessToken(detail.accessToken);
      }
    };

    const onSessionCleared = () => clearSession();

    const onStorage = (e: StorageEvent) => {
      if (e.key !== AUTH_STORAGE_KEY) return;
      const stored = readStoredAuth();
      if (stored) applySession(stored);
      else clearSession();
    };

    window.addEventListener(AUTH_SESSION_UPDATED, onSessionUpdated);
    window.addEventListener(AUTH_SESSION_CLEARED, onSessionCleared);
    window.addEventListener("storage", onStorage);

    return () => {
      window.clearInterval(id);
      window.removeEventListener(AUTH_SESSION_UPDATED, onSessionUpdated);
      window.removeEventListener(AUTH_SESSION_CLEARED, onSessionCleared);
      window.removeEventListener("storage", onStorage);
    };
  }, [user, refreshSession, applySession, clearSession]);

  const login = async (email: string, password: string): Promise<AuthUser | null> => {
    const result = await authLogin(email, password);
    applySession({
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    return result.user;
  };

  const signup = async (input: {
    name: string;
    email: string;
    password: string;
  }): Promise<{ email: string; devVerificationUrl?: string } | null> => {
    return authRegister(input);
  };

  const importSession = useCallback(
    (data: { user: AuthUser; accessToken: string; refreshToken: string }) => {
      applySession({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
    },
    [applySession],
  );

  const logout = async (): Promise<void> => {
    const token = accessToken ?? readStoredAuth()?.accessToken;
    if (token) {
      try {
        await authLogout(token);
      } catch {
        /* still clear locally */
      }
    }
    clearSession();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAdmin: user?.role === "admin",
        isSalesman: user?.role === "salesman",
        isLoading,
        accessToken,
        login,
        signup,
        importSession,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export function isAuthApiError(e: unknown): e is AuthApiError {
  return e instanceof AuthApiError;
}
