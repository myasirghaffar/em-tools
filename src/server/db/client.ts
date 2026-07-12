import { drizzle } from 'drizzle-orm/postgres-js';
import { ErrorCodes } from '../common/constants/error-codes';
import { HttpStatusCode } from '../common/constants/http-status';
import { AppError } from '../lib/app-error';
import { createPostgresFromDatabaseUrl } from '../lib/postgres-from-env-url';
import { resolveDatabaseUrlFromProcessEnv } from '../lib/resolve-database-url';
import type { Env } from '../types';
import * as schema from './schema';

export type Database = ReturnType<typeof createDb>;

const clients = new Map<string, ReturnType<typeof createPostgresFromDatabaseUrl>>();

function isHyperdriveUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host.endsWith('.hyperdrive.local');
  } catch {
    return false;
  }
}

function parsePoolMax(env: Env): number {
  const raw = (env.DB_POOL_MAX ?? '').trim();
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n >= 1 && n <= 50) return Math.floor(n);
  return 10;
}

export function getConnectionString(env: Env): string {
  const fromEnv = env.DATABASE_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const fromHyperdrive = env.HYPERDRIVE?.connectionString;
  if (fromHyperdrive) {
    return fromHyperdrive;
  }
  throw new AppError(ErrorCodes.DATABASE_NOT_CONFIGURED, HttpStatusCode.SERVICE_UNAVAILABLE);
}

/** Node / Railway: merge process.env database URL into Env when DATABASE_URL is missing on c.env. */
export function envWithDatabaseUrl(env: Env): Env {
  if (env.DATABASE_URL?.trim()) {
    return env;
  }
  const resolved = resolveDatabaseUrlFromProcessEnv();
  if (!resolved) {
    return env;
  }
  return { ...env, DATABASE_URL: resolved };
}

/**
 * Single connection per isolate (max: 1) — required pattern for Workers + postgres.js.
 */
export function createDb(env: Env) {
  const url = getConnectionString(envWithDatabaseUrl(env));
  /**
   * Hyperdrive connection handles can be request-scoped in Workers.
   * Reusing a client across requests can throw:
   * "Cannot perform I/O on behalf of a different request".
   */
  if (isHyperdriveUrl(url)) {
    return drizzle(createPostgresFromDatabaseUrl(url), { schema });
  }

  // Cloudflare Workers should keep max=1. Node (Next.js) can safely use a small pool
  // so concurrent dashboard requests don't queue behind a single connection.
  const isNode = (env.IS_NODE_SERVER ?? '').toLowerCase() === 'true';
  const poolMax = isNode ? parsePoolMax(env) : 1;
  const cacheKey = `${url}::max=${poolMax}`;

  let sql = clients.get(cacheKey);
  if (!sql) {
    sql = createPostgresFromDatabaseUrl(url, { max: poolMax });
    clients.set(cacheKey, sql);
  }
  return drizzle(sql, { schema });
}
