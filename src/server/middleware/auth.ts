import { createMiddleware } from 'hono/factory';
import { ErrorCodes } from '../common/constants/error-codes';
import { HttpStatusCode } from '../common/constants/http-status';
import { UserRole } from '../common/constants/roles.enum';
import type { AccessJwtPayload } from '../lib/jwt';
import { verifyAccessToken } from '../lib/jwt';
import { buildErrorResponse } from '../lib/responses';
import type { Env } from '../types';

export type AppBindings = Env;

export type AppVariables = {
  auth: AccessJwtPayload;
};

export const requireAuth = createMiddleware<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return c.json(
      buildErrorResponse(ErrorCodes.AUTH_UNAUTHORIZED, HttpStatusCode.UNAUTHORIZED),
      HttpStatusCode.UNAUTHORIZED,
    );
  }

  const token = header.slice('Bearer '.length).trim();
  try {
    const auth = await verifyAccessToken(c.env, token);
    c.set('auth', auth);
  } catch {
    return c.json(
      buildErrorResponse(ErrorCodes.AUTH_UNAUTHORIZED, HttpStatusCode.UNAUTHORIZED),
      HttpStatusCode.UNAUTHORIZED,
    );
  }

  await next();
});

export const requireAdmin = createMiddleware<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>(async (c, next) => {
  if (c.get('auth').role !== UserRole.ADMIN) {
    return c.json(
      buildErrorResponse(ErrorCodes.ACCESS_DENIED, HttpStatusCode.FORBIDDEN),
      HttpStatusCode.FORBIDDEN,
    );
  }
  await next();
});

/** Admin or salesman — store staff leads / quotes. */
export const requireStaff = createMiddleware<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>(async (c, next) => {
  const role = c.get('auth').role;
  if (role !== UserRole.ADMIN && role !== UserRole.SALESMAN) {
    return c.json(
      buildErrorResponse(ErrorCodes.ACCESS_DENIED, HttpStatusCode.FORBIDDEN),
      HttpStatusCode.FORBIDDEN,
    );
  }
  await next();
});
