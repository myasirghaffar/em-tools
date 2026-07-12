import { sql } from 'drizzle-orm';
import type { Database } from '../db/client';
import { ensureSalesmanEnumValue } from './ensure-salesman-enum';
import { firstExecuteRow } from './pg-first-row';

/**
 * Remote DBs that never ran `scripts/apply-api-schema.sql` have no `leads` table → 42P01.
 * Idempotent: safe to call on every process / first request.
 *
 * We query pg_catalog first and only run CREATE for missing objects so PostgreSQL does not
 * emit NOTICE 42P07 (`... already exists, skipping`) on every startup.
 */
let ensuredForProcess = false;

const CREATE_LEADS_TABLE = `
CREATE TABLE "leads" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(255) NOT NULL,
  "contact" varchar(64) NOT NULL,
  "location" varchar(255) NOT NULL,
  "productInterest" varchar(255) NOT NULL DEFAULT 'Solar Panels',
  "status" varchar(64) NOT NULL DEFAULT 'New',
  "notes" text NOT NULL DEFAULT '',
  "assignedToUserId" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "createdByUserId" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "quoteData" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
)`;

const CREATE_IX_ASSIGNED = `CREATE INDEX "leads_assigned_idx" ON "leads" ("assignedToUserId")`;
const CREATE_IX_CREATOR = `CREATE INDEX "leads_creator_idx" ON "leads" ("createdByUserId")`;

async function leadsObjectsExist(db: Database): Promise<{
  hasTable: boolean;
  hasIxAssigned: boolean;
  hasIxCreator: boolean;
}> {
  const result = await db.execute(
    sql.raw(`
      SELECT
        EXISTS (
          SELECT 1 FROM pg_catalog.pg_tables
          WHERE schemaname = 'public' AND tablename = 'leads'
        ) AS "hasTable",
        EXISTS (
          SELECT 1 FROM pg_catalog.pg_indexes
          WHERE schemaname = 'public' AND indexname = 'leads_assigned_idx'
        ) AS "hasIxAssigned",
        EXISTS (
          SELECT 1 FROM pg_catalog.pg_indexes
          WHERE schemaname = 'public' AND indexname = 'leads_creator_idx'
        ) AS "hasIxCreator"
    `),
  );
  const row = firstExecuteRow(result);
  return {
    hasTable: row?.hasTable === true,
    hasIxAssigned: row?.hasIxAssigned === true,
    hasIxCreator: row?.hasIxCreator === true,
  };
}

function isDuplicatePgObject(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  return code === '42P07' || code === '42710';
}

export async function ensureLeadsSchema(db: Database): Promise<void> {
  if (ensuredForProcess) return;

  await ensureSalesmanEnumValue(db);

  let { hasTable, hasIxAssigned, hasIxCreator } = await leadsObjectsExist(db);

  if (hasTable && hasIxAssigned && hasIxCreator) {
    ensuredForProcess = true;
    return;
  }

  if (!hasTable) {
    try {
      await db.execute(sql.raw(CREATE_LEADS_TABLE));
    } catch (e: unknown) {
      if (!isDuplicatePgObject(e)) throw e;
    }
    ({ hasTable, hasIxAssigned, hasIxCreator } = await leadsObjectsExist(db));
  }

  if (!hasIxAssigned) {
    try {
      await db.execute(sql.raw(CREATE_IX_ASSIGNED));
    } catch (e: unknown) {
      if (!isDuplicatePgObject(e)) throw e;
    }
  }
  if (!hasIxCreator) {
    try {
      await db.execute(sql.raw(CREATE_IX_CREATOR));
    } catch (e: unknown) {
      if (!isDuplicatePgObject(e)) throw e;
    }
  }

  ensuredForProcess = true;
}
