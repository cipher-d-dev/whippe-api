/**
 * email-token.ts — opaque single-use tokens for email verification and
 * password reset.
 *
 * Design choices:
 *  - Use `crypto.randomBytes` (not JWTs): tokens carry no payload, so they
 *    leak nothing if intercepted. They are looked up by hash.
 *  - Store only the SHA-256 hash in MongoDB, never the raw token.
 *  - Constant-time hash comparison to prevent timing attacks.
 *  - Tokens are single-use — controllers clear the hash on success.
 *
 * Same hashing primitives as refresh tokens (lib/token.ts) but kept in a
 * separate module to keep the concerns distinct.
 */

import crypto from 'crypto';

// ─── Lifetimes ────────────────────────────────────────────────────────────────

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;          // 1 hour

export const EMAIL_VERIFICATION_TTL_HOURS = 24;
export const PASSWORD_RESET_TTL_MINUTES = 60;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeneratedToken {
  /** Raw token — goes in the URL. Never store this. */
  token: string;
  /** SHA-256 hash — store this in MongoDB. */
  hash: string;
  /** When the token expires. */
  expiresAt: Date;
}

// ─── Hash primitives ──────────────────────────────────────────────────────────

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function isTokenHashValid(rawToken: string, storedHash: string): boolean {
  const incoming = hashToken(rawToken);
  // Constant-time comparison to prevent timing attacks.
  // Buffers must be equal length — they always are here (both 64-char hex).
  try {
    return crypto.timingSafeEqual(
      Buffer.from(incoming, 'hex'),
      Buffer.from(storedHash, 'hex'),
    );
  } catch {
    return false;
  }
}

// ─── Generators ──────────────────────────────────────────────────────────────

export function generateEmailVerificationToken(): GeneratedToken {
  return generate(EMAIL_VERIFICATION_TTL_MS);
}

export function generatePasswordResetToken(): GeneratedToken {
  return generate(PASSWORD_RESET_TTL_MS);
}

function generate(ttlMs: number): GeneratedToken {
  const token = crypto.randomBytes(32).toString('hex');
  return {
    token,
    hash: hashToken(token),
    expiresAt: new Date(Date.now() + ttlMs),
  };
}

// ─── Validation helpers ──────────────────────────────────────────────────────

export function isTokenExpired(expiresAt: Date | undefined | null): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() < Date.now();
}
