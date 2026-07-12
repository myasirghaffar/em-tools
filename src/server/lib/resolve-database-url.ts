import { scoreDatabaseUrl } from './database-url-diagnostics';

/**
 * Resolve Postgres URL from process.env (Node / Railway / local .env).
 * Railway + Supabase plugins may inject a broken DIRECT_URL (db.*.supabase.co);
 * we prefer Supabase pooler URLs (session :5432) when multiple vars are set.
 */
export function resolveDatabaseUrlFromProcessEnv(): string | undefined {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.DIRECT_URL,
    process.env.POSTGRES_URL,
    process.env.DATABASE_PRIVATE_URL,
    process.env.SUPABASE_DATABASE_URL,
  ]
    .map((raw) => raw?.trim())
    .filter((url): url is string => Boolean(url));

  if (candidates.length > 0) {
    return [...candidates].sort((a, b) => scoreDatabaseUrl(a) - scoreDatabaseUrl(b))[0];
  }

  const host = process.env.PGHOST?.trim();
  const user = process.env.PGUSER?.trim();
  const password = process.env.PGPASSWORD;
  const database = process.env.PGDATABASE?.trim() || 'postgres';
  const port = process.env.PGPORT?.trim() || '5432';
  if (host && user && password != null && password !== '') {
    const encUser = encodeURIComponent(user);
    const encPass = encodeURIComponent(password);
    return `postgresql://${encUser}:${encPass}@${host}:${port}/${database}`;
  }

  return undefined;
}
