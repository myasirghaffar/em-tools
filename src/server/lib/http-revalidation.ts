import type { Context } from 'hono';

type RevalidationOptions = {
  cacheControl?: string;
};

function parseHttpDateMs(raw: string | undefined): number | null {
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

function parseIfNoneMatch(headerValue: string | undefined): string[] {
  if (!headerValue) return [];
  return headerValue
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function pickLatestTimestampMs(data: unknown, depth = 0): number | null {
  if (depth > 3 || data == null) return null;
  if (Array.isArray(data)) {
    let latest: number | null = null;
    for (const item of data) {
      const candidate = pickLatestTimestampMs(item, depth + 1);
      if (candidate != null && (latest == null || candidate > latest)) latest = candidate;
    }
    return latest;
  }
  if (typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const candidateKeys = ['updatedAt', 'updated_at', 'createdAt', 'created_at', 'published_at', 'publishedAt'];
  let latest: number | null = null;
  for (const key of candidateKeys) {
    const value = obj[key];
    if (typeof value !== 'string') continue;
    const ms = Date.parse(value);
    if (!Number.isFinite(ms)) continue;
    if (latest == null || ms > latest) latest = ms;
  }
  // Also scan nested "data" payloads from API envelope { success, data }.
  if ('data' in obj) {
    const nested = pickLatestTimestampMs(obj.data, depth + 1);
    if (nested != null && (latest == null || nested > latest)) latest = nested;
  }
  return latest;
}

async function weakEtagFromPayload(payload: unknown): Promise<string> {
  const json = JSON.stringify(payload);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
  const bytes = new Uint8Array(digest);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `W/"${hex}"`;
}

export async function jsonWithRevalidation(
  c: Context,
  payload: unknown,
  options: RevalidationOptions = {},
): Promise<Response> {
  const etag = await weakEtagFromPayload(payload);
  const lastModifiedMs = pickLatestTimestampMs(payload);
  const ifNoneMatch = parseIfNoneMatch(c.req.header('if-none-match'));
  const ifModifiedSince = parseHttpDateMs(c.req.header('if-modified-since'));
  const cacheControl = options.cacheControl ?? 'private, max-age=0, must-revalidate';

  const notModifiedByTag = ifNoneMatch.includes('*') || ifNoneMatch.includes(etag);
  const notModifiedByDate =
    lastModifiedMs != null && ifModifiedSince != null && lastModifiedMs <= ifModifiedSince;
  const headers = new Headers({
    ETag: etag,
    'Cache-Control': cacheControl,
    Vary: 'Authorization',
  });
  if (lastModifiedMs != null) {
    headers.set('Last-Modified', new Date(lastModifiedMs).toUTCString());
  }

  if (notModifiedByTag || (!notModifiedByTag && notModifiedByDate)) {
    return new Response(null, { status: 304, headers });
  }

  c.header('ETag', etag);
  c.header('Cache-Control', cacheControl);
  c.header('Vary', 'Authorization');
  if (lastModifiedMs != null) {
    c.header('Last-Modified', new Date(lastModifiedMs).toUTCString());
  }
  return c.json(payload);
}
