// users.service.ts – restored correct implementation
import mongoose from 'mongoose';
import { User } from './user.model';
import { AccountStatus, Role } from '../auth/auth.types';
import { createError } from '../../middleware/error-handler';
import { ListUsersQuery } from './users.schema';
import { PaginatedResponse } from './user.types';
import { IUserDocument } from './user.model';
import { createNotification } from '../notifications/notification.service';
import { NotificationType } from '../notifications/notification.types';
import { logAction } from '../timeline/audit-log.service';
import { AuditAction } from '../timeline/audit-log.types';
import { sendEmail } from '../../lib/email';
import { renderWelcomeEmail, renderRejectionEmail } from '../../lib/email-templates';
import { env } from '../../config/env';

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
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
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
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
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
  // Notify the user that their account has been approved
  await createNotification(
    user.id,
    NotificationType.ACCOUNT_APPROVED,
    'Account approved',
    'Your Whippe account has been approved by HR. You can now access the platform.',
  ).catch(() => {});
  await logAction({
    action: AuditAction.ACCOUNT_APPROVED,
    performedBy: hrUserId,
    targetUser: user.id,
  }).catch(() => {});
  // Send welcome email
  const rendered = renderWelcomeEmail({
    firstName: user.firstName,
    loginUrl: `${env.FRONTEND_URL}/login`,
  });
  void sendEmail({ to: user.email, subject: rendered.subject, html: rendered.html, text: rendered.text });
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
  user.rejectionReason = reason;
  await user.save();

  // Notify user & audit
  await createNotification(
    user.id,
    NotificationType.ACCOUNT_REJECTED,
    'Account registration rejected',
    `Your Whippe registration was not approved: ${reason}`,
  ).catch(() => {});
  await logAction({
    action: AuditAction.ACCOUNT_REJECTED,
    performedBy: hrUserId,
    targetUser: user.id,
    detail: reason,
  }).catch(() => {});

  // Send rejection email
  const rendered = renderRejectionEmail({
    firstName: user.firstName,
    rejectionReason: reason,
    supportUrl: `${env.FRONTEND_URL}/support`,
  });
  void sendEmail({ to: user.email, subject: rendered.subject, html: rendered.html, text: rendered.text });

  return user;
}

// ─── Delete user (HR) ────────────────────────────────────────────────────────
export async function deleteUser(userId: string): Promise<void> {
  if (!mongoose.isValidObjectId(userId)) {
    throw createError('Invalid user ID.', 400);
  }
  // HR authorization is enforced at the route level.
  await User.findByIdAndDelete(userId).exec();
}

// ─── Delete expired pending accounts ──────────────────────────────────────────
// Called by the scheduled cleanup job.
export async function deleteExpiredPendingAccounts(): Promise<number> {
  const result = await User.deleteMany({
    status: { $in: [AccountStatus.UNVERIFIED_EMAIL, AccountStatus.PENDING_HR_VERIFICATION] },
    verificationExpiresAt: { $lte: new Date() },
  });
  return result.deletedCount;
}

// ─── Role guard helper ────────────────────────────────────────────────────────
export function assertNotSelf(actorId: string, targetId: string): void {
  if (actorId === targetId) {
    throw createError('You cannot perform this action on your own account.', 403);
  }
}

export function assertCanActOnRole(targetRole: Role): void {
  if (targetRole === Role.HR) {
    throw createError(
      'HR accounts cannot be approved or rejected through this endpoint.',
      403,
    );
  }
}

// ─── Update Avatar ────────────────────────────────────────────────────────────
export async function updateAvatar(
  userId: string,
  avatarUrl: string,
): Promise<IUserDocument> {
  const user = await getUserById(userId);
  user.avatarUrl = avatarUrl;
  await user.save();
  return user;
}
