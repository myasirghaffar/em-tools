import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ErrorCodes } from '../common/constants/error-codes';
import { HttpStatusCode } from '../common/constants/http-status';
import { SuccessCodes } from '../common/constants/success-messages';
import { createDb } from '../db/client';
import { verifyRefreshToken } from '../lib/jwt';
import { buildErrorResponse, buildSuccessResponse } from '../lib/responses';
import { requireAuth, type AppBindings, type AppVariables } from '../middleware/auth';
import * as authService from '../services/auth.service';
import {
  adminRegisterSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../validators/schemas';

export const authRoutes = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

authRoutes.post('/register', zValidator('json', registerSchema), async (c) => {
  const body = c.req.valid('json');
  const db = createDb(c.env);
  const result = await authService.register(db, c.env, body);
  return c.json(
    buildSuccessResponse(result, SuccessCodes.AUTH_REGISTER_PENDING_VERIFICATION),
    HttpStatusCode.CREATED,
  );
});

authRoutes.post('/register-admin', zValidator('json', adminRegisterSchema), async (c) => {
  const body = c.req.valid('json');
  const db = createDb(c.env);
  const result = await authService.registerAdmin(db, c.env, body);
  return c.json(
    buildSuccessResponse(result, SuccessCodes.AUTH_REGISTER_PENDING_VERIFICATION),
    HttpStatusCode.CREATED,
  );
});

authRoutes.post('/verify-email', zValidator('json', verifyEmailSchema), async (c) => {
  const { token } = c.req.valid('json');
  const db = createDb(c.env);
  const data = await authService.verifyEmail(db, c.env, token);
  return c.json(buildSuccessResponse(data, SuccessCodes.AUTH_VERIFY_EMAIL_SUCCESS));
});

authRoutes.post('/resend-verification', zValidator('json', resendVerificationSchema), async (c) => {
  const { email } = c.req.valid('json');
  const db = createDb(c.env);
  const extra = await authService.resendVerification(db, c.env, email);
  return c.json(
    buildSuccessResponse(
      Object.keys(extra).length ? extra : null,
      SuccessCodes.AUTH_RESEND_VERIFICATION_SUCCESS,
    ),
  );
});

authRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  const body = c.req.valid('json');
  const db = createDb(c.env);
  const data = await authService.login(db, c.env, body);
  return c.json(buildSuccessResponse(data, SuccessCodes.AUTH_LOGIN_SUCCESS));
});

authRoutes.post('/logout', requireAuth, async (c) => {
  const db = createDb(c.env);
  await authService.logout(db, c.get('auth').sub);
  return c.json(buildSuccessResponse(null, SuccessCodes.AUTH_LOGOUT_SUCCESS));
});

authRoutes.post('/refresh', zValidator('json', refreshSchema), async (c) => {
  const { refreshToken } = c.req.valid('json');
  let payload;
  try {
    payload = await verifyRefreshToken(c.env, refreshToken);
  } catch {
    return c.json(
      buildErrorResponse(ErrorCodes.AUTH_UNAUTHORIZED, HttpStatusCode.UNAUTHORIZED),
      HttpStatusCode.UNAUTHORIZED,
    );
  }
  const db = createDb(c.env);
  const data = await authService.refreshTokens(db, c.env, payload.sub, refreshToken);
  return c.json(buildSuccessResponse(data, SuccessCodes.AUTH_REFRESH_SUCCESS));
});

authRoutes.post('/forgot-password', zValidator('json', forgotPasswordSchema), async (c) => {
  const { email } = c.req.valid('json');
  const db = createDb(c.env);
  const extra = await authService.forgotPassword(db, c.env, email);
  return c.json(
    buildSuccessResponse(
      Object.keys(extra).length ? extra : null,
      SuccessCodes.AUTH_FORGOT_PASSWORD_SUCCESS,
    ),
  );
});

authRoutes.post('/reset-password', zValidator('json', resetPasswordSchema), async (c) => {
  const body = c.req.valid('json');
  const db = createDb(c.env);
  await authService.resetPassword(db, body);
  return c.json(buildSuccessResponse(null, SuccessCodes.AUTH_RESET_PASSWORD_SUCCESS));
});
