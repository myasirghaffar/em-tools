/** Safe connection metadata for logs and /health/db (no password). */
export type DatabaseUrlDiagnostics = {
  hasUrl: boolean;
  parseError?: boolean;
  host?: string;
  port?: string;
  user?: string;
  database?: string;
  usesPooler?: boolean;
  usesDirectSupabaseHost?: boolean;
};

function normalizePostgresUrl(url: string): string {
  return url.trim().replace(/^postgres:\/\//, 'postgresql://');
}

export function parseDatabaseUrlDiagnostics(url: string | undefined): DatabaseUrlDiagnostics {
  const trimmed = url?.trim();
  if (!trimmed) {
    return { hasUrl: false };
  }
  try {
    const u = new URL(normalizePostgresUrl(trimmed));
    const host = u.hostname;
    const port = u.port || '5432';
    return {
      hasUrl: true,
      host,
      port,
      user: u.username,
      database: u.pathname.replace(/^\//, '') || 'postgres',
      usesPooler: host.includes('pooler.supabase.com'),
      usesDirectSupabaseHost: host.startsWith('db.') && host.endsWith('.supabase.co'),
    };
  } catch {
    return { hasUrl: true, parseError: true };
  }
}

/** Lower score = preferred for Next.js (transaction pooler over session). */
export function scoreDatabaseUrl(url: string): number {
  const d = parseDatabaseUrlDiagnostics(url);
  if (!d.hasUrl || d.parseError) return 100;
  if (d.usesPooler) {
    // Prefer transaction pooler (:6543) — session (:5432) hits max clients quickly.
    return d.port === '6543' ? 0 : 1;
  }
  if (d.usesDirectSupabaseHost) return 20;
  return 10;
}
