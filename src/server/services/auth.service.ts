import { ErrorCodes } from '../common/constants/error-codes';
import { HttpStatusCode } from '../common/constants/http-status';
import { UserRole } from '../common/constants/roles.enum';
import type { Database } from '../db/client';
import * as usersRepo from '../db/users.repo';
import type { Env } from '../types';
import { AppError } from '../lib/app-error';
import { sendTransactionalEmail } from '../lib/mail';
import { comparePassword, hashPassword } from '../lib/password';
import { createOpaqueToken } from '../lib/random-token';
import { generateTokens, signAccessToken, type GeneratedTokens } from '../lib/jwt';
import type { SafePublicUser } from '../lib/user-public';
import { toPublicUser } from '../lib/user-public';
import * as userService from './user.service';

const EMAIL_VERIFY_HOURS = 48;
const PASSWORD_RESET_HOURS = 1;

export type AuthTokensWithUser = GeneratedTokens & { user: SafePublicUser };

function frontendBase(env: Env): string {
  return (env.FRONTEND_APP_URL ?? 'http://localhost:5173').replace(/\/$/, '');
}

async function sendVerificationEmail(env: Env, to: string, token: string): Promise<void> {
  const verifyUrl = `${frontendBase(env)}/verify-email?token=${encodeURIComponent(token)}`;
  const html = `
    <p>Welcome to energymart.pk</p>
    <p>Please verify your email by clicking the button below.</p>
    <p><a href="${verifyUrl}" style="display:inline-block;padding:12px 20px;background:#FF7A00;color:#fff;text-decoration:none;border-radius:8px;">Verify email</a></p>
    <p style="color:#666;font-size:12px;">If the button does not work, copy this link:<br/>${verifyUrl}</p>
  `;
  await sendTransactionalEmail(env, {
    to,
    subject: 'Verify your energymart.pk account',
    html,
  });
}

async function sendPasswordResetEmail(env: Env, to: string, token: string): Promise<void> {
  const resetUrl = `${frontendBase(env)}/reset-password?token=${encodeURIComponent(token)}`;
  const html = `
    <p>We received a request to reset your energymart.pk password.</p>
    <p><a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#FF7A00;color:#fff;text-decoration:none;border-radius:8px;">Reset password</a></p>
    <p style="color:#666;font-size:12px;">If you did not request this, you can ignore this email.<br/>${resetUrl}</p>
  `;
  await sendTransactionalEmail(env, {
    to,
    subject: 'Reset your energymart.pk password',
    html,
  });
}

/** When Resend is not configured, skip sending and let the API return verification/reset URLs in JSON instead of failing. */
async function trySendOrDev(
  env: Env,
  send: () => Promise<void>,
): Promise<{ skipped: boolean }> {
  const hasResend = Boolean(env.RESEND_API_KEY?.trim() && env.EMAIL_FROM?.trim());
  if (hasResend) {
    await send();
    return { skipped: false };
  }
  return { skipped: true };
}

export async function register(
  db: Database,
  env: Env,
  input: { name: string; email: string; password: string },
): Promise<{ email: string; devVerificationUrl?: string }> {
  const { name, email, password } = input;
  const created = await userService.createUser(db, {
    name,
    email,
    password,
    role: UserRole.USER,
    emailVerified: false,
  });

  const token = createOpaqueToken();
  const expires = new Date(Date.now() + EMAIL_VERIFY_HOURS * 60 * 60 * 1000);
  await usersRepo.updateUserById(db, created.id, {
    emailVerifyToken: token,
    emailVerifyExpiresAt: expires,
  });

  const verifyUrl = `${frontendBase(env)}/verify-email?token=${encodeURIComponent(token)}`;
  const { skipped } = await trySendOrDev(env, () => sendVerificationEmail(env, created.email, token));

  return {
    email: created.email,
    ...(skipped ? { devVerificationUrl: verifyUrl } : {}),
  };
}

