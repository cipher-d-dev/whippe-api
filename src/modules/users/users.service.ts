import mongoose from 'mongoose';
import { User } from './user.model';
import { AccountStatus, Role } from '../auth/auth.types';
import { createError } from '../../middleware/error-handler';
import { ListUsersQuery } from './users.schema';
import { PaginatedResponse } from './user.types';
import { IUserDocument } from './user.model';

// ─── HR verification queue ────────────────────────────────────────────────────
// Returns paginated list of accounts pending HR verification,
// ordered oldest first so HR reviews in the order accounts arrived.

export async function getVerificationQueue(
  query: ListUsersQuery,
): Promise<PaginatedResponse<IUserDocument>> {
  const { page, limit } = query;
  const skip = (page - 1) * limit;

  const filter = { status: AccountStatus.PENDING_HR_VERIFICATION };

  const [data, total] = await Promise.all([
    User.find(filter).sort({ createdAt: 1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ─── List all users (HR only) ─────────────────────────────────────────────────

export async function listUsers(
  query: ListUsersQuery,
): Promise<PaginatedResponse<IUserDocument>> {
  const { page, limit, status, role } = query;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (status) filter['status'] = status;
  if (role) filter['role'] = role;

  const [data, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ─── Get user by id ───────────────────────────────────────────────────────────

export async function getUserById(userId: string): Promise<IUserDocument> {
  if (!mongoose.isValidObjectId(userId)) {
    throw createError('Invalid user ID.', 400);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw createError('User not found.', 404);
  }

  return user;
}

// ─── Approve ──────────────────────────────────────────────────────────────────

export async function approveUser(
  userId: string,
  hrUserId: string,
): Promise<IUserDocument> {
  if (!mongoose.isValidObjectId(userId)) {
    throw createError('Invalid user ID.', 400);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw createError('User not found.', 404);
  }

  if (user.status !== AccountStatus.PENDING_HR_VERIFICATION) {
    throw createError(
      `Cannot approve an account with status: ${user.status}.`,
      409,
    );
  }

  user.status = AccountStatus.ACTIVE;
  user.verifiedAt = new Date();
  user.verifiedBy = new mongoose.Types.ObjectId(hrUserId);

  await user.save();

  return user;
}

// ─── Reject ───────────────────────────────────────────────────────────────────

export async function rejectUser(
  userId: string,
  hrUserId: string,
  reason: string,
): Promise<IUserDocument> {
  if (!mongoose.isValidObjectId(userId)) {
    throw createError('Invalid user ID.', 400);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw createError('User not found.', 404);
  }

  if (user.status !== AccountStatus.PENDING_HR_VERIFICATION) {
    throw createError(
      `Cannot reject an account with status: ${user.status}.`,
      409,
    );
  }

  user.status = AccountStatus.REJECTED;
  user.rejectedAt = new Date();
  user.rejectedBy = new mongoose.Types.ObjectId(hrUserId);
  user.rejectionReason = reason;

  await user.save();

  return user;
}

// ─── Delete expired pending accounts ──────────────────────────────────────────
// Called by the scheduled cleanup job.
// Only deletes accounts that are still PENDING and whose
// verificationExpiresAt has passed. Safe to run repeatedly.

export async function deleteExpiredPendingAccounts(): Promise<number> {
  const result = await User.deleteMany({
    status: AccountStatus.PENDING_HR_VERIFICATION,
    verificationExpiresAt: { $lte: new Date() },
  });

  return result.deletedCount;
}

// ─── Role guard helper ────────────────────────────────────────────────────────
// Verifies that the requesting HR user cannot demote themselves or
// act on another HR account — can be extended as business rules evolve.

export function assertNotSelf(actorId: string, targetId: string): void {
  if (actorId === targetId) {
    throw createError('You cannot perform this action on your own account.', 403);
  }
}

export function assertCanActOnRole(targetRole: Role): void {
  // HR cannot approve/reject other HR accounts — only interns and supervisors
  if (targetRole === Role.HR) {
    throw createError(
      'HR accounts cannot be approved or rejected through this endpoint.',
      403,
    );
  }
}
