import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
  Role,
  AccountStatus,
} from '../modules/auth/auth.types';

// ─── Lifetimes ────────────────────────────────────────────────────────────────

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Access token ─────────────────────────────────────────────────────────────

export function signAccessToken(payload: {
  userId: string;
  role: Role;
  status: AccountStatus;
}): string {
  const data: AccessTokenPayload = {
    sub: payload.userId,
    role: payload.role,
    status: payload.status,
  };
  return jwt.sign(data, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
}

// ─── Refresh token ────────────────────────────────────────────────────────────

export function signRefreshToken(userId: string): string {
  const data: RefreshTokenPayload = { sub: userId };
  return jwt.sign(data, env.JWT_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as RefreshTokenPayload;
}

export function getRefreshTokenExpiryDate(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
}

// ─── Refresh token hash ───────────────────────────────────────────────────────
// We store a SHA-256 hash of the raw refresh token in MongoDB, never the token itself.

export function hashRefreshToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function isRefreshTokenHashValid(
  rawToken: string,
  storedHash: string,
): boolean {
  const incoming = hashRefreshToken(rawToken);
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(incoming, 'hex'),
    Buffer.from(storedHash, 'hex'),
  );
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

export const REFRESH_TOKEN_COOKIE = 'whippe_refresh_token';

export function refreshTokenCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: REFRESH_TOKEN_TTL_MS,
    path: '/api/v1/auth',  // scoped — browser only sends this cookie to /auth routes
  };
}

export function clearRefreshTokenCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 0,
    path: '/api/v1/auth',
  };
}
