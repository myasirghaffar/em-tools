import { sql } from 'drizzle-orm';
import { createDb } from '../db/client';
import type { Env } from '../types';

export type DbPingResult =
  | { ok: true }
  | { ok: false; code: string; message: string; logLabel?: string };

export async function pingDatabase(env: Env): Promise<DbPingResult> {
  try {
    const db = createDb(env);
    await db.execute(sql`select 1 as ok`);
    return { ok: true };
  } catch (err) {
    const e = err as { code?: string; message?: string; name?: string };
    const code = typeof e.code === 'string' ? e.code : 'UNKNOWN';
    const message =
      typeof e.message === 'string' ? e.message : err instanceof Error ? err.message : 'Database ping failed';
    return { ok: false, code, message, logLabel: `${code}:${e.name ?? 'Error'}` };
  }
}
