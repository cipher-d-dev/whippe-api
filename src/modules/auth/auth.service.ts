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
import { createError } from '../../middleware/error-handler';

const BCRYPT_ROUNDS = 12;
const VERIFICATION_WINDOW_DAYS = 30;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function verificationExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + VERIFICATION_WINDOW_DAYS);
  return d;
}

function issueTokens(userId: string, role: Role, status: AccountStatus) {
  const accessToken = signAccessToken({ userId, role, status });
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

  const user = await User.create({
    email: input.email,
    passwordHash,
    firstName: input.firstName,
    lastName: input.lastName,
    role: input.role,
    status: AccountStatus.PENDING_HR_VERIFICATION,
    authMethod: AuthMethod.PASSWORD,
    verificationExpiresAt: verificationExpiresAt(),
  });

  const { accessToken, refreshToken, refreshTokenHash } = issueTokens(
    user.id,
    user.role,
    user.status,
  );

  // Persist refresh token hash
  await User.findByIdAndUpdate(user.id, { refreshTokenHash });

  return { user, accessToken, refreshToken };
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
  } = issueTokens(user.id, user.role, user.status);

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
