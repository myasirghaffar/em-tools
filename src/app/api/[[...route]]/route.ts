import { app } from '@/server/app';
import { getServerEnv } from '@/server/env';

export const runtime = 'nodejs';

const env = (() => {
  try {
    return getServerEnv();
  } catch (err) {
    console.error('[em-tools api] env bootstrap failed:', err);
    return null;
  }
})();

async function handle(req: Request): Promise<Response> {
  if (!env) {
    return Response.json(
      {
        success: false,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Server environment is not configured. Check .env.local.',
        statusCode: 500,
      },
      { status: 500 },
    );
  }
  return app.fetch(req, env);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
export const OPTIONS = handle;
