import { sql } from 'drizzle-orm';
import type { Database } from '../db/client';
import { firstExecuteRow } from './pg-first-row';

async function enumHasSalesmanLabel(db: Database): Promise<boolean> {
  const result = await db.execute(
    sql.raw(`
      SELECT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_enum e
        INNER JOIN pg_catalog.pg_type t ON t.oid = e.enumtypid
        INNER JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typname = 'enum_users_role'
          AND e.enumlabel = 'SALESMAN'
      ) AS "hasSalesman"
    `),
  );
  const row = firstExecuteRow(result);
  return row?.hasSalesman === true;
}

/**
 * Older databases only had enum values ADMIN + USER. Inserts/selects for SALESMAN fail until
 * the enum is altered. Idempotent: safe to call from API handlers.
 *
 * We check pg_enum first so we never run ADD VALUE when the label exists — PG 15+ still
 * emits NOTICE 42710 for `ADD VALUE IF NOT EXISTS` in some cases, which clutters logs.
 */
export async function ensureSalesmanEnumValue(db: Database): Promise<void> {
  if (await enumHasSalesmanLabel(db)) {
    return;
  }

  try {
    await db.execute(sql.raw(`ALTER TYPE enum_users_role ADD VALUE IF NOT EXISTS 'SALESMAN'`));
    return;
  } catch {
    /* PostgreSQL < 15: no IF NOT EXISTS on ADD VALUE */
  }
  try {
    await db.execute(sql.raw(`ALTER TYPE enum_users_role ADD VALUE 'SALESMAN'`));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const code = (e as { code?: string })?.code;
    if (code === '42710' || /already exists|duplicate/i.test(msg)) {
      return;
    }
    throw e;
  }
}
