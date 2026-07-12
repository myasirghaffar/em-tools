import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ErrorCodes } from '../common/constants/error-codes';
import { HttpStatusCode } from '../common/constants/http-status';
import { SuccessCodes } from '../common/constants/success-messages';
import { createDb } from '../db/client';
import { buildErrorResponse, buildSuccessResponse } from '../lib/responses';
import { toPublicUser } from '../lib/user-public';
import { requireAdmin, requireAuth, type AppBindings, type AppVariables } from '../middleware/auth';
import * as userService from '../services/user.service';
import { updateUserSchema } from '../validators/schemas';

export const usersRoutes = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

usersRoutes.use('*', requireAuth);

usersRoutes.get('/me', async (c) => {
  const db = createDb(c.env);
  const user = await userService.findById(db, c.get('auth').sub);
  const publicUser = toPublicUser(user);
  if (!publicUser) {
    return c.json(
      buildErrorResponse(ErrorCodes.USER_NOT_FOUND, HttpStatusCode.NOT_FOUND),
      HttpStatusCode.NOT_FOUND,
    );
  }
  return c.json(buildSuccessResponse(publicUser, SuccessCodes.USER_ME_SUCCESS));
});

usersRoutes.get('/:id', requireAdmin, async (c) => {
  const db = createDb(c.env);
  const id = c.req.param('id');
  const user = await userService.findById(db, id);
  const publicUser = toPublicUser(user);
  if (!publicUser) {
    return c.json(
      buildErrorResponse(ErrorCodes.USER_NOT_FOUND, HttpStatusCode.NOT_FOUND),
      HttpStatusCode.NOT_FOUND,
    );
  }
  return c.json(buildSuccessResponse(publicUser));
});

usersRoutes.patch('/:id', requireAdmin, zValidator('json', updateUserSchema), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');
  const db = createDb(c.env);
  const updated = await userService.updateUser(db, id, body);
  return c.json(buildSuccessResponse(toPublicUser(updated)));
});
