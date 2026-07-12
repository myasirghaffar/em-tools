import type { Env } from './types';
import { resolveDatabaseUrlFromProcessEnv } from './lib/resolve-database-url';

/** Build Hono/Workers-style bindings from Next.js `process.env`. */
export function getServerEnv(): Env {
  const databaseUrl = resolveDatabaseUrlFromProcessEnv();
  const access = process.env.JWT_ACCESS_SECRET?.trim();
  const refresh = process.env.JWT_REFRESH_SECRET?.trim();

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is missing. Set DATABASE_URL in .env.local to the same Supabase pooler URI used by em-solar-backend.',
    );
  }
  if (!access || !refresh) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are required in .env.local');
  }

  return {
    DATABASE_URL: databaseUrl,
    IS_NODE_SERVER: 'true',
    DB_POOL_MAX: process.env.DB_POOL_MAX,
    JWT_ACCESS_SECRET: access,
    JWT_REFRESH_SECRET: refresh,
    JWT_ACCESS_EXPIRATION: process.env.JWT_ACCESS_EXPIRATION,
    JWT_REFRESH_EXPIRATION: process.env.JWT_REFRESH_EXPIRATION,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    FRONTEND_APP_URL: process.env.FRONTEND_APP_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    ADMIN_NOTIFY_EMAIL: process.env.ADMIN_NOTIFY_EMAIL,
    DEV_EXPOSE_EMAIL_LINKS: process.env.DEV_EXPOSE_EMAIL_LINKS,
    ADMIN_INVITE_SECRET: process.env.ADMIN_INVITE_SECRET,
    ENVIRONMENT: process.env.ENVIRONMENT ?? 'development',
    DEPLOYED_AT: process.env.DEPLOYED_AT,
    BUILD_TIME: process.env.BUILD_TIME,
    GIT_COMMIT: process.env.GIT_COMMIT,
    GIT_COMMIT_SHORT: process.env.GIT_COMMIT_SHORT,
    WORKER_COMPAT_DATE: process.env.WORKER_COMPAT_DATE,
  };
}
