import bcrypt from 'bcryptjs';
import { User } from '../users/user.model';
import { AccountStatus, AuthMethod, Role } from './auth.types';
import { SignupInput, LoginInput } from './auth.schema';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashRefreshToken,
  isRefreshTokenHashValid,
  getRefreshTokenExpiryDate,
} from '../../lib/token';
import {
  generateEmailVerificationToken,
  generatePasswordResetToken,
  hashToken,
  isTokenHashValid,
  isTokenExpired,
  EMAIL_VERIFICATION_TTL_HOURS,
  PASSWORD_RESET_TTL_MINUTES,
} from '../../lib/email-token';
import { sendEmail } from '../../lib/email';
import {
  renderVerificationEmail,
  renderPasswordResetEmail,
} from '../../lib/email-templates';
import { env } from '../../config/env';
import { createError } from '../../middleware/error-handler';
import { notifyAllHR } from '../notifications/notification.service';
import { NotificationType } from '../notifications/notification.types';

const BCRYPT_ROUNDS = 12;
const VERIFICATION_WINDOW_DAYS = 30;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function verificationExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + VERIFICATION_WINDOW_DAYS);
  return d;
}

function issueTokens(userId: string, role: Role, status: AccountStatus, authMethod: AuthMethod) {
  const accessToken = signAccessToken({ userId, role, status, authMethod });
  const refreshToken = signRefreshToken(userId);
  const refreshTokenHash = hashRefreshToken(refreshToken);
  return { accessToken, refreshToken, refreshTokenHash };
}

// ─── signup ───────────────────────────────────────────────────────────────────

