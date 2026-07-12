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

function parseJsonField<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw !== "string") return (raw as T) ?? fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function normalizeProduct(p: any) {
  if (p == null || typeof p !== "object") {
    return {
      id: 0,
      name: "",
      category: "",
      price: 0,
      stock: 0,
      description: "",
      longDescription: "",
      brand: "",
      status: "active",
      images: [] as string[],
      specifications: {} as Record<string, string>,
      attachments: [] as { title: string; href: string }[],
      highlightOptions: [] as string[],
    };
  }
  let images = p?.images;
  if (typeof images === "string") images = parseJsonField<string[]>(images, []);
  if (!Array.isArray(images)) images = [];

  let specifications = p?.specifications;
  if (typeof specifications === "string")
    specifications = parseJsonField<Record<string, string>>(specifications, {});
  if (
    !specifications ||
    typeof specifications !== "object" ||
    Array.isArray(specifications)
  )
    specifications = {};

  let attachments = p?.attachments;
  if (typeof attachments === "string")
    attachments = parseJsonField<{ title: string; href: string }[]>(
      attachments,
      [],
    );
  if (!Array.isArray(attachments)) attachments = [];

  let highlightOptions = p?.highlightOptions;
  if (typeof highlightOptions === "string")
    highlightOptions = parseJsonField<string[]>(highlightOptions, []);
  if (!Array.isArray(highlightOptions)) highlightOptions = [];
  highlightOptions = (highlightOptions as unknown[])
    .filter((o): o is string => typeof o === "string" && o.trim().length > 0)
    .slice(0, 4);

  return {
    ...p,
    images,
    specifications,
    attachments,
    highlightOptions,
  };
}

function productWritePayload(p: Record<string, unknown>) {
  return {
    name: String(p.name ?? "").trim(),
    category: String(p.category ?? "").trim(),
    price: Number(p.price) || 0,
    stock: Number.parseInt(String(p.stock ?? "0"), 10) || 0,
    description: String(p.description ?? "").trim(),
    longDescription: p.longDescription
      ? String(p.longDescription).trim()
      : undefined,
    brand: p.brand ? String(p.brand).trim() : undefined,
    status:
      p.status === "inactive" ? ("inactive" as const) : ("active" as const),
    images: Array.isArray(p.images) ? (p.images as string[]) : [],
    specifications:
      p.specifications &&
      typeof p.specifications === "object" &&
      !Array.isArray(p.specifications)
        ? (p.specifications as Record<string, string>)
        : {},
    attachments: Array.isArray(p.attachments)
      ? (p.attachments as { title: string; href: string }[])
      : [],
    highlightOptions: Array.isArray(p.highlightOptions)
      ? (p.highlightOptions as string[])
          .map((o) => String(o).trim())
          .filter(Boolean)
          .slice(0, 4)
      : [],
  };
}

export async function fetchProducts(): Promise<any[]> {
  const data = await apiRequest<unknown>("/store/products", { method: "GET" });
  return ensureArray<any>(data).map(normalizeProduct);
}

export type ProductCategory = { id: number; name: string; sortOrder: number };

export async function fetchProductCategories(): Promise<ProductCategory[]> {
  const data = await apiRequest<unknown>("/store/product-categories", { method: "GET" });
  return ensureArray<ProductCategory>(data);
}

export async function fetchProductCategoriesAdmin(): Promise<ProductCategory[]> {
  const data = await apiRequest<unknown>("/admin/product-categories", { method: "GET", auth: true });
  return ensureArray<ProductCategory>(data);
}

export async function createProductCategory(payload: {
  name: string;
  sortOrder?: number;
}): Promise<ProductCategory> {
  const created = await apiRequest<ProductCategory>("/admin/product-categories", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
  invalidateAdminBootstrapCache();
  return created;
}

export async function updateProductCategory(
  id: number,
  payload: Partial<{ name: string; sortOrder: number }>,
): Promise<ProductCategory> {
  const updated = await apiRequest<ProductCategory>(`/admin/product-categories/${id}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(payload),
  });
  invalidateAdminBootstrapCache();
  return updated;
}

export async function deleteProductCategory(id: number): Promise<void> {
  await apiRequest<null>(`/admin/product-categories/${id}`, { method: "DELETE", auth: true });
  invalidateAdminBootstrapCache();
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

/** All products including inactive — admin only. */
export async function fetchProductsAdmin(): Promise<any[]> {
  const data = await apiRequest<unknown>("/admin/products", {
    method: "GET",
    auth: true,
  });
  return ensureArray<any>(data).map(normalizeProduct);
}

export async function fetchProductById(id: number): Promise<any> {
  const p = await apiRequest<any>(`/store/products/${id}`, { method: "GET" });
  return normalizeProduct(p);
}

export async function createProduct(payload: any): Promise<boolean> {
  await apiRequest("/admin/products", {
    method: "POST",
    auth: true,
    body: JSON.stringify(productWritePayload(payload)),
  });
  return true;
}

export async function updateProduct(
  id: number,
  payload: any,
): Promise<boolean> {
  await apiRequest(`/admin/products/${id}`, {
    method: "PUT",
    auth: true,
    body: JSON.stringify(productWritePayload(payload)),
  });
  return true;
}

export async function deleteProduct(id: number): Promise<boolean> {
  await apiRequest<null>(`/admin/products/${id}`, {
    method: "DELETE",
    auth: true,
  });
  return true;
}

export async function fetchOrders(): Promise<any[]> {
  const data = await apiRequest<unknown>("/admin/orders", {
    method: "GET",
    auth: true,
  });
  return ensureArray<any>(data);
}

export async function updateOrderStatus(
  id: number,
  order_status: string,
): Promise<boolean> {
  await apiRequest(`/admin/orders/${id}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify({ order_status }),
  });
  return true;
}