export async function registerAdmin(
  db: Database,
  env: Env,
  input: { name: string; email: string; password: string; inviteSecret: string },
): Promise<{ email: string; devVerificationUrl?: string }> {
  const expected = env.ADMIN_INVITE_SECRET?.trim();
  if (!expected) {
    throw new AppError(ErrorCodes.AUTH_ADMIN_REGISTER_DISABLED, HttpStatusCode.FORBIDDEN);
  }
  if (input.inviteSecret !== expected) {
    throw new AppError(ErrorCodes.AUTH_ADMIN_INVITE_INVALID, HttpStatusCode.FORBIDDEN);
  }

  const created = await userService.createUser(db, {
    name: input.name,
    email: input.email,
    password: input.password,
    role: UserRole.ADMIN,
    emailVerified: false,
  });

  const token = createOpaqueToken();
  const expires = new Date(Date.now() + EMAIL_VERIFY_HOURS * 60 * 60 * 1000);
  await usersRepo.updateUserById(db, created.id, {
    emailVerifyToken: token,
    emailVerifyExpiresAt: expires,
  });

  const verifyUrl = `${frontendBase(env)}/verify-email?token=${encodeURIComponent(token)}`;
  const { skipped } = await trySendOrDev(env, () => sendVerificationEmail(env, created.email, token));

  return {
    email: created.email,
    ...(skipped ? { devVerificationUrl: verifyUrl } : {}),
  };
}

export async function verifyEmail(
  db: Database,
  env: Env,
  token: string,
): Promise<AuthTokensWithUser> {
  const user = await usersRepo.findUserByEmailVerifyToken(db, token);
  if (!user?.emailVerifyExpiresAt || !user.emailVerifyToken) {
    throw new AppError(ErrorCodes.AUTH_INVALID_OR_EXPIRED_TOKEN, HttpStatusCode.BAD_REQUEST);
  }
  if (user.emailVerifyExpiresAt.getTime() < Date.now()) {
    throw new AppError(ErrorCodes.AUTH_INVALID_OR_EXPIRED_TOKEN, HttpStatusCode.BAD_REQUEST);
  }

  await usersRepo.updateUserById(db, user.id, {
    emailVerified: true,
    emailVerifyToken: null,
    emailVerifyExpiresAt: null,
  });

  const fresh = await userService.findById(db, user.id);
  if (!fresh) {
    throw new AppError(ErrorCodes.USER_NOT_FOUND, HttpStatusCode.NOT_FOUND);
  }

  const tokens = await generateAndStoreTokens(
    db,
    env,
    fresh.id,
    fresh.email,
    fresh.role as UserRole,
  );
  return { ...tokens, user: toPublicUser(fresh)! };
}

export async function resendVerification(
  db: Database,
  env: Env,
  email: string,
): Promise<{ devVerificationUrl?: string }> {
  const user = await userService.findByEmail(db, email.trim().toLowerCase());
  if (!user || user.emailVerified) {
    return {};
  }

  const token = createOpaqueToken();
  const expires = new Date(Date.now() + EMAIL_VERIFY_HOURS * 60 * 60 * 1000);
  await usersRepo.updateUserById(db, user.id, {
    emailVerifyToken: token,
    emailVerifyExpiresAt: expires,
  });

  const verifyUrl = `${frontendBase(env)}/verify-email?token=${encodeURIComponent(token)}`;
  const { skipped } = await trySendOrDev(env, () => sendVerificationEmail(env, user.email, token));
  return skipped ? { devVerificationUrl: verifyUrl } : {};
}

