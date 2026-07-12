import { Hono } from 'hono';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { cors } from 'hono/cors';
import { ZodError } from 'zod';
import { ErrorCodes } from './common/constants/error-codes';
import { HttpStatusCode } from './common/constants/http-status';
import { AppError } from './lib/app-error';
import { buildErrorResponse } from './lib/responses';
import type { AppBindings, AppVariables } from './middleware/auth';
import { mapDatabaseFaultFromChain } from './lib/map-database-fault';
import { envWithDatabaseUrl, getConnectionString } from './db/client';
import { parseDatabaseUrlDiagnostics } from './lib/database-url-diagnostics';
import { pingDatabase } from './lib/ping-database';
import { adminRoutes } from './routes/admin.routes';
import { authRoutes } from './routes/auth.routes';
import { leadsRoutes } from './routes/leads.routes';
import { usersRoutes } from './routes/users.routes';

/**
 * em-tools API — admin/tools modules only (no shop/storefront).
 * Mounted under Next.js at `/api/*`.
 */
const app = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>().basePath('/api');

app.use(
  '*',
  cors({
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    origin: (origin, c) => {
      const raw = c.env.ALLOWED_ORIGINS ?? '';
      const list = raw
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      if (list.length === 0 || list.includes('*')) {
        return origin ?? '*';
      }
      if (!origin) {
        return list[0];
      }
      if (list.includes(origin)) {
        return origin;
      }
      return false;
    },
  }),
);

app.get('/', (c) =>
  c.json({
    name: 'em-tools-api',
    ok: true,
  }),
);

app.get('/health', (c) => c.json({ ok: true }));

app.get('/health/db', async (c) => {
  const env = envWithDatabaseUrl(c.env);
  let connectionString: string | undefined;
  try {
    connectionString = getConnectionString(env);
  } catch {
    connectionString = undefined;
  }
  const config = parseDatabaseUrlDiagnostics(connectionString);
  const result = await pingDatabase(env);
  if (result.ok) {
    return c.json({ ok: true, database: 'connected', config });
  }
  return c.json(
    {
      ok: false,
      database: 'unavailable',
      code: result.code,
      postgresMessage: result.message,
      config,
    },
    503,
  );
});

app.route('/auth', authRoutes);
app.route('/users', usersRoutes);
app.route('/admin', adminRoutes);
app.route('/leads', leadsRoutes);

app.notFound((c) =>
  c.json(
    buildErrorResponse(
      ErrorCodes.VALIDATION_FAILED,
      HttpStatusCode.NOT_FOUND,
      `Route not found: ${c.req.method} ${c.req.path}`,
    ),
    HttpStatusCode.NOT_FOUND as ContentfulStatusCode,
  ),
);

app.onError((err, c: Context<{ Bindings: AppBindings; Variables: AppVariables }>) => {
  if (err instanceof AppError) {
    return c.json(
      buildErrorResponse(err.errorCode, err.statusCode, err.message),
      err.statusCode as ContentfulStatusCode,
    );
  }

  if (err instanceof ZodError) {
    const first = err.issues[0]?.message ?? 'Invalid request';
    return c.json(
      buildErrorResponse(ErrorCodes.VALIDATION_FAILED, HttpStatusCode.BAD_REQUEST, first),
      HttpStatusCode.BAD_REQUEST as ContentfulStatusCode,
    );
  }

  const dbFault = mapDatabaseFaultFromChain(err);
  if (dbFault) {
    console.error('[database]', dbFault.logLabel, err);
    return c.json(
      buildErrorResponse(dbFault.code, dbFault.statusCode),
      dbFault.statusCode as ContentfulStatusCode,
    );
  }

  console.error(err);
  return c.json(
    buildErrorResponse(
      ErrorCodes.INTERNAL_SERVER_ERROR,
      HttpStatusCode.INTERNAL_SERVER_ERROR,
      err instanceof Error ? err.message : undefined,
    ),
    HttpStatusCode.INTERNAL_SERVER_ERROR as ContentfulStatusCode,
  );
});

export { app };