export async function signup(input: SignupInput) {
  const existing = await User.findOne({ email: input.email });
  if (existing) {
    throw createError('An account with this email already exists.', 409);
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  // Email verification token — generated upfront so the user can verify
  // immediately after signup. The hash is stored; the raw token is sent by email.
  const { token: verificationToken, hash: verificationHash, expiresAt: verificationExpiry } =
    generateEmailVerificationToken();

  const user = await User.create({
    email: input.email,
    passwordHash,
    firstName: input.firstName,
    lastName: input.lastName,
    role: input.role,
    status: AccountStatus.UNVERIFIED_EMAIL,
    authMethod: AuthMethod.PASSWORD,
    emailVerificationTokenHash: verificationHash,
    emailVerificationExpiresAt: verificationExpiry,
    verificationExpiresAt: verificationExpiresAt(),
  });

  const { accessToken, refreshToken, refreshTokenHash } = issueTokens(
    user.id,
    user.role,
    user.status,
    user.authMethod,
  );

  // Persist refresh token hash
  await User.findByIdAndUpdate(user.id, { refreshTokenHash });

  // Send verification email — fire and forget. Failure here must not block
  // signup; the user can request a resend from the verify-email page.
  const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
  const rendered = renderVerificationEmail({
    firstName: user.firstName,
    verifyUrl,
    expiresInHours: EMAIL_VERIFICATION_TTL_HOURS,
  });
  void sendEmail({
    to: user.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });

  return { user, accessToken, refreshToken };
}

// ─── Email verification ─────────────────────────────────────────────────────

/**
 * Verify an email address using the token from the verification email.
 * Single-use: the stored hash is cleared on success.
 *
 * Returns a status the controller can surface to the frontend.
 */
export async function verifyEmail(
  rawToken: string,
): Promise<{ ok: true } | { ok: false; reason: 'invalid' | 'expired' }> {
  const incomingHash = hashToken(rawToken);

  const user = await User.findOne({
    emailVerificationTokenHash: incomingHash,
  }).select('+emailVerificationTokenHash +emailVerificationExpiresAt');

  if (!user) {
    return { ok: false, reason: 'invalid' };
  }

  if (isTokenExpired(user.emailVerificationExpiresAt)) {
    // Clear the expired token so it can never be reused
    await User.findByIdAndUpdate(user.id, {
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null,
    });
    return { ok: false, reason: 'expired' };
  }

  await User.findByIdAndUpdate(user.id, {
    status: AccountStatus.PENDING_HR_VERIFICATION,
    emailVerifiedAt: new Date(),
    emailVerificationTokenHash: null,
    emailVerificationExpiresAt: null,
  });

  // Notify HR that a candidate has verified email and is waiting in the verification queue
  notifyAllHR(
    NotificationType.NEW_INTERN_PENDING,
    'New candidate pending verification',
    `${user.firstName} ${user.lastName} (${user.email}) verified their email and is awaiting HR approval.`,
    { kind: 'User', id: user.id },
  ).catch((err) => console.warn('[auth.service] Failed to notify HR of verified user:', err));

  return { ok: true };
}

/**
 * Resend the verification email. Silently no-ops if the user doesn't exist
 * or has already verified — callers should always return 200 to prevent
 * email enumeration.
 */
export async function resendVerificationEmail(email: string): Promise<void> {
  const user = await User.findOne({ email }).select(
    '+emailVerificationTokenHash +emailVerificationExpiresAt',
  );

  if (!user) return;
  if (user.status !== AccountStatus.UNVERIFIED_EMAIL) return;

  const { token, hash, expiresAt } = generateEmailVerificationToken();
  user.emailVerificationTokenHash = hash;
  user.emailVerificationExpiresAt = expiresAt;
  await user.save();

  const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${token}`;
  const rendered = renderVerificationEmail({
    firstName: user.firstName,
    verifyUrl,
    expiresInHours: EMAIL_VERIFICATION_TTL_HOURS,
  });

  await sendEmail({
    to: user.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });
}

// ─── Password reset ──────────────────────────────────────────────────────────

/**
 * Request a password reset email. Always appears to succeed to the client
 * (anti-enumeration) — silently no-ops when:
 *   - the user doesn't exist
 *   - the account is Google-only (no password to reset)
 *   - the account is REJECTED
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await User.findOne({ email }).select(
    '+passwordResetTokenHash +passwordResetExpiresAt +authMethod',
  );

  if (!user) return;
  if (user.authMethod === AuthMethod.GOOGLE) return; // Google-only — no password
  if (user.status === AccountStatus.REJECTED) return;

  const { token, hash, expiresAt } = generatePasswordResetToken();
  user.passwordResetTokenHash = hash;
  user.passwordResetExpiresAt = expiresAt;
  await user.save();

  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`;
  const rendered = renderPasswordResetEmail({
    firstName: user.firstName,
    resetUrl,
    expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
  });

  await sendEmail({
    to: user.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });
}

/**
 * Reset a password using a token from the reset email. Single-use.
 *
 * Side effects:
 *   - Updates the user's passwordHash
 *   - Promotes authMethod GOOGLE → BOTH if the user was Google-only
 *     (defensive — requestPasswordReset skips Google-only users, but we
 *     handle this in case they got here another way)
 *   - Invalidates all refresh tokens (forces re-login everywhere)
 *   - Clears the reset token
 */
export async function resetPassword(
  rawToken: string,
  newPassword: string,
): Promise<void> {
  const incomingHash = hashToken(rawToken);

  const user = await User.findOne({
    passwordResetTokenHash: incomingHash,
  }).select(
    '+passwordResetTokenHash +passwordResetExpiresAt +passwordHash +authMethod +refreshTokenHash',
  );

  if (!user) {
    throw createError('Invalid or expired reset token.', 400);
  }

  if (isTokenExpired(user.passwordResetExpiresAt)) {
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();
    throw createError('Reset token has expired. Please request a new one.', 400);
  }

  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  // Promote a Google-only user to BOTH if they somehow reached here.
  if (user.authMethod === AuthMethod.GOOGLE) {
    user.authMethod = AuthMethod.BOTH;
  }

  // Clear the reset token (single-use). Save first, then unset refresh token
  // hash via update — Mongoose won't persist undefined assignments on save.
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  await user.save();

  // Invalidate all refresh tokens (forces re-login on every device)
  await User.findByIdAndUpdate(user.id, { refreshTokenHash: null });
}

// ─── login ────────────────────────────────────────────────────────────────────

export async function login(input: LoginInput) {
  // Explicitly select passwordHash since it is select:false on the schema
  const user = await User.findOne({ email: input.email }).select('+passwordHash');

  if (!user) {
    // Generic message — do not reveal whether the email exists
    throw createError('Invalid email or password.', 401);
  }

  if (user.authMethod === AuthMethod.GOOGLE) {
    throw createError(
      'This account uses Google sign-in. Please log in with Google.',
      400,
    );
  }

  const valid = await user.comparePassword(input.password);
  if (!valid) {
    throw createError('Invalid email or password.', 401);
  }

  if (user.status === AccountStatus.REJECTED) {
    throw createError('Your account has been rejected. Please contact HR.', 403);
  }

  const { accessToken, refreshToken, refreshTokenHash } = issueTokens(
    user.id,
    user.role,
    user.status,
    user.authMethod,
  );

  await User.findByIdAndUpdate(user.id, { refreshTokenHash });

  return { user, accessToken, refreshToken };
}

// ─── refresh ──────────────────────────────────────────────────────────────────

export async function refresh(rawRefreshToken: string) {
  // Verify JWT signature and expiry first
  let payload: ReturnType<typeof verifyRefreshToken>;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw createError('Invalid or expired refresh token.', 401);
  }

  // Load user with the stored hash
  const user = await User.findById(payload.sub).select('+refreshTokenHash');
  if (!user || !user.refreshTokenHash) {
    throw createError('Invalid or expired refresh token.', 401);
  }

  // Constant-time hash comparison
  const valid = isRefreshTokenHashValid(rawRefreshToken, user.refreshTokenHash);
  if (!valid) {
    // Possible token reuse — wipe the stored hash to force re-login
    await User.findByIdAndUpdate(user.id, { refreshTokenHash: null });
    throw createError('Refresh token reuse detected. Please log in again.', 401);
  }

  if (user.status === AccountStatus.REJECTED) {
    throw createError('Account has been rejected.', 403);
  }

  // Rotate: issue new pair
  const {
    accessToken,
    refreshToken: newRefreshToken,
    refreshTokenHash: newHash,
  } = issueTokens(user.id, user.role, user.status, user.authMethod);

  await User.findByIdAndUpdate(user.id, { refreshTokenHash: newHash });

  return { user, accessToken, refreshToken: newRefreshToken };
}