export async function login(
  db: Database,
  env: Env,
  input: { email: string; password: string },
): Promise<AuthTokensWithUser> {
  const user = await userService.findByEmail(db, input.email.trim().toLowerCase());
  if (!user) {
    throw new AppError(ErrorCodes.AUTH_INVALID_CREDENTIALS, HttpStatusCode.UNAUTHORIZED);
  }

  const ok = await comparePassword(input.password, user.password);
  if (!ok) {
    throw new AppError(ErrorCodes.AUTH_INVALID_CREDENTIALS, HttpStatusCode.UNAUTHORIZED);
  }

  if (!user.emailVerified) {
    throw new AppError(ErrorCodes.AUTH_EMAIL_NOT_VERIFIED, HttpStatusCode.FORBIDDEN);
  }

  const tokens = await generateAndStoreTokens(
    db,
    env,
    user.id,
    user.email,
    user.role as UserRole,
  );
  return { ...tokens, user: toPublicUser(user)! };
}

export async function logout(db: Database, userId: string): Promise<void> {
  await userService.setRefreshTokenHash(db, userId, null);
}

export async function refreshTokens(
  db: Database,
  env: Env,
  userId: string,
  refreshTokenPlain: string,
): Promise<AuthTokensWithUser> {
  const user = await userService.findById(db, userId);
  if (!user?.refreshToken) {
    throw new AppError(ErrorCodes.AUTH_REFRESH_TOKEN_MISSING, HttpStatusCode.UNAUTHORIZED);
  }

  const valid = await comparePassword(refreshTokenPlain, user.refreshToken);
  if (!valid) {
    throw new AppError(ErrorCodes.AUTH_REFRESH_TOKEN_INVALID, HttpStatusCode.UNAUTHORIZED);
  }

  // Issue a new access token only — keep the same refresh token so multiple tabs
  // and parallel 401 retries do not invalidate each other.
  const accessToken = await signAccessToken(env, {
    userId: user.id,
    email: user.email,
    role: user.role as UserRole,
  });
  return {
    accessToken,
    refreshToken: refreshTokenPlain,
    user: toPublicUser(user)!,
  };
}

export async function forgotPassword(
  db: Database,
  env: Env,
  email: string,
): Promise<{ devResetUrl?: string }> {
  const user = await userService.findByEmail(db, email.trim().toLowerCase());
  if (!user) {
    return {};
  }

  const token = createOpaqueToken();
  const expires = new Date(Date.now() + PASSWORD_RESET_HOURS * 60 * 60 * 1000);
  await usersRepo.updateUserById(db, user.id, {
    passwordResetToken: token,
    passwordResetExpiresAt: expires,
  });

  const resetUrl = `${frontendBase(env)}/reset-password?token=${encodeURIComponent(token)}`;
  const { skipped } = await trySendOrDev(env, () => sendPasswordResetEmail(env, user.email, token));
  return skipped ? { devResetUrl: resetUrl } : {};
}

export async function resetPassword(
  db: Database,
  input: { token: string; password: string },
): Promise<void> {
  const user = await usersRepo.findUserByPasswordResetToken(db, input.token);
  if (!user?.passwordResetExpiresAt || !user.passwordResetToken) {
    throw new AppError(ErrorCodes.AUTH_INVALID_OR_EXPIRED_TOKEN, HttpStatusCode.BAD_REQUEST);
  }
  if (user.passwordResetExpiresAt.getTime() < Date.now()) {
    throw new AppError(ErrorCodes.AUTH_INVALID_OR_EXPIRED_TOKEN, HttpStatusCode.BAD_REQUEST);
  }

  const hashed = await hashPassword(input.password);
  await usersRepo.updateUserById(db, user.id, {
    password: hashed,
    passwordResetToken: null,
    passwordResetExpiresAt: null,
    refreshToken: null,
  });
}

async function generateAndStoreTokens(
  db: Database,
  env: Env,
  userId: string,
  email: string,
  role: UserRole,
): Promise<GeneratedTokens> {
  const tokens = await generateTokens(env, { userId, email, role });
  const hashedRefresh = await hashPassword(tokens.refreshToken);
  await userService.setRefreshTokenHash(db, userId, hashedRefresh);
  return tokens;
}
