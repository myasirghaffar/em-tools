import { SignJWT, jwtVerify } from 'jose';
import type { Env } from '../types';
import { TokenType } from '../common/constants/token-types.enum';
import type { UserRole } from '../common/constants/roles.enum';

const ALG = 'HS256';

export interface AccessJwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  type: TokenType;
}

export interface GeneratedTokens {
  accessToken: string;
  refreshToken: string;
}

export async function signAccessToken(
  env: Env,
  input: { userId: string; email: string; role: UserRole },
): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
  const exp = env.JWT_ACCESS_EXPIRATION ?? '1h';

  return new SignJWT({
    email: input.email,
    role: input.role,
    type: TokenType.ACCESS,
  })
    .setProtectedHeader({ alg: ALG })
    .setSubject(input.userId)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(secret);
}

export async function signRefreshToken(
  env: Env,
  input: { userId: string; email: string; role: UserRole },
): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);
  const exp = env.JWT_REFRESH_EXPIRATION ?? '7d';

  return new SignJWT({
    email: input.email,
    role: input.role,
    type: TokenType.REFRESH,
  })
    .setProtectedHeader({ alg: ALG })
    .setSubject(input.userId)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(secret);
}

export async function generateTokens(
  env: Env,
  input: { userId: string; email: string; role: UserRole },
): Promise<GeneratedTokens> {
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(env, input),
    signRefreshToken(env, input),
  ]);
  return { accessToken, refreshToken };
}

export async function verifyAccessToken(
  env: Env,
  token: string,
): Promise<AccessJwtPayload> {
  const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
  const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });

  if (payload.type !== TokenType.ACCESS) {
    throw new Error('Invalid token type');
  }

  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  const email = typeof payload.email === 'string' ? payload.email : '';
  const role = payload.role as UserRole;

  if (!sub || !email) {
    throw new Error('Invalid access token payload');
  }

  return {
    sub,
    email,
    role,
    type: TokenType.ACCESS,
  };
}

export interface RefreshJwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  type: TokenType;
}

export async function verifyRefreshToken(
  env: Env,
  token: string,
): Promise<RefreshJwtPayload> {
  const secret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);
  const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });

  if (payload.type !== TokenType.REFRESH) {
    throw new Error('Invalid token type');
  }

  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  const email = typeof payload.email === 'string' ? payload.email : '';
  const role = payload.role as UserRole;

  if (!sub || !email) {
    throw new Error('Invalid refresh token payload');
  }

  return {
    sub,
    email,
    role,
    type: TokenType.REFRESH,
  };
}
