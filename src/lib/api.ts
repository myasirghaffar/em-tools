import { getApiBaseUrl } from "../config/api";
import { humanizeApiError } from "./authApi";
import {
  readAccessToken,
  readStoredAuth,
  refreshStoredSession,
} from "./authSession";

export class ApiError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
  }
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

function ensureArray<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

const API_FETCH_TIMEOUT_MS = 25_000;
const API_GET_CACHE_STORAGE_KEY = "energymart-api-get-cache-v1";
const API_GET_CACHE_FRESH_PUBLIC_MS = 5 * 60_000;
const API_GET_CACHE_FRESH_AUTH_MS = 60_000;

type ApiGetCacheEntry = {
  data: unknown;
  updatedAtMs: number;
  etag?: string;
  lastModified?: string;
};

let inMemoryGetCache: Record<string, ApiGetCacheEntry> | null = null;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function loadApiGetCache(): Record<string, ApiGetCacheEntry> {
  if (inMemoryGetCache) return inMemoryGetCache;
  if (!canUseStorage()) {
    inMemoryGetCache = {};
    return inMemoryGetCache;
  }
  const raw = localStorage.getItem(API_GET_CACHE_STORAGE_KEY);
  if (!raw) {
    inMemoryGetCache = {};
    return inMemoryGetCache;
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, ApiGetCacheEntry>;
    inMemoryGetCache = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    inMemoryGetCache = {};
  }
  return inMemoryGetCache;
}

function saveApiGetCache(next: Record<string, ApiGetCacheEntry>): void {
  inMemoryGetCache = next;
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(API_GET_CACHE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota / private-mode errors.
  }
}

function clearApiGetCache(): void {
  inMemoryGetCache = {};
  if (!canUseStorage()) return;
  localStorage.removeItem(API_GET_CACHE_STORAGE_KEY);
}

function authScopeKey(auth: boolean | undefined): string {
  if (!auth) return "public";
  const email = readStoredAuth()?.user?.email?.trim().toLowerCase();
  return email ? `auth:${email}` : "auth:anonymous";
}

function buildApiGetCacheKey(base: string, path: string, authScope: string): string {
  return `${base}|${path}|${authScope}`;
}

function readApiGetCacheEntry(key: string): ApiGetCacheEntry | null {
  const store = loadApiGetCache();
  return store[key] ?? null;
}

function writeApiGetCacheEntry(key: string, entry: ApiGetCacheEntry): void {
  const store = loadApiGetCache();
  store[key] = entry;
  saveApiGetCache(store);
}

function touchApiGetCacheEntry(key: string): void {
  const store = loadApiGetCache();
  const current = store[key];
  if (!current) return;
  store[key] = { ...current, updatedAtMs: Date.now() };
  saveApiGetCache(store);
}

if (typeof window !== "undefined") {
  window.addEventListener("em-tools-auth-cleared", () => {
    clearApiGetCache();
  });
}

async function apiRequest<T>(
  path: string,
  init: RequestInit & { auth?: boolean; forceRefresh?: boolean } = {},
  retried = false,
): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) {
    throw new ApiError("CONFIG", "API base URL is not configured", 0);
  }
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  const method = String(init.method ?? "GET").toUpperCase();
  const body = init.body;
  if (body !== undefined && typeof body === "string") {
    headers["Content-Type"] = "application/json";
  }
  if (init.auth) {
    const t = readAccessToken();
    if (!t) {
      throw new ApiError(
        "AUTH_UNAUTHORIZED",
        humanizeApiError("AUTH_UNAUTHORIZED", ""),
        401,
      );
    }
    headers.Authorization = `Bearer ${t}`;
  }
  const { auth: _auth, forceRefresh, ...rest } = init;
  const isGet = method === "GET";
  const cacheFreshMs = init.auth
    ? API_GET_CACHE_FRESH_AUTH_MS
    : API_GET_CACHE_FRESH_PUBLIC_MS;
  const scope = authScopeKey(init.auth);
  const cacheKey = buildApiGetCacheKey(base, path, scope);
  const cached = isGet ? readApiGetCacheEntry(cacheKey) : null;
  if (
    isGet &&
    !forceRefresh &&
    cached &&
    Date.now() - cached.updatedAtMs <= cacheFreshMs
  ) {
    return cached.data as T;
  }
  if (isGet && cached) {
    if (cached.etag) headers["If-None-Match"] = cached.etag;
    if (cached.lastModified) headers["If-Modified-Since"] = cached.lastModified;
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...rest,
      headers,
      signal: controller.signal,
    });
  } catch (e) {
    if (isGet && cached) {
      return cached.data as T;
    }
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new ApiError(
        "TIMEOUT",
        "The server took too long to respond. Check your connection and API URL, then try again.",
        0,
      );
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
  const json = (await parseJson(res)) as {
    success?: boolean;
    data?: T;
    code?: string;
    message?: string;
    statusCode?: number;
  } | null;

  const unauthorized =
    res.status === 401 ||
    json?.code === "AUTH_UNAUTHORIZED" ||
    json?.statusCode === 401;

  if (init.auth && unauthorized && !retried) {
    const session = await refreshStoredSession();
    if (session?.accessToken) {
      return apiRequest<T>(path, init, true);
    }
  }

  if (isGet && res.status === 304 && cached) {
    touchApiGetCacheEntry(cacheKey);
    return cached.data as T;
  }

  if (!json || typeof json !== "object" || json.success !== true) {
    if (isGet && cached) {
      // Offline / transient API failures: keep app usable with last known data.
      return cached.data as T;
    }
    const code = json?.code ?? "ERROR";
    const msg = humanizeApiError(code, String(json?.message ?? ""));
    throw new ApiError(code, msg, json?.statusCode ?? res.status);
  }
  if (isGet) {
    writeApiGetCacheEntry(cacheKey, {
      data: json.data as unknown,
      updatedAtMs: Date.now(),
      etag: res.headers.get("ETag") ?? undefined,
      lastModified: res.headers.get("Last-Modified") ?? undefined,
    });
  } else if (res.ok) {
    // Any successful write may change list/detail endpoints.
    clearApiGetCache();
  }
  return json.data as T;
}

