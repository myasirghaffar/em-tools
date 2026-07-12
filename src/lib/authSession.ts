import { authRefresh } from "./authApi";
import type { AuthUser } from "../types/auth";

export const AUTH_STORAGE_KEY = "em-tools-auth";

export type StoredAuth = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

export function readStoredAuth(): StoredAuth | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredAuth>;
    if (
      parsed?.user?.email &&
      typeof parsed.accessToken === "string" &&
      typeof parsed.refreshToken === "string"
    ) {
      return parsed as StoredAuth;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function writeStoredAuth(data: StoredAuth | null): void {
  if (!data) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
}

export const AUTH_SESSION_UPDATED = "em-tools-auth-updated";
export const AUTH_SESSION_CLEARED = "em-tools-auth-cleared";

export function notifyAuthSessionUpdated(session: StoredAuth): void {
  window.dispatchEvent(
    new CustomEvent(AUTH_SESSION_UPDATED, { detail: session }),
  );
}

let refreshInFlight: Promise<StoredAuth | null> | null = null;

/** Single-flight refresh — safe for parallel API calls and multiple tabs. */
export async function refreshStoredSession(): Promise<StoredAuth | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const stored = readStoredAuth();
    if (!stored?.refreshToken) return null;
    try {
      const next = await authRefresh(stored.refreshToken);
      const session: StoredAuth = {
        user: next.user,
        accessToken: next.accessToken,
        refreshToken: next.refreshToken,
      };
      writeStoredAuth(session);
      notifyAuthSessionUpdated(session);
      return session;
    } catch {
      writeStoredAuth(null);
      window.dispatchEvent(new CustomEvent(AUTH_SESSION_CLEARED));
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export function readAccessToken(): string | null {
  return readStoredAuth()?.accessToken ?? null;
}
