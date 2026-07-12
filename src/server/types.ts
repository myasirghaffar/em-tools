/**
 * Cloudflare Worker bindings (wrangler.toml + secrets + optional Hyperdrive).
 */
export interface Env {
  /** Direct Postgres URL (Neon, Supabase pooler, local). Used when HYPERDRIVE is unset. */
  DATABASE_URL?: string;
  /** Hyperdrive binding — preferred in production. */
  HYPERDRIVE?: Hyperdrive;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRATION?: string;
  JWT_REFRESH_EXPIRATION?: string;
  /** Comma-separated list of allowed CORS origins. */
  ALLOWED_ORIGINS?: string;

  /** Public site URL for email links (verify email, reset password). No trailing slash. */
  FRONTEND_APP_URL?: string;
  /** Resend API key (https://resend.com). */
  RESEND_API_KEY?: string;
  /** From address, e.g. `EnergyMart <onboarding@resend.dev>`. */
  EMAIL_FROM?: string;
  /** Inbox for contact-form admin alerts. Falls back to first active admin user email. */
  ADMIN_NOTIFY_EMAIL?: string;
  /** When true and Resend is unset, register/resend may include a dev-only verification URL in JSON. */
  DEV_EXPOSE_EMAIL_LINKS?: string;
  /** If set, POST /auth/register-admin requires this exact secret in the JSON body. */
  ADMIN_INVITE_SECRET?: string;

  /** Shown on HTML status page (`/`, `/status`). Examples: `development`, `production`. */
  ENVIRONMENT?: string;
  /** ISO 8601 timestamp of last deploy (set in CI / wrangler). */
  DEPLOYED_AT?: string;
  /** Alias for `DEPLOYED_AT` in some pipelines. */
  BUILD_TIME?: string;
  /** Full git SHA for status page “last merge”. */
  GIT_COMMIT?: string;
  /** Short SHA (optional; otherwise first 7 of `GIT_COMMIT`). */
  GIT_COMMIT_SHORT?: string;

  /** Shown on status page for Workers (match `compatibility_date` in wrangler.toml when you bump it). */
  WORKER_COMPAT_DATE?: string;

  /**
   * When running the same Hono app on Node (Railway/local `npm start`), we can safely use a small
   * Postgres connection pool. In Workers, keep pool size at 1.
   */
  IS_NODE_SERVER?: string;
  /** Optional override for Node Postgres pool size (default: 10). */
  DB_POOL_MAX?: string;
}

/** Cloudflare Hyperdrive binding shape. */
export interface Hyperdrive {
  connectionString: string;
}
