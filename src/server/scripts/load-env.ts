import dotenv from "dotenv";
import { resolve } from "node:path";

/**
 * Load `.dev.vars` then `.env` with override so `.env` wins over stale `.dev.vars`.
 * If `DATABASE_URL` was already set in the environment (e.g. `DATABASE_URL=... npm run db:wipe-all`),
 * it is restored after loading files so one-off overrides work.
 */
export function loadBackendEnv(): void {
  const presetDatabaseUrl = process.env.DATABASE_URL?.trim();
  dotenv.config({ path: resolve(process.cwd(), ".dev.vars") });
  dotenv.config({ path: resolve(process.cwd(), ".env"), override: true });
  if (presetDatabaseUrl) {
    process.env.DATABASE_URL = presetDatabaseUrl;
  }
}

export { normalizeDatabaseUrl } from "../lib/normalize-database-url";