export type QuoteTemplate = {
  id: number;
  category: string;
  title: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export async function fetchQuoteTemplates(): Promise<QuoteTemplate[]> {
  const data = await apiRequest<unknown>("/leads/quote-templates", {
    method: "GET",
    auth: true,
  });
  return ensureArray<QuoteTemplate>(data);
}

export async function fetchQuoteTemplatesAdmin(): Promise<QuoteTemplate[]> {
  const data = await apiRequest<unknown>("/admin/quote-templates", {
    method: "GET",
    auth: true,
  });
  return ensureArray<QuoteTemplate>(data);
}

export async function createQuoteTemplate(payload: {
  category: string;
  title: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<QuoteTemplate> {
  const created = await apiRequest<QuoteTemplate>("/admin/quote-templates", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
  invalidateAdminBootstrapCache();
  return created;
}

export async function updateQuoteTemplate(
  id: number,
  payload: Partial<{
    category: string;
    title: string;
    description: string;
    sortOrder: number;
    isActive: boolean;
  }>,
): Promise<QuoteTemplate> {
  const updated = await apiRequest<QuoteTemplate>(`/admin/quote-templates/${id}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(payload),
  });
  invalidateAdminBootstrapCache();
  return updated;
}

export async function deleteQuoteTemplate(id: number): Promise<void> {
  await apiRequest<null>(`/admin/quote-templates/${id}`, { method: "DELETE", auth: true });
  invalidateAdminBootstrapCache();
}

export async function fetchConsultations(): Promise<any[]> {
  const data = await apiRequest<unknown>("/admin/consultations", {
    method: "GET",
    auth: true,
  });
  return ensureArray<any>(data);
}

export async function updateConsultationStatus(
  id: number,
  status: string,
): Promise<boolean> {
  await apiRequest(`/admin/consultations/${id}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify({ status }),
  });
  return true;
}

export async function fetchContactMessages(): Promise<any[]> {
  const data = await apiRequest<unknown>("/admin/contact-messages", {
    method: "GET",
    auth: true,
  });
  return ensureArray<any>(data);
}

export async function updateContactMessageStatus(
  id: number,
  status: string,
): Promise<boolean> {
  await apiRequest(`/admin/contact-messages/${id}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify({ status }),
  });
  return true;
}

export type ToolsAnalytics = {
  totalLeads: number;
  totalQuotes: number;
  totalSalesTeam: number;
  totalQuoteTemplates: number;
  openConsultations: number;
  openMessages: number;
  leadStatusCounts: Record<string, number>;
};

type AdminBootstrapPayload = {
  quoteTemplates?: QuoteTemplate[];
  consultations?: any[];
  contactMessages?: any[];
  leads?: any[];
  salesTeam?: any[];
  analytics: ToolsAnalytics | Record<string, unknown>;
};

let adminBootstrapCache:
  | { atMs: number; data: AdminBootstrapPayload }
  | undefined;

export function getAdminBootstrapCache(): AdminBootstrapPayload | null {
  if (!adminBootstrapCache) return null;
  // Keep cache short-lived so admin changes propagate quickly.
  if (Date.now() - adminBootstrapCache.atMs > 60_000) return null;
  return adminBootstrapCache.data;
}

/** Clear short-lived admin bootstrap cache after mutations. */
export function invalidateAdminBootstrapCache(): void {
  adminBootstrapCache = undefined;
}

export async function fetchAdminBootstrap(): Promise<AdminBootstrapPayload> {
  const cached = getAdminBootstrapCache();
  if (cached) return cached;
  const data = await apiRequest<unknown>("/admin/bootstrap", {
    method: "GET",
    auth: true,
  });
  const payload = (data ?? {}) as AdminBootstrapPayload;
  adminBootstrapCache = { atMs: Date.now(), data: payload };
  return payload;
}

// --- Leads & sales team (admin / salesman) ---

export type QuoteLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  /** Shop catalog `products.id` when selected from the store */
  productId?: number | null;
  /** Selected specification line, e.g. `Power: 550W` */
  variantLabel?: string | null;
  /** Category dropdown: a known `product_categories.name` or `"__custom__"` */
  catalogCategoryKey?: string | null;
  /** When `catalogCategoryKey` is `"__custom__"`, free-text filter / label for that line */
  catalogCustomCategory?: string | null;
  /** Bold product / line title on the quotation PDF */
  itemTitle?: string | null;
  /** Multi-line supporting copy under the title on the PDF (specs, notes, etc.) */
  itemDescription?: string | null;
  /** When false, line is hidden from the generated PDF (still saved on the lead). Default true. */
  includeInPdf?: boolean;
};

export type LeadQuoteData = {
  lines: QuoteLine[];
  taxPercent?: number;
  discountAmount?: number;
  notes?: string;
  validUntil?: string;
};

export type LeadRecord = {
  id: number;
  name: string;
  contact: string;
  location: string;
  productInterest: string;
  status: string;
  notes: string;
  assignedToUserId: string | null;
  createdByUserId: string;
  quoteData: LeadQuoteData | null;
  createdAt: string;
  updatedAt: string;
  assignedToName: string | null;
  createdByName: string | null;
};

export async function fetchLeads(): Promise<LeadRecord[]> {
  const data = await apiRequest<unknown>("/leads", {
    method: "GET",
    auth: true,
  });
  return ensureArray<LeadRecord>(data);
}

export async function fetchLead(id: number): Promise<LeadRecord> {
  return apiRequest<LeadRecord>(`/leads/${id}`, { method: "GET", auth: true });
}

export async function createLead(payload: {
  name: string;
  contact: string;
  location: string;
  productInterest?: string;
  notes?: string;
  assignedToUserId?: string | null;
}): Promise<LeadRecord> {
  return apiRequest<LeadRecord>("/leads", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function updateLead(
  id: number,
  payload: Partial<{
    name: string;
    contact: string;
    location: string;
    productInterest: string;
    status: string;
    notes: string;
    assignedToUserId: string | null;
    quoteData: LeadQuoteData | null;
  }>,
): Promise<LeadRecord> {
  return apiRequest<LeadRecord>(`/leads/${id}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function deleteLead(id: number): Promise<void> {
  await apiRequest<{ ok: true }>(`/leads/${id}`, {
    method: "DELETE",
    auth: true,
  });
}

export type SalesTeamUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function fetchSalesTeam(): Promise<SalesTeamUser[]> {
  const data = await apiRequest<unknown>("/admin/sales-team", {
    method: "GET",
    auth: true,
  });
  return ensureArray<SalesTeamUser>(data);
}

export async function createSalesTeamMember(body: {
  name: string;
  email: string;
  password: string;
}): Promise<SalesTeamUser> {
  return apiRequest<SalesTeamUser>("/admin/sales-team", {
    method: "POST",
    auth: true,
    body: JSON.stringify(body),
  });
}

export async function patchSalesTeamMember(
  id: string,
  body: Partial<{
    name: string;
    email: string;
    password: string;
    isActive: boolean;
  }>,
): Promise<SalesTeamUser> {
  return apiRequest<SalesTeamUser>(`/admin/sales-team/${id}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(body),
  });
}

/** System accounts (admin, store user, sales) — same shape as sales team rows. */
export type SystemUserRow = SalesTeamUser;

export async function fetchAdminUsers(): Promise<SystemUserRow[]> {
  const data = await apiRequest<unknown>("/admin/users", {
    method: "GET",
    auth: true,
  });
  return ensureArray<SystemUserRow>(data);
}

export async function createAdminUser(body: {
  name: string;
  email: string;
  password: string;
  role: "ADMIN" | "USER" | "SALESMAN";
}): Promise<SystemUserRow> {
  return apiRequest<SystemUserRow>("/admin/users", {
    method: "POST",
    auth: true,
    body: JSON.stringify(body),
  });
}

export async function patchSystemUser(
  id: string,
  body: Partial<{
    name: string;
    email: string;
    password: string;
    role: "ADMIN" | "USER" | "SALESMAN";
    isActive: boolean;
  }>,
): Promise<SystemUserRow> {
  return apiRequest<SystemUserRow>(`/users/${id}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(body),
  });
}

export async function deleteSystemUser(id: string): Promise<void> {
  await apiRequest<null>(`/admin/users/${id}`, {
    method: "DELETE",
    auth: true,
  });
}
