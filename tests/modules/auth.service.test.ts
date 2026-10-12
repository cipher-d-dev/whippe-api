import mongoose from 'mongoose';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../src/modules/users/user.model', () => ({
  User: {
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

jest.mock('../../src/lib/token', () => ({
  signAccessToken: jest.fn().mockReturnValue('mock-access-token'),
  signRefreshToken: jest.fn().mockReturnValue('mock-refresh-token'),
  verifyRefreshToken: jest.fn(),
  hashRefreshToken: jest.fn().mockReturnValue('mock-hash'),
  isRefreshTokenHashValid: jest.fn(),
  getRefreshTokenExpiryDate: jest.fn().mockReturnValue(new Date()),
}));

// Silence notification/audit side-effects
jest.mock('../../src/modules/notifications/notification.service', () => ({
  createNotification: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../src/modules/timeline/audit-log.service', () => ({
  logAction: jest.fn().mockResolvedValue({}),
}));

import { User } from '../../src/modules/users/user.model';
import * as bcrypt from 'bcryptjs';
import * as token from '../../src/lib/token';
import { signup, login, refresh, logout } from '../../src/modules/auth/auth.service';
import { AccountStatus, AuthMethod, Role } from '../../src/modules/auth/auth.types';

const userId = new mongoose.Types.ObjectId().toString();

const mockUser = {
  id: userId,
  _id: new mongoose.Types.ObjectId(userId),
  email: 'intern@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: Role.INTERN,
  status: AccountStatus.PENDING_HR_VERIFICATION,
  authMethod: AuthMethod.PASSWORD,
  passwordHash: 'hashed-password',
  refreshTokenHash: 'stored-hash',
  comparePassword: jest.fn(),
  save: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── signup ───────────────────────────────────────────────────────────────────

describe('signup', () => {
  it('creates a new user and returns tokens', async () => {
    (User.findOne as jest.Mock).mockResolvedValue(null);
    (User.create as jest.Mock).mockResolvedValue(mockUser);
    (User.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockUser);

    const result = await signup({
      email: 'intern@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      role: Role.INTERN,
    });

    expect(User.findOne).toHaveBeenCalledWith({ email: 'intern@example.com' });
    expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
    expect(result.accessToken).toBe('mock-access-token');
    expect(result.refreshToken).toBe('mock-refresh-token');
    expect(result.user).toEqual(mockUser);
  });

  it('throws 409 when email already exists', async () => {
    (User.findOne as jest.Mock).mockResolvedValue(mockUser);

    await expect(
      signup({
        email: 'intern@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        role: Role.INTERN,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ─── login ────────────────────────────────────────────────────────────────────

describe('login', () => {
  it('returns tokens for valid credentials', async () => {
    const userWithPassword = { ...mockUser, status: AccountStatus.ACTIVE };
    (User.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue({
        ...userWithPassword,
        comparePassword: jest.fn().mockResolvedValue(true),
        authMethod: AuthMethod.PASSWORD,
      }),
    });
    (User.findByIdAndUpdate as jest.Mock).mockResolvedValue(userWithPassword);

    const result = await login({ email: 'intern@example.com', password: 'password123' });

    expect(result.accessToken).toBe('mock-access-token');
    expect(result.refreshToken).toBe('mock-refresh-token');
  });

  it('throws 401 when user not found', async () => {
    (User.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    await expect(
      login({ email: 'nobody@example.com', password: 'password123' }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 401 for wrong password', async () => {
    (User.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue({
        ...mockUser,
        authMethod: AuthMethod.PASSWORD,
        comparePassword: jest.fn().mockResolvedValue(false),
      }),
    });

    await expect(
      login({ email: 'intern@example.com', password: 'wrong' }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 400 when account uses Google auth', async () => {
    (User.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue({
        ...mockUser,
        authMethod: AuthMethod.GOOGLE,
      }),
    });

    await expect(
      login({ email: 'intern@example.com', password: 'password123' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 403 when account is rejected', async () => {
    (User.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue({
        ...mockUser,
        status: AccountStatus.REJECTED,
        authMethod: AuthMethod.PASSWORD,
        comparePassword: jest.fn().mockResolvedValue(true),
      }),
    });

    await expect(
      login({ email: 'intern@example.com', password: 'password123' }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ─── refresh ──────────────────────────────────────────────────────────────────

describe('refresh', () => {
  it('rotates tokens when refresh token is valid', async () => {
    (token.verifyRefreshToken as jest.Mock).mockReturnValue({ sub: userId });
    (User.findById as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue({
        ...mockUser,
        status: AccountStatus.ACTIVE,
        refreshTokenHash: 'stored-hash',
      }),
    });
    (token.isRefreshTokenHashValid as jest.Mock).mockReturnValue(true);
    (User.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockUser);

    const result = await refresh('valid-raw-refresh-token');

    expect(result.accessToken).toBe('mock-access-token');
    expect(result.refreshToken).toBe('mock-refresh-token');
  });

  it('throws 401 when refresh token is invalid JWT', async () => {
    (token.verifyRefreshToken as jest.Mock).mockImplementation(() => {
      throw new Error('jwt malformed');
    });

    await expect(refresh('bad-token')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 401 and wipes hash on token reuse detection', async () => {
    (token.verifyRefreshToken as jest.Mock).mockReturnValue({ sub: userId });
    (User.findById as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue({
        ...mockUser,
        refreshTokenHash: 'stored-hash',
      }),
    });
    (token.isRefreshTokenHashValid as jest.Mock).mockReturnValue(false);
    (User.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockUser);

    await expect(refresh('reused-token')).rejects.toMatchObject({ statusCode: 401 });
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(mockUser.id, { refreshTokenHash: null });
  });
});

// ─── logout ───────────────────────────────────────────────────────────────────

describe('logout', () => {
  it('nulls the stored refresh token hash', async () => {
    (User.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockUser);

    await logout(userId);

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(userId, { refreshTokenHash: null });
  });
});