export type StoreOrder = {
  id: number;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  city?: string;
  address?: string;
  notes?: string;
  payment_method?: string;
  total_price?: number;
  products?: any[];
  payment_status?: string;
  order_status?: string;
  created_at?: string;
};

export async function createOrder(payload: any): Promise<StoreOrder> {
  const lines = (Array.isArray(payload.products) ? payload.products : []).map(
    (it: any) => ({
      id: typeof it.id === "number" ? it.id : undefined,
      name: String(it.name ?? ""),
      quantity: Number(it.quantity) || 0,
      price: Number(it.price) || 0,
    }),
  );
  return apiRequest<StoreOrder>("/store/orders", {
    method: "POST",
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      city: payload.city,
      address: payload.address,
      notes: payload.notes ?? "",
      payment_method: payload.payment_method ?? "cod",
      total_price: Number(payload.total_price) || 0,
      products: lines,
    }),
  });
}

export async function fetchCustomers(): Promise<any[]> {
  const data = await apiRequest<unknown>("/admin/customers", {
    method: "GET",
    auth: true,
  });
  return ensureArray<any>(data);
}

/** Signed-in customer profile row (from checkout / orders), or null. */
export async function fetchMyCustomer(): Promise<any | null> {
  return apiRequest<any | null>("/users/me/customer", {
    method: "GET",
    auth: true,
  });
}

/** @deprecated Use fetchMyCustomer — kept for older imports */
export async function fetchCustomerByEmail(
  _email: string,
): Promise<any | null> {
  return fetchMyCustomer();
}

export async function fetchMyOrders(_email: string): Promise<any[]> {
  const data = await apiRequest<unknown>("/users/me/orders", {
    method: "GET",
    auth: true,
  });
  return ensureArray<any>(data);
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

export async function createConsultation(payload: any): Promise<boolean> {
  await apiRequest("/store/consultations", {
    method: "POST",
    body: JSON.stringify({
      name: payload.name,
      phone: payload.phone,
      city: payload.city,
      monthly_bill: payload.monthly_bill ?? "",
      message: payload.message ?? "",
    }),
  });
  return true;
}

export async function createContactMessage(payload: {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}): Promise<boolean> {
  await apiRequest("/store/contact-messages", {
    method: "POST",
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      phone: payload.phone ?? "",
      subject: payload.subject,
      message: payload.message,
    }),
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

export type ChartPoint = { label: string; sales: number; orders: number };

export async function fetchAnalytics(): Promise<{
  totalSales: number;
  totalOrders: number;
  totalCustomers: number;
  totalProducts: number;
  monthlySales: number[];
  orderGrowth: number[];
  chartSeries: {
    weekly: ChartPoint[];
    monthly: ChartPoint[];
    yearly: ChartPoint[];
  };
}> {
  return apiRequest("/admin/analytics", { method: "GET", auth: true });
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
  /** Legacy store fields (optional if an older API responds). */
  products?: any[];
  productCategories?: ProductCategory[];
  orders?: any[];
  customers?: any[];
  blogs?: any[];
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

/** Clear short-lived admin bootstrap cache after mutations (e.g. blogs). */
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

/** Public blog card shape (store + admin list). */
export type BlogPost = {
  id: number;
  title: string;
  tag: string;
  image: string;
  date: string;
  excerpt: string;
  body: string;
  is_published: boolean;
  published_at: string;
  created_at?: string;
  updated_at?: string;
};

export async function fetchStoreBlogs(): Promise<BlogPost[]> {
  const data = await apiRequest<unknown>("/store/blogs", { method: "GET" });
  return ensureArray<BlogPost>(data);
}

export async function fetchStoreBlog(id: number): Promise<BlogPost> {
  return apiRequest<BlogPost>(`/store/blogs/${id}`, { method: "GET" });
}

export async function fetchAdminBlogs(): Promise<BlogPost[]> {
  const data = await apiRequest<unknown>("/admin/blogs", { method: "GET", auth: true });
  return ensureArray<BlogPost>(data);
}

export async function createAdminBlog(payload: {
  title: string;
  tag?: string;
  imageUrl: string;
  excerpt?: string;
  body?: string;
  isPublished?: boolean;
  publishedAt?: string;
}): Promise<BlogPost> {
  return apiRequest<BlogPost>("/admin/blogs", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function updateAdminBlog(
  id: number,
  payload: Partial<{
    title: string;
    tag: string;
    imageUrl: string;
    excerpt: string;
    body: string;
    isPublished: boolean;
    publishedAt: string;
  }>,
): Promise<BlogPost> {
  return apiRequest<BlogPost>(`/admin/blogs/${id}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminBlog(id: number): Promise<void> {
  await apiRequest<null>(`/admin/blogs/${id}`, { method: "DELETE", auth: true });
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
