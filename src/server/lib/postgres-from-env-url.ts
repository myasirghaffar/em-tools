import postgres from 'postgres';
import { normalizeDatabaseUrl } from './normalize-database-url';

/**
 * Build a postgres.js client from DATABASE_URL without mis-parsing special
 * characters in passwords (use URL decoding instead of relying on the URI alone).
 */
export function createPostgresFromDatabaseUrl(
  urlString: string,
  opts?: {
    /** postgres.js pool max (Workers should be 1). */
    max?: number;
  },
) {
  const normalized = normalizeDatabaseUrl(urlString);
  const parsed = new URL(normalized);

  const password = decodeURIComponent(parsed.password);
  const user = decodeURIComponent(parsed.username);
  const host = parsed.hostname;
  const port = parsed.port ? Number(parsed.port) : 5432;
  const database = parsed.pathname.replace(/^\//, '') || 'postgres';
  const isHyperdriveHost = host.endsWith('.hyperdrive.local');
  const max = typeof opts?.max === 'number' && Number.isFinite(opts.max) ? opts.max : 1;

  return postgres({
    host,
    port,
    database,
    user,
    password,
    /**
     * Hyperdrive endpoints are internal worker transport and should not use
     * TLS at the postgres.js layer. Direct Supabase/Neon connections still
     * keep TLS enabled.
     */
    ssl: isHyperdriveHost ? false : { rejectUnauthorized: false },
    max: isHyperdriveHost ? 1 : max,
    prepare: false,
    fetch_types: false,
    /** Avoid indefinite hangs when the pooler / network is unreachable (esp. local Wrangler). */
    connect_timeout: 15,
  });
}