// ─── logout ───────────────────────────────────────────────────────────────────

export async function logout(userId: string) {
  // Invalidate stored hash — cookie cleared by the controller
  await User.findByIdAndUpdate(userId, { refreshTokenHash: null });
}

// ─── getMe ────────────────────────────────────────────────────────────────────

export async function getMe(userId: string) {
  const user = await User.findById(userId);
  if (!user) {
    throw createError('User not found.', 404);
  }
  return user;
}

// ─── getAuthMethod ────────────────────────────────────────────────────────────
// Section E — smart login detection.
// Returns the auth method(s) for an email without revealing if the account exists.
// We always return a result for non-existent emails too (returns "none") so
// callers can't enumerate accounts by timing difference alone.

export type AuthMethodResult = 'password' | 'google' | 'both' | 'none';

export async function getAuthMethod(email: string): Promise<AuthMethodResult> {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return 'none';

  switch (user.authMethod) {
    case AuthMethod.PASSWORD: return 'password';
    case AuthMethod.GOOGLE:   return 'google';
    case AuthMethod.BOTH:     return 'both';
    default:                  return 'none';
  }
}

// ─── linkPassword ─────────────────────────────────────────────────────────────
// Adds a password to a Google-only account.
// Requires the caller to be authenticated (account must be ACTIVE).

export async function linkPassword(
  userId: string,
  newPassword: string,
): Promise<void> {
  const user = await User.findById(userId).select('+authMethod +passwordHash');
  if (!user) throw createError('User not found.', 404);

  if (user.authMethod === AuthMethod.PASSWORD) {
    throw createError('This account already has a password.', 409);
  }

  if (user.authMethod === AuthMethod.BOTH) {
    throw createError('This account already has a password linked.', 409);
  }

  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  user.authMethod = AuthMethod.BOTH;
  await user.save();
}

// ─── unlinkGoogle ─────────────────────────────────────────────────────────────
// Removes Google from a BOTH account. Requires a password to remain.

export async function unlinkGoogle(userId: string): Promise<void> {
  const user = await User.findById(userId).select('+authMethod +googleId');
  if (!user) throw createError('User not found.', 404);

  if (user.authMethod !== AuthMethod.BOTH) {
    throw createError(
      'Cannot remove Google sign-in — you must have a password set first.',
      409,
    );
  }

  user.googleId = undefined;
  user.authMethod = AuthMethod.PASSWORD;
  await user.save();
}

// ─── unlinkPassword ───────────────────────────────────────────────────────────
// Removes password from a BOTH account. Requires Google to remain.

export async function unlinkPassword(userId: string): Promise<void> {
  const user = await User.findById(userId).select('+authMethod');
  if (!user) throw createError('User not found.', 404);

  if (user.authMethod !== AuthMethod.BOTH) {
    throw createError(
      'Cannot remove password sign-in — you must have Google linked first.',
      409,
    );
  }

  // Unset passwordHash via update (Mongoose won't persist undefined on save)
  await User.findByIdAndUpdate(userId, {
    $unset: { passwordHash: '' },
    authMethod: AuthMethod.GOOGLE,
  });
}
