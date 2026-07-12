import { normalizeDatabaseUrl } from './normalize-database-url';

/**
 * Postgres URL for Drizzle CLI, wipe/reset/seed, and `db:apply-sql-schema`.
 * Prefers `DIRECT_URL` (session pooler, port 5432) when set — better for migrations.
 */
export function getMigrateDatabaseUrl(): string {
  const raw =
    process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!raw) {
    throw new Error(
      'Set DIRECT_URL or DATABASE_URL in em-solar-backend/.env. If CLI fails, use scripts/apply-api-schema.sql in the Supabase SQL Editor.',
    );
  }
  return normalizeDatabaseUrl(raw);
}
