import { getApiBaseUrl } from "../config/api";
import type { AuthUser } from "../types/auth";

/** If the API ever sends a machine-style message, show readable copy (server should already fix this). */
export function humanizeApiError(code: string, message: string): string {
  const looksLikeCode = /^[A-Z][A-Z0-9_]*$/.test(message.trim());
  if (message && !looksLikeCode) return message;

  const byCode: Record<string, string> = {
    USER_ALREADY_EXISTS:
      "An account with this email already exists. Try signing in or use Forgot password.",
    USER_NOT_FOUND: "No account was found.",
    AUTH_INVALID_CREDENTIALS: "That email or password is not correct.",
    AUTH_EMAIL_NOT_VERIFIED:
      "Please confirm your email before signing in, or request a new verification link.",
    AUTH_INVALID_OR_EXPIRED_TOKEN: "This link is invalid or has expired.",
    AUTH_EMAIL_NOT_CONFIGURED:
      "Email is not set up on the server yet. Use the verification link shown here for testing.",
    AUTH_EMAIL_SEND_FAILED: "We could not send the email. Try again later.",
    AUTH_UNAUTHORIZED: "You need to sign in again.",
    ACCESS_DENIED: "You do not have permission to do that.",
    VALIDATION_FAILED: "Please check the form and try again.",
    INTERNAL_SERVER_ERROR: "Something went wrong. Please try again.",
    PRODUCT_NOT_FOUND: "That product is not available.",
    ORDER_NOT_FOUND: "That order could not be found.",
    CONSULTATION_NOT_FOUND: "That consultation could not be found.",
    LEAD_NOT_FOUND: "That lead could not be found.",
    BLOG_NOT_FOUND: "That blog post could not be found.",
    USER_DELETE_BLOCKED: "This user cannot be removed or changed in that way.",
    TIMEOUT: "The request timed out. Try again in a moment.",
    DATABASE_NOT_CONFIGURED:
      "Database is not configured. Set DATABASE_URL in .env.local (Supabase pooler port 6543).",
    DATABASE_UNAVAILABLE:
      "Database is temporarily unavailable. Check /api/health/db and your DATABASE_URL in .env.local.",
  };
  return byCode[code] ?? (message || "Something went wrong. Please try again.");
}

export class AuthApiError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = "AuthApiError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  code?: string;
  message?: string;
  statusCode?: number;
}

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER" | "SALESMAN";
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokensPayload {
  accessToken: string;
  refreshToken: string;
  user: ApiUser;
}

function mapApiUser(u: ApiUser): AuthUser {
  const role =
    u.role === "ADMIN" ? "admin" : u.role === "SALESMAN" ? "salesman" : "user";
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role,
    emailVerified: u.emailVerified,
  };
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { accessToken?: string },
): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) {
    throw new AuthApiError("CONFIG", "API base URL is not configured", 0);
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.accessToken) {
    headers.Authorization = `Bearer ${init.accessToken}`;
  }
  const { accessToken: _a, ...rest } = init;
  const res = await fetch(`${base}${path}`, { ...rest, headers });
  const body = (await parseJson(res)) as ApiEnvelope<T> | null;
  if (!body || typeof body !== "object") {
    throw new AuthApiError(
      "NETWORK",
      "Invalid response from server",
      res.status,
    );
  }
  if (!body.success) {
    const code = body.code ?? "ERROR";
    const message = humanizeApiError(code, body.message ?? "");
    throw new AuthApiError(code, message, body.statusCode ?? res.status);
  }
  return body.data as T;
}

export async function authLogin(
  email: string,
  password: string,
): Promise<{ user: AuthUser; accessToken: string; refreshToken: string }> {
  const data = await request<AuthTokensPayload>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return {
    user: mapApiUser(data.user),
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  };
}

export async function authRegister(body: {
  name: string;
  email: string;
  password: string;
}): Promise<{ email: string; devVerificationUrl?: string }> {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function authRegisterAdmin(body: {
  name: string;
  email: string;
  password: string;
  inviteSecret: string;
}): Promise<{ email: string; devVerificationUrl?: string }> {
  return request("/auth/register-admin", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function authVerifyEmail(token: string): Promise<{
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}> {
  const data = await request<AuthTokensPayload>("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
  return {
    user: mapApiUser(data.user),
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  };
}

export async function authResendVerification(
  email: string,
): Promise<{ devVerificationUrl?: string } | null> {
  return request("/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function authForgotPassword(
  email: string,
): Promise<{ devResetUrl?: string } | null> {
  return request("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function authResetPassword(
  token: string,
  password: string,
): Promise<void> {
  await request<null>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export async function authRefresh(refreshToken: string): Promise<{
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}> {
  const data = await request<AuthTokensPayload>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
  return {
    user: mapApiUser(data.user),
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  };
}

export async function authLogout(accessToken: string): Promise<void> {
  await request<null>("/auth/logout", {
    method: "POST",
    accessToken,
    body: JSON.stringify({}),
  });
}

export async function authFetchMe(accessToken: string): Promise<AuthUser> {
  const base = getApiBaseUrl();
  if (!base) {
    throw new AuthApiError("CONFIG", "API base URL is not configured", 0);
  }
  const res = await fetch(`${base}/users/me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await parseJson(res)) as ApiEnvelope<ApiUser> | null;
  if (!body || typeof body !== "object") {
    throw new AuthApiError(
      "NETWORK",
      "Invalid response from server",
      res.status,
    );
  }
  if (!body.success) {
    const code = body.code ?? "ERROR";
    const message = humanizeApiError(code, body.message ?? "");
    throw new AuthApiError(code, message, body.statusCode ?? res.status);
  }
  return mapApiUser(body.data as ApiUser);
}
