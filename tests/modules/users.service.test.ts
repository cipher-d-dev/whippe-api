import mongoose from 'mongoose';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../src/modules/users/user.model', () => ({
  User: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.mock('../../src/modules/notifications/notification.service', () => ({
  createNotification: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../src/modules/timeline/audit-log.service', () => ({
  logAction: jest.fn().mockResolvedValue({}),
}));

import { User } from '../../src/modules/users/user.model';
import { approveUser, rejectUser } from '../../src/modules/users/users.service';
import { AccountStatus, Role } from '../../src/modules/auth/auth.types';

const userId = new mongoose.Types.ObjectId().toString();
const hrUserId = new mongoose.Types.ObjectId().toString();

function makeMockUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: userId,
    _id: new mongoose.Types.ObjectId(userId),
    email: 'intern@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: Role.INTERN,
    status: AccountStatus.PENDING_HR_VERIFICATION,
    verifiedAt: undefined as Date | undefined,
    verifiedBy: undefined as mongoose.Types.ObjectId | undefined,
    rejectedAt: undefined as Date | undefined,
    rejectedBy: undefined as mongoose.Types.ObjectId | undefined,
    rejectionReason: undefined as string | undefined,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── approveUser ──────────────────────────────────────────────────────────────

describe('approveUser', () => {
  it('sets status to ACTIVE and records verifiedAt', async () => {
    const mockUser = makeMockUser();
    (User.findById as jest.Mock).mockResolvedValue(mockUser);

    const result = await approveUser(userId, hrUserId);

    expect(mockUser.status).toBe(AccountStatus.ACTIVE);
    expect(mockUser['verifiedAt']).toBeInstanceOf(Date);
    expect(mockUser.save).toHaveBeenCalled();
    expect(result.status).toBe(AccountStatus.ACTIVE);
  });

  it('throws 400 for an invalid userId', async () => {
    await expect(approveUser('not-an-id', hrUserId)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('throws 404 when user not found', async () => {
    (User.findById as jest.Mock).mockResolvedValue(null);

    await expect(approveUser(userId, hrUserId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('throws 409 when account is already active', async () => {
    const mockUser = makeMockUser({ status: AccountStatus.ACTIVE });
    (User.findById as jest.Mock).mockResolvedValue(mockUser);

    await expect(approveUser(userId, hrUserId)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('throws 409 when account is already rejected', async () => {
    const mockUser = makeMockUser({ status: AccountStatus.REJECTED });
    (User.findById as jest.Mock).mockResolvedValue(mockUser);

    await expect(approveUser(userId, hrUserId)).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

// ─── rejectUser ───────────────────────────────────────────────────────────────

describe('rejectUser', () => {
  it('sets status to REJECTED and records rejectedAt + reason', async () => {
    const mockUser = makeMockUser();
    (User.findById as jest.Mock).mockResolvedValue(mockUser);

    const result = await rejectUser(userId, hrUserId, 'Not eligible');

    expect(mockUser.status).toBe(AccountStatus.REJECTED);
    expect(mockUser['rejectedAt']).toBeInstanceOf(Date);
    expect(mockUser['rejectionReason']).toBe('Not eligible');
    expect(mockUser.save).toHaveBeenCalled();
    expect(result.status).toBe(AccountStatus.REJECTED);
  });

  it('throws 400 for an invalid userId', async () => {
    await expect(rejectUser('not-an-id', hrUserId, 'reason')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('throws 404 when user not found', async () => {
    (User.findById as jest.Mock).mockResolvedValue(null);

    await expect(rejectUser(userId, hrUserId, 'reason')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('throws 409 when account is not pending verification', async () => {
    const mockUser = makeMockUser({ status: AccountStatus.ACTIVE });
    (User.findById as jest.Mock).mockResolvedValue(mockUser);

    await expect(rejectUser(userId, hrUserId, 'reason')).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});
