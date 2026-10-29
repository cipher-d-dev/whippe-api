import mongoose from 'mongoose';
import { Notification, INotificationDocument } from './notification.model';
import { NotificationType } from './notification.types';
import { createError } from '../../middleware/error-handler';
import { ListNotificationsQuery } from './notification.schema';
import { PaginatedResponse } from '../users/user.types';
import { sendPushToUser } from './push.service';

// ─── createNotification ───────────────────────────────────────────────────────
// Internal utility called by other services — never called directly by clients.

export async function createNotification(
  recipientId: string,
  type: NotificationType,
  title: string,
  body: string,
  relatedEntity?: { kind: string; id: string },
): Promise<INotificationDocument> {
  const doc: Record<string, unknown> = {
    recipient: new mongoose.Types.ObjectId(recipientId),
    type,
    title,
    body,
  };

  if (relatedEntity) {
    doc.relatedEntity = {
      kind: relatedEntity.kind,
      id: new mongoose.Types.ObjectId(relatedEntity.id),
    };
  }

  const notification = await Notification.create(doc);

  // Fire-and-forget push — do not let push failure affect the DB write
  sendPushToUser(recipientId, { title, body }).catch((err) => {
    console.warn('[push] sendPushToUser error:', err);
  });

  return notification;
}

// ─── notifyAllHR ─────────────────────────────────────────────────────────────
// Broadcast an important administrative alert to all active HR admins.

export async function notifyAllHR(
  type: NotificationType,
  title: string,
  body: string,
  relatedEntity?: { kind: string; id: string },
): Promise<void> {
  const User = mongoose.model('User');
  const hrUsers = await User.find({ role: 'HR', status: 'ACTIVE' }, '_id');

  await Promise.all(
    hrUsers.map((hr) =>
      createNotification(hr._id.toString(), type, title, body, relatedEntity).catch((err) =>
        console.warn(`[notifyAllHR] Failed to notify HR ${hr._id}:`, err)
      )
    )
  );
}

// ─── List notifications for the authenticated user ────────────────────────────

export async function listNotifications(
  query: ListNotificationsQuery,
  userId: string,
): Promise<PaginatedResponse<INotificationDocument>> {
  const { page, limit, read } = query;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {
    recipient: new mongoose.Types.ObjectId(userId),
  };

  if (read !== undefined) {
    filter['read'] = read;
  }

  const [data, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─── Mark one notification as read ───────────────────────────────────────────

export async function markOneRead(
  notificationId: string,
  userId: string,
): Promise<INotificationDocument> {
  if (!mongoose.isValidObjectId(notificationId)) {
    throw createError('Invalid notification ID.', 400);
  }

  const notification = await Notification.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(notificationId),
      recipient: new mongoose.Types.ObjectId(userId),
    },
    { read: true },
    { new: true },
  );

  if (!notification) {
    throw createError('Notification not found.', 404);
  }

  return notification;
}

// ─── Mark all notifications as read ──────────────────────────────────────────

export async function markAllRead(userId: string): Promise<{ count: number }> {
  const result = await Notification.updateMany(
    {
      recipient: new mongoose.Types.ObjectId(userId),
      read: false,
    },
    { read: true },
  );

  return { count: result.modifiedCount };
}

// ─── Broadcast notifications (HR only) ────────────────────────────────────────

export async function broadcastNotification(
  input: { target: 'INTERNS' | 'SUPERVISORS' | 'BOTH'; title: string; body: string },
): Promise<{ count: number }> {
  const User = mongoose.model('User');
  let roleFilter: unknown;

  if (input.target === 'INTERNS') {
    roleFilter = 'INTERN';
  } else if (input.target === 'SUPERVISORS') {
    roleFilter = 'SUPERVISOR';
  } else {
    roleFilter = { $in: ['INTERN', 'SUPERVISOR'] };
  }

  const recipients = await User.find(
    { role: roleFilter, status: 'ACTIVE' },
    '_id',
  );

  const notificationsToCreate = recipients.map((u) => ({
    recipient: u._id,
    type: NotificationType.BROADCAST,
    title: input.title,
    body: input.body,
  }));

  if (notificationsToCreate.length > 0) {
    await Notification.insertMany(notificationsToCreate);
    // Push notify recipients asynchronously
    recipients.forEach((u) => {
      sendPushToUser(u._id.toString(), { title: input.title, body: input.body }).catch(() => {});
    });
  }

  return { count: notificationsToCreate.length };
}
